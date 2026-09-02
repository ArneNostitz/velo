import { describe, it, expect } from "vitest";
import { splitStatements, MIGRATIONS } from "./migrations";

describe("splitStatements", () => {
  it("does not let a semicolon inside a comment split the next statement", () => {
    // Exactly how migration 29 shipped broken: prose with a semicolon in it,
    // which cut "ALTER TABLE" off from its own statement
    const sql = `
      -- one thing; and another
      ALTER TABLE threads ADD COLUMN merged_into TEXT;
      CREATE INDEX idx_x ON threads(merged_into);
    `;
    const parts = splitStatements(sql);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("ALTER TABLE threads ADD COLUMN merged_into TEXT");
    expect(parts[1]).toContain("CREATE INDEX idx_x");
  });

  it("ignores a semicolon inside a block comment", () => {
    const parts = splitStatements("/* a; b */ SELECT 1; SELECT 2;");
    expect(parts).toHaveLength(2);
  });

  it("ignores a semicolon inside a string literal", () => {
    const parts = splitStatements("INSERT INTO t VALUES ('a;b'); SELECT 1;");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("'a;b'");
  });

  it("still keeps a BEGIN...END trigger body in one piece", () => {
    const sql = `
      CREATE TRIGGER t AFTER INSERT ON x BEGIN
        UPDATE y SET a = 1;
        UPDATE z SET b = 2;
      END;
      SELECT 1;
    `;
    const parts = splitStatements(sql);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("CREATE TRIGGER");
    expect(parts[0]).toContain("UPDATE z SET b = 2");
  });

  it("splits ordinary statements as before", () => {
    expect(splitStatements("SELECT 1; SELECT 2; SELECT 3;")).toHaveLength(3);
  });
});

describe("every migration splits into runnable statements", () => {
  // Once its leading comments are stripped, a statement must start with a SQL
  // verb. Anything else means a comment or a literal swallowed the split —
  // the failure that left the app with no accounts.
  const VERB = /^(ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|PRAGMA|BEGIN|COMMIT|WITH|SELECT|REPLACE)\b/i;

  function stripComments(statement: string): string {
    let rest = statement.trim();
    for (;;) {
      if (rest.startsWith("--")) {
        const nl = rest.indexOf("\n");
        rest = nl === -1 ? "" : rest.slice(nl + 1).trim();
        continue;
      }
      if (rest.startsWith("/*")) {
        const close = rest.indexOf("*/");
        rest = close === -1 ? "" : rest.slice(close + 2).trim();
        continue;
      }
      return rest;
    }
  }

  for (const migration of MIGRATIONS) {
    it(`v${migration.version}: ${migration.description}`, () => {
      for (const statement of splitStatements(migration.sql)) {
        const body = stripComments(statement);
        if (body === "") continue; // a trailing comment is not a statement
        expect(body, `bad statement in v${migration.version}: ${body.slice(0, 60)}`)
          .toMatch(VERB);
      }
    });
  }
});
