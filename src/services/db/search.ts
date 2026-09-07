import { getDb } from "./connection";
import { parseSearchQuery } from "../search/searchParser";
import { buildSearchQuery, type SearchScope } from "../search/searchQueryBuilder";

export interface SearchResult {
  message_id: string;
  account_id: string;
  thread_id: string;
  subject: string | null;
  from_name: string | null;
  from_address: string | null;
  snippet: string | null;
  date: number;
  rank: number;
}

/**
 * Full-text search across messages using FTS5.
 * Supports search operators: from:, to:, subject:, has:attachment, is:unread, etc.
 */
export async function searchMessages(
  query: string,
  accountId?: string,
  limit = 50,
  scope: SearchScope = {},
): Promise<SearchResult[]> {
  const db = await getDb();

  const ftsQuery = query.trim();
  if (!ftsQuery) return [];

  const { sql, params } = buildSearchQuery(parseSearchQuery(ftsQuery), accountId, limit, scope);
  return db.select<SearchResult[]>(sql, params);
}
