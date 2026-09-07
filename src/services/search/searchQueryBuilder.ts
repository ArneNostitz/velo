import type { ParsedSearchQuery } from "./searchParser";

interface BuiltQuery {
  sql: string;
  params: unknown[];
}

export interface SearchScope {
  labelIds?: string[];
  excludeSpamTrash?: boolean;
  accountIds?: string[];
  savedQuery?: ParsedSearchQuery;
}

/**
 * Build a parameterized SQL query from a parsed search query.
 * Returns { sql, params } for safe execution.
 */
export function buildSearchQuery(
  parsed: ParsedSearchQuery,
  accountId?: string,
  limit = 50,
  scope: SearchScope = {},
): BuiltQuery {
  const params: unknown[] = [];
  let paramIdx = 1;

  const whereClauses: string[] = [];
  let needsFts = false;

  // Base query - we'll add FTS join conditionally
  let fromClause = "FROM messages m";

  // Free text search via FTS5
  if (parsed.freeText) {
    const terms = (parsed.freeText.match(/"[^"]+"|\S+/g) ?? []).map((term) =>
      term.replace(/^"|"$/g, ""),
    );
    const indexed = terms.filter((term) => [...term].length >= 3);
    if (indexed.length) {
      needsFts = true;
      fromClause =
        "FROM messages_fts JOIN messages m ON m.rowid = messages_fts.rowid";
      whereClauses.push(`messages_fts MATCH $${paramIdx}`);
      params.push(
        indexed.map((term) => `"${term.replace(/"/g, '""')}"`).join(" AND "),
      );
      paramIdx++;
    }
    // Trigram MATCH cannot find terms shorter than three characters. Only
    // those terms use a literal scan; longer terms still narrow via FTS.
    for (const term of terms.filter((term) => [...term].length < 3)) {
      whereClauses.push(
        `instr(lower(COALESCE(m.subject,'') || ' ' || COALESCE(m.from_name,'') || ' ' || COALESCE(m.from_address,'') || ' ' || COALESCE(m.body_text,'') || ' ' || COALESCE(m.snippet,'')), lower($${paramIdx++})) > 0`,
      );
      params.push(term);
    }
  }

  if (scope.accountIds) {
    whereClauses.push(
      `m.account_id IN (${
        scope.accountIds
          .map((id) => {
            params.push(id);
            return `$${paramIdx++}`;
          })
          .join(",") || "NULL"
      })`,
    );
  }
  if (scope.labelIds?.length) {
    const placeholders = scope.labelIds.map((id) => {
      params.push(id);
      return `$${paramIdx++}`;
    });
    whereClauses.push(
      `EXISTS (SELECT 1 FROM thread_labels scoped WHERE scoped.account_id=m.account_id AND scoped.thread_id=m.thread_id AND scoped.label_id IN (${placeholders.join(",")}))`,
    );
  }
  if (scope.excludeSpamTrash) {
    whereClauses.push(
      "NOT EXISTS (SELECT 1 FROM thread_labels excluded WHERE excluded.account_id=m.account_id AND excluded.thread_id=m.thread_id AND excluded.label_id IN ('SPAM','TRASH'))",
    );
  }
  if (scope.savedQuery) {
    const saved = buildSearchQuery(scope.savedQuery, accountId, -1);
    const shifted = saved.sql.replace(
      /\$(\d+)/g,
      (_, index: string) => `$${Number(index) + paramIdx - 1}`,
    );
    whereClauses.push(
      `(m.account_id, m.id) IN (SELECT saved.account_id, saved.message_id FROM (${shifted}) saved)`,
    );
    params.push(...saved.params);
    paramIdx += saved.params.length;
  }

  // Account filter
  if (accountId) {
    whereClauses.push(`m.account_id = $${paramIdx}`);
    params.push(accountId);
    paramIdx++;
  }

  // from: operator
  if (parsed.from) {
    whereClauses.push(
      `(m.from_address LIKE '%' || $${paramIdx} || '%' OR m.from_name LIKE '%' || $${paramIdx} || '%')`,
    );
    params.push(parsed.from);
    paramIdx++;
  }

  // to: operator
  if (parsed.to) {
    whereClauses.push(`m.to_addresses LIKE '%' || $${paramIdx} || '%'`);
    params.push(parsed.to);
    paramIdx++;
  }

  // subject: operator
  if (parsed.subject) {
    whereClauses.push(`m.subject LIKE '%' || $${paramIdx} || '%'`);
    params.push(parsed.subject);
    paramIdx++;
  }

  // has:attachment
  if (parsed.hasAttachment) {
    whereClauses.push(
      `EXISTS (SELECT 1 FROM attachments a WHERE a.account_id = m.account_id AND a.message_id = m.id)`,
    );
  }

  // is:unread
  if (parsed.isUnread) {
    whereClauses.push(`m.is_read = 0`);
  }

  // is:read
  if (parsed.isRead) {
    whereClauses.push(`m.is_read = 1`);
  }

  // is:starred
  if (parsed.isStarred) {
    whereClauses.push(`m.is_starred = 1`);
  }

  // before: date
  if (parsed.before !== undefined) {
    whereClauses.push(`m.date < $${paramIdx}`);
    params.push(parsed.before);
    paramIdx++;
  }

  // after: date
  if (parsed.after !== undefined) {
    whereClauses.push(`m.date > $${paramIdx}`);
    params.push(parsed.after);
    paramIdx++;
  }

  // label: operator
  if (parsed.label) {
    whereClauses.push(
      `EXISTS (SELECT 1 FROM thread_labels tl JOIN labels l ON l.account_id = tl.account_id AND l.id = tl.label_id WHERE tl.account_id = m.account_id AND tl.thread_id = m.thread_id AND LOWER(l.name) = LOWER($${paramIdx}))`,
    );
    params.push(parsed.label);
    paramIdx++;
  }

  const whereStr =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const orderBy = needsFts ? "ORDER BY rank" : "ORDER BY m.date DESC";

  params.push(limit);

  const sql = `SELECT DISTINCT
    m.id as message_id,
    m.account_id,
    m.thread_id,
    m.subject,
    m.from_name,
    m.from_address,
    m.snippet,
    m.date,
    ${needsFts ? "rank" : "0 as rank"}
  ${fromClause}
  ${whereStr}
  ${orderBy}
  LIMIT $${paramIdx}`;

  return { sql, params };
}
