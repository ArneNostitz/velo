import { describe, it, expect } from "vitest";
import { buildSearchQuery, type SearchSort } from "./searchQueryBuilder";
import type { ParsedSearchQuery } from "./searchParser";

describe("buildSearchQuery", () => {
  it("builds FTS query for free text only", () => {
    const parsed: ParsedSearchQuery = { freeText: "hello world" };
    const { sql, params } = buildSearchQuery(parsed);
    expect(sql).toContain("messages_fts MATCH");
    expect(sql).toContain("ORDER BY COALESCE(search_thread.last_message_at, m.date) DESC");
    expect(params[0]).toBe('"hello" AND "world"');
  });

  it("builds from: filter", () => {
    const parsed: ParsedSearchQuery = { freeText: "", from: "john" };
    const { sql, params } = buildSearchQuery(parsed);
    expect(sql).toContain("m.from_address LIKE");
    expect(sql).toContain("m.from_name LIKE");
    expect(params).toContain("john");
  });

  it("builds to: filter", () => {
    const parsed: ParsedSearchQuery = { freeText: "", to: "jane" };
    const { sql, params } = buildSearchQuery(parsed);
    expect(sql).toContain("m.to_addresses LIKE");
    expect(params).toContain("jane");
  });

  it("builds subject: filter", () => {
    const parsed: ParsedSearchQuery = { freeText: "", subject: "meeting" };
    const { sql, params } = buildSearchQuery(parsed);
    expect(sql).toContain("m.subject LIKE");
    expect(params).toContain("meeting");
  });

  it("builds has:attachment filter", () => {
    const parsed: ParsedSearchQuery = { freeText: "", hasAttachment: true };
    const { sql } = buildSearchQuery(parsed);
    expect(sql).toContain("EXISTS (SELECT 1 FROM attachments");
  });

  it("builds is:unread filter", () => {
    const parsed: ParsedSearchQuery = { freeText: "", isUnread: true };
    const { sql } = buildSearchQuery(parsed);
    expect(sql).toContain("m.is_read = 0");
  });

  it("builds is:read filter", () => {
    const parsed: ParsedSearchQuery = { freeText: "", isRead: true };
    const { sql } = buildSearchQuery(parsed);
    expect(sql).toContain("m.is_read = 1");
  });

  it("builds is:starred filter", () => {
    const parsed: ParsedSearchQuery = { freeText: "", isStarred: true };
    const { sql } = buildSearchQuery(parsed);
    expect(sql).toContain("m.is_starred = 1");
  });

  it("builds before: date filter", () => {
    const ts = Math.floor(new Date(2024, 0, 15).getTime() / 1000);
    const parsed: ParsedSearchQuery = { freeText: "", before: ts };
    const { sql, params } = buildSearchQuery(parsed);
    expect(sql).toContain("m.date <");
    expect(params).toContain(ts);
  });

  it("builds after: date filter", () => {
    const ts = Math.floor(new Date(2024, 5, 1).getTime() / 1000);
    const parsed: ParsedSearchQuery = { freeText: "", after: ts };
    const { sql, params } = buildSearchQuery(parsed);
    expect(sql).toContain("m.date >");
    expect(params).toContain(ts);
  });

  it("builds label: filter", () => {
    const parsed: ParsedSearchQuery = { freeText: "", label: "work" };
    const { sql, params } = buildSearchQuery(parsed);
    expect(sql).toContain("LOWER(l.name) = LOWER");
    expect(params).toContain("work");
  });

  it("adds account filter when provided", () => {
    const parsed: ParsedSearchQuery = { freeText: "test" };
    const { sql, params } = buildSearchQuery(parsed, "account-123");
    expect(sql).toContain("m.account_id =");
    expect(params).toContain("account-123");
  });

  it("respects limit parameter", () => {
    const parsed: ParsedSearchQuery = { freeText: "test" };
    const { sql, params } = buildSearchQuery(parsed, undefined, 25);
    expect(sql).toContain("LIMIT");
    expect(params[params.length - 1]).toBe(25);
  });

  it("combines free text with operators", () => {
    const parsed: ParsedSearchQuery = {
      freeText: "budget",
      from: "john",
      isUnread: true,
    };
    const { sql, params } = buildSearchQuery(parsed);
    expect(sql).toContain("messages_fts MATCH");
    expect(sql).toContain("m.from_address LIKE");
    expect(sql).toContain("m.is_read = 0");
    expect(params).toContain('"budget"');
    expect(params).toContain("john");
  });

  it("defaults to newest thread activity when no free text", () => {
    const parsed: ParsedSearchQuery = { freeText: "", isUnread: true };
    const { sql } = buildSearchQuery(parsed);
    expect(sql).toContain("ORDER BY COALESCE(search_thread.last_message_at, m.date) DESC");
    expect(sql).not.toContain("ORDER BY rank");
  });

  it("uses rank ordering when relevance is explicitly requested with free text", () => {
    const parsed: ParsedSearchQuery = { freeText: "test", isUnread: true };
    const { sql } = buildSearchQuery(parsed, undefined, 50, { sort: "relevance" });
    expect(sql).toContain("ORDER BY rank ASC, COALESCE(search_thread.last_message_at, m.date) DESC");
  });

  describe.each(["test", "te", ""])("sorting with free text %j", (freeText) => {
    it.each<{ sort: SearchSort; direction: string }>([
      { sort: "newest", direction: "DESC" },
      { sort: "oldest", direction: "ASC" },
      { sort: "relevance", direction: "DESC" },
    ])("applies $sort with stable ties before the limit", ({ sort, direction }) => {
      const { sql, params } = buildSearchQuery({ freeText }, undefined, 2, { sort });
      const rankOrder = sort === "relevance" && freeText === "test" ? "rank ASC, " : "";
      expect(sql).toContain(
        "LEFT JOIN threads search_thread ON search_thread.account_id = m.account_id AND search_thread.id = m.thread_id",
      );
      expect(sql.replace(/\s+/g, " ").trim()).toContain(
        `ORDER BY ${rankOrder}COALESCE(search_thread.last_message_at, m.date) ${direction}, m.account_id ASC, m.thread_id ASC, m.date DESC, m.id ASC LIMIT $${params.length}`,
      );
      expect(params[params.length - 1]).toBe(2);
    });
  });

  it("uses parameterized queries (no SQL injection)", () => {
    const parsed: ParsedSearchQuery = {
      freeText: "",
      from: "'; DROP TABLE messages; --",
    };
    const { sql, params } = buildSearchQuery(parsed);
    // The value should be in params, not interpolated into SQL
    expect(sql).not.toContain("DROP TABLE");
    expect(params).toContain("'; DROP TABLE messages; --");
  });
});
