// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { buildSearchQuery, type SearchScope } from "./searchQueryBuilder";
import { parseSearchQuery } from "./searchParser";

describe("search against SQLite FTS5", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE messages(id TEXT, account_id TEXT, thread_id TEXT, subject TEXT, from_name TEXT, from_address TEXT, snippet TEXT, body_text TEXT, date INTEGER);
    CREATE TABLE threads(account_id TEXT, id TEXT, last_message_at INTEGER, PRIMARY KEY(account_id, id));
    CREATE VIRTUAL TABLE messages_fts USING fts5(subject, from_name, from_address, body_text, snippet, content='messages', content_rowid='rowid', tokenize='trigram');
    CREATE TABLE thread_labels(account_id TEXT, thread_id TEXT, label_id TEXT);
    CREATE TABLE labels(account_id TEXT, id TEXT, name TEXT);
    INSERT INTO messages VALUES ('1','a','t1','invoice ACME-2026','Arne','a@example.com','invoice','Your payment invoice is ready to review',1), ('2','a','t2','invoice ACME-2026','Arne','a@example.com','invoice','',2), ('3','b','t3','invoice ACME-2026','Arne','a@example.com','invoice','',3);
    INSERT INTO threads VALUES ('a','t1',1), ('a','t2',2), ('b','t3',3);
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
  it("returns a compact excerpt centered on a body match", () => {
    const [result] = search("payment") as { match_excerpt: string }[];
    expect(result!.match_excerpt).toContain("payment invoice");
    expect(result!.match_excerpt.length).toBeLessThanOrEqual(240);
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

describe("search result ordering against SQLite FTS5", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE messages(id TEXT, account_id TEXT, thread_id TEXT, subject TEXT, from_name TEXT, from_address TEXT, snippet TEXT, body_text TEXT, date INTEGER);
    CREATE TABLE threads(account_id TEXT, id TEXT, last_message_at INTEGER, PRIMARY KEY(account_id, id));
    CREATE VIRTUAL TABLE messages_fts USING fts5(subject, from_name, from_address, body_text, snippet, content='messages', content_rowid='rowid', tokenize='trigram');
    INSERT INTO threads VALUES
      ('a','shared',300), ('b','shared',100),
      ('a','z-thread',300), ('b','a-thread',300), ('a','null-date',NULL);
    INSERT INTO messages VALUES
      ('other-account','b','shared','needle','Sender','sender@demo.org','','filler filler filler',500),
      ('z-old-message','a','shared','needle','Sender','sender@demo.org','','needle needle needle',10),
      ('id-b','a','shared','needle','Sender','sender@demo.org','','filler filler filler',20),
      ('thread-tie','a','z-thread','needle','Sender','sender@demo.org','','filler filler filler',400),
      ('account-tie','b','a-thread','needle','Sender','sender@demo.org','','filler filler filler',600),
      ('id-a','a','shared','needle','Sender','sender@demo.org','','filler filler filler',20),
      ('newer-message','a','shared','needle','Sender','sender@demo.org','','filler filler filler',30),
      ('null-date','a','null-date','needle','Sender','sender@demo.org','','filler filler filler',200),
      ('orphan','a','missing-thread','needle','Sender','sender@demo.org','','filler filler filler',250);
    INSERT INTO messages_fts(messages_fts) VALUES('rebuild');
  `);
  afterAll(() => db.close());

  function search(query: string, scope: SearchScope = {}, limit = 50) {
    const { sql, params } = buildSearchQuery(parseSearchQuery(query), undefined, limit, scope);
    return db.prepare(sql).all(
      Object.fromEntries(params.map((value, index) => [`$${index + 1}`, value])) as never,
    ) as { message_id: string; account_id: string; rank: number }[];
  }

  // Equal thread dates resolve by account, then thread, then descending message
  // date, then message ID. Insertion order deliberately disagrees with those ties.
  const newest = [
    "newer-message", "id-a", "id-b", "z-old-message", "thread-tie",
    "account-tie", "orphan", "null-date", "other-account",
  ];
  const oldest = [
    "other-account", "null-date", "orphan", "newer-message", "id-a",
    "id-b", "z-old-message", "thread-tie", "account-tie",
  ];
  const relevance = [
    "z-old-message", "newer-message", "id-a", "id-b", "thread-tie",
    "account-tie", "orphan", "null-date", "other-account",
  ];

  describe.each(["needle", "ne", "subject:needle"])("query %j", (query) => {
    it("defaults to newest thread activity with stable ties", () => {
      expect(search(query).map((row) => row.message_id)).toEqual(newest);
    });

    it.each<{ sort: "newest" | "oldest"; expected: string[] }>([
      { sort: "newest", expected: newest },
      { sort: "oldest", expected: oldest },
    ])("sorts $sort by thread date with stable ties before limiting", ({ sort, expected }) => {
      expect(search(query, { sort }).map((row) => row.message_id)).toEqual(expected);
      expect(search(query, { sort }, 2).map((row) => row.message_id)).toEqual(expected.slice(0, 2));
    });

    it("uses relevance only with FTS and applies the limit after sorting", () => {
      const expected = query === "needle" ? relevance : newest;
      expect(search(query, { sort: "relevance" }).map((row) => row.message_id)).toEqual(expected);
      expect(search(query, { sort: "relevance" }, 2).map((row) => row.message_id)).toEqual(expected.slice(0, 2));
    });
  });

  it("ranks the stronger text match first and resolves equal ranks chronologically", () => {
    const results = search("needle", { sort: "relevance" });
    expect(results.map((row) => row.message_id)).toEqual(relevance);
    expect(results[0]!.rank).toBeLessThan(results[1]!.rank);
    expect(new Set(results.slice(1).map((row) => row.rank)).size).toBe(1);
  });

  it("joins shared thread IDs to the matching account before sorting and limiting", () => {
    expect(search("needle", { accountIds: ["b"], sort: "newest" }).map((row) => [row.account_id, row.message_id])).toEqual([
      ["b", "account-tie"], ["b", "other-account"],
    ]);
    expect(search("needle", { accountIds: ["b"], sort: "oldest" }, 1).map((row) => row.message_id)).toEqual(["other-account"]);
  });

  it("falls back to message dates for missing threads and null thread dates", () => {
    expect(search("needle", { sort: "newest" }).filter((row) => ["orphan", "null-date"].includes(row.message_id)).map((row) => row.message_id)).toEqual(["orphan", "null-date"]);
    expect(search("needle", { sort: "oldest" }).filter((row) => ["orphan", "null-date"].includes(row.message_id)).map((row) => row.message_id)).toEqual(["null-date", "orphan"]);
  });
});
