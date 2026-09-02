import { getDb } from "@/services/db/connection";
import { mergeThreads } from "@/services/db/threads";

/**
 * Rejoin conversations the provider split.
 *
 * Gmail groups by its own rules and gets it wrong often enough to notice: a
 * correspondent replying from Outlook or Apple Mail brings a new Message-ID
 * scheme and a rewritten subject ("AW: :"), and the exchange lands in two
 * threads. The RFC headers still say what replied to what, so this is not a
 * guess — a message whose In-Reply-To names a message in another thread means
 * the two are one conversation.
 *
 * It reuses the manual merge: nothing is rewritten, the join shows in the
 * thread with "Separate again", and a resync cannot lose anything.
 */

/** A message that replies across a thread boundary. */
interface CrossLink {
  child_thread: string;
  parent_thread: string;
  child_date: number;
  parent_date: number;
}

/**
 * Find and apply every header-proven join for one account.
 *
 * Returns how many threads were folded, so a caller can log it. Threads
 * already merged are skipped by the query, so this is safe to run each sync.
 */
export async function linkSplitThreads(accountId: string): Promise<number> {
  const db = await getDb();

  const links = await db.select<CrossLink[]>(
    `SELECT child.thread_id AS child_thread,
            parent.thread_id AS parent_thread,
            child_t.last_message_at AS child_date,
            parent_t.last_message_at AS parent_date
     FROM messages child
     JOIN messages parent
       ON parent.account_id = child.account_id
      AND parent.message_id_header = child.in_reply_to_header
     JOIN threads child_t
       ON child_t.account_id = child.account_id AND child_t.id = child.thread_id
     JOIN threads parent_t
       ON parent_t.account_id = parent.account_id AND parent_t.id = parent.thread_id
     WHERE child.account_id = $1
       AND child.in_reply_to_header IS NOT NULL
       AND child.in_reply_to_header <> ''
       AND child.thread_id <> parent.thread_id
       AND child_t.merged_into IS NULL
       AND parent_t.merged_into IS NULL`,
    [accountId],
  );

  if (links.length === 0) return 0;

  // Fold into the thread that started earlier: a conversation is named by how
  // it began, and this keeps the choice stable however the rows arrive.
  const targetOf = new Map<string, string>();
  for (const link of links) {
    const [target, source] = link.parent_date <= link.child_date
      ? [link.parent_thread, link.child_thread]
      : [link.child_thread, link.parent_thread];
    if (target === source) continue;
    // Follow any join already decided in this pass, so three split threads
    // collapse onto one rather than into a chain
    targetOf.set(source, resolve(targetOf, target));
  }

  let merged = 0;
  const bySource = new Map<string, string[]>();
  for (const [source, target] of targetOf) {
    const finalTarget = resolve(targetOf, target);
    if (finalTarget === source) continue;
    bySource.set(finalTarget, [...(bySource.get(finalTarget) ?? []), source]);
  }

  for (const [target, sources] of bySource) {
    try {
      await mergeThreads(accountId, target, sources);
      merged += sources.length;
    } catch (err) {
      console.error("Failed to rejoin split threads:", err);
    }
  }
  return merged;
}

/** Walk the map to the thread nothing else points away from. */
function resolve(targetOf: Map<string, string>, start: string): string {
  const seen = new Set<string>([start]);
  let current = start;
  for (;;) {
    const next = targetOf.get(current);
    if (!next || seen.has(next)) return current;
    seen.add(next);
    current = next;
  }
}

/**
 * Reply and forward prefixes, in the languages a European mailbox sees. Some
 * clients stack them ("AW: Re:") and some leave the separator behind ("Re: :"),
 * which is how one conversation ends up with two different subjects.
 */
const SUBJECT_PREFIX = /^\s*(?:(?:re|aw|fwd?|wg|antw|sv|vs|rif|ang|odp|betreff)\s*:\s*)+/i;

/** The subject two messages share once their clients stopped decorating it. */
export function normalizeSubject(subject: string | null): string {
  if (!subject) return "";
  let previous = subject;
  let stripped = subject.replace(SUBJECT_PREFIX, "");
  // Stacked prefixes come off one pass at a time
  while (stripped !== previous) {
    previous = stripped;
    stripped = stripped.replace(SUBJECT_PREFIX, "");
  }
  return stripped
    // A leftover separator from a stripped prefix, as in "Re: : Subject"
    .replace(/^[\s:>\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * How far apart two threads may be and still be the same conversation. A
 * monthly "Invoice" from the same sender is not one thread.
 */
const SUBJECT_MATCH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Subjects too generic to join two threads on their own. */
const GENERIC_SUBJECT = /^(hi|hello|hey|hallo|servus|moin|thanks|danke|fyi|info|update|invoice|rechnung|reminder|erinnerung|newsletter|question|frage|)$/i;

interface SubjectCandidate {
  id: string;
  subject: string | null;
  last_message_at: number;
  peers: string | null;
}

/**
 * Join threads that share a normalised subject and a correspondent.
 *
 * The headers do not always link — a client can start a fresh Message-ID
 * chain, and then only the subject and the people on it say the exchange
 * continued. Deliberately narrower than it could be: the subject has to match
 * exactly once decoration is stripped, a correspondent has to be shared, the
 * two must be within a month, and a bare "Hallo" never qualifies.
 */
export async function linkThreadsBySubject(accountId: string): Promise<number> {
  const db = await getDb();

  const rows = await db.select<SubjectCandidate[]>(
    `SELECT t.id, t.subject, t.last_message_at,
            (SELECT GROUP_CONCAT(DISTINCT LOWER(m.from_address))
             FROM messages m
             WHERE m.account_id = t.account_id AND m.thread_id = t.id) AS peers
     FROM threads t
     WHERE t.account_id = $1 AND t.merged_into IS NULL AND t.subject IS NOT NULL
     ORDER BY t.last_message_at ASC`,
    [accountId],
  );

  const groups = new Map<string, SubjectCandidate[]>();
  for (const row of rows) {
    const key = normalizeSubject(row.subject);
    if (key.length < 6 || GENERIC_SUBJECT.test(key)) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  let merged = 0;
  for (const candidates of groups.values()) {
    if (candidates.length < 2) continue;
    const [target, ...rest] = candidates;
    if (!target) continue;
    const targetPeers = new Set((target.peers ?? "").split(",").filter(Boolean));

    const sources = rest.filter((candidate) => {
      if (Math.abs(candidate.last_message_at - target.last_message_at) > SUBJECT_MATCH_WINDOW_MS) {
        return false;
      }
      // Someone has to be on both sides, or this is two people using the
      // same words rather than one conversation
      return (candidate.peers ?? "")
        .split(",")
        .some((peer) => peer && targetPeers.has(peer));
    });

    if (sources.length === 0) continue;
    try {
      await mergeThreads(accountId, target.id, sources.map((s) => s.id));
      merged += sources.length;
    } catch (err) {
      console.error("Failed to join threads by subject:", err);
    }
  }
  return merged;
}
