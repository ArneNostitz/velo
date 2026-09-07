// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { buildSearchQuery, type SearchScope } from "./searchQueryBuilder";
import { parseSearchQuery } from "./searchParser";

describe("search against SQLite FTS5", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE messages(id TEXT, account_id TEXT, thread_id TEXT, subject TEXT, from_name TEXT, from_address TEXT, snippet TEXT, body_text TEXT, date INTEGER);
    CREATE VIRTUAL TABLE messages_fts USING fts5(subject, from_name, from_address, body_text, snippet, content='messages', content_rowid='rowid', tokenize='trigram');
    CREATE TABLE thread_labels(account_id TEXT, thread_id TEXT, label_id TEXT);
    CREATE TABLE labels(account_id TEXT, id TEXT, name TEXT);
    INSERT INTO messages VALUES ('1','a','t1','invoice ACME-2026','Arne','a@example.com','invoice','',1), ('2','a','t2','invoice ACME-2026','Arne','a@example.com','invoice','',2), ('3','b','t3','invoice ACME-2026','Arne','a@example.com','invoice','',3);
    INSERT INTO thread_labels VALUES ('a','t1','INBOX'), ('a','t2','SPAM'), ('b','t3','TRASH');
    INSERT INTO messages_fts(messages_fts) VALUES('rebuild');
  `);
  afterAll(() => db.close());
  function search(query: string, scope: SearchScope = {}) {
    const { sql, params } = buildSearchQuery(
      parseSearchQuery(query),
      undefined,
      50,
      scope,
    );
    return db
      .prepare(sql)
      .all(Object.fromEntries(params.map((v, i) => [`$${i + 1}`, v])) as never);
  }
  it("treats punctuation and email addresses literally", () => {
    expect(search("ACME-2026 a@example.com")).toHaveLength(3);
    expect(() => search("invoice (unlikely)")).not.toThrow();
  });
  it("limits folder matches before returning results", () => {
    expect(search("invoice", { labelIds: ["INBOX"] })).toHaveLength(1);
    expect(search("invoice", { excludeSpamTrash: true })).toHaveLength(1);
    expect(
      search("invoice", { labelIds: ["SPAM"], accountIds: ["a"] }),
    ).toHaveLength(1);
    expect(search("invoice", { accountIds: [] })).toHaveLength(0);
    expect(search("invoice")).toHaveLength(3);
  });
  it("finds short search terms which trigram MATCH cannot match", () => {
    expect(search("AC")).toHaveLength(3);
    expect(search("invoice AC")).toHaveLength(3);
  });
  it("intersects saved-folder criteria with the typed search", () => {
    expect(
      search("invoice", { savedQuery: parseSearchQuery("after:2099/01/01") }),
    ).toHaveLength(0);
    expect(
      search("invoice", { savedQuery: parseSearchQuery("ACME-2026") }),
    ).toHaveLength(3);
  });
});
