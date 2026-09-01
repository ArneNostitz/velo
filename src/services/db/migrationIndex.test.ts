import { describe, it, expect } from "vitest";
import { MIGRATIONS } from "./migrations";

describe("migration 28 — the read-receipt index", () => {
  const m28 = MIGRATIONS.find((m) => m.version === 28);

  it("exists", () => {
    expect(m28).toBeDefined();
  });

  it("replaces the index that could not serve a per-thread lookup", () => {
    // (account_id, is_read_receipt) matched thousands of rows per account and
    // left thread_id to a scan, so the EXISTS in every list query walked the
    // whole mailbox — 13ms became 5.7s on a 7k-message database
    expect(m28!.sql).toContain("DROP INDEX IF EXISTS idx_messages_is_read_receipt");
    expect(m28!.sql).toContain("messages(account_id, thread_id, is_read_receipt)");
  });

  it("is the newest migration", () => {
    expect(Math.max(...MIGRATIONS.map((m) => m.version))).toBe(28);
  });
});
