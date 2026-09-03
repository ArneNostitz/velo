/**
 * Whether a thread belongs in Sent.
 *
 * Gmail applies SENT to anything the account transmitted, which includes
 * mail an app relayed through it: matchMii sends its login mails through the
 * user's account, so each one is filed as Sent and delivered to the inbox at
 * once. To the person reading, that mail arrived — it was not written.
 *
 * So Sent means: the user wrote a message in this thread to someone other
 * than themselves. A relayed mail fails on the From (a stranger's address,
 * or the user's address rewritten onto a mail addressed back to them), and a
 * note to oneself fails on the To. Both stay in the inbox, where they landed.
 */
export interface SentCheckMessage {
  fromAddress: string | null;
  toAddresses: string | null;
  ccAddresses?: string | null;
}

export function shouldKeepSentLabel(
  messages: SentCheckMessage[],
  ownAddresses: Set<string>,
): boolean {
  return messages.some((m) => {
    const from = m.fromAddress?.toLowerCase();
    if (!from || !ownAddresses.has(from)) return false;
    const recipients = extractAddresses(`${m.toAddresses ?? ""},${m.ccAddresses ?? ""}`);
    return recipients.some((r) => !ownAddresses.has(r));
  });
}

/** Bare, lowercased addresses out of a To/Cc header value. */
function extractAddresses(header: string): string[] {
  const out: string[] = [];
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header)) !== null) out.push(m[0].toLowerCase());
  return out;
}

/**
 * Apply the rule to threads already in the database.
 *
 * Runs each sync over every thread carrying both INBOX and SENT — a small
 * set — and drops SENT where nothing in the thread was written by the user
 * to someone else. Returns how many threads moved out of Sent.
 */
export async function pruneRelayedSentLabels(
  accountId: string,
  ownAddresses: Set<string>,
): Promise<number> {
  if (ownAddresses.size === 0) return 0;
  const { getDb } = await import("@/services/db/connection");
  const { removeThreadLabel } = await import("@/services/db/threads");
  const db = await getDb();

  const threads = await db.select<{ thread_id: string }[]>(
    `SELECT s.thread_id FROM thread_labels s
     JOIN thread_labels i ON i.account_id = s.account_id AND i.thread_id = s.thread_id AND i.label_id = 'INBOX'
     WHERE s.account_id = $1 AND s.label_id = 'SENT'`,
    [accountId],
  );
  if (threads.length === 0) return 0;

  let pruned = 0;
  for (const { thread_id } of threads) {
    const messages = await db.select<{ from_address: string | null; to_addresses: string | null; cc_addresses: string | null }[]>(
      "SELECT from_address, to_addresses, cc_addresses FROM messages WHERE account_id = $1 AND thread_id = $2",
      [accountId, thread_id],
    );
    const keep = shouldKeepSentLabel(
      messages.map((m) => ({ fromAddress: m.from_address, toAddresses: m.to_addresses, ccAddresses: m.cc_addresses })),
      ownAddresses,
    );
    if (!keep) {
      await removeThreadLabel(accountId, thread_id, "SENT");
      pruned++;
    }
  }
  return pruned;
}

const OWN_TTL_MS = 60_000;
const ownCache = new Map<string, { at: number; own: Set<string> }>();

/**
 * The user's addresses for an account, remembered for a minute. The check
 * runs once per thread per sync, and the alias table does not change that
 * often.
 */
export async function cachedOwnAddresses(accountId: string): Promise<Set<string>> {
  const hit = ownCache.get(accountId);
  if (hit && Date.now() - hit.at < OWN_TTL_MS) return hit.own;
  const { getAllAccounts } = await import("@/services/db/accounts");
  const { collectOwnAddresses } = await import("@/services/accounts/ownAddresses");
  const accounts = await getAllAccounts();
  const list = await collectOwnAddresses(
    accounts as unknown as Parameters<typeof collectOwnAddresses>[0],
    [accountId],
  );
  const own = new Set(list.map((a) => a.toLowerCase()));
  ownCache.set(accountId, { at: Date.now(), own });
  return own;
}
