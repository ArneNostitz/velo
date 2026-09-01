import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/services/db/connection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/db/connection")>();
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

import { getDb } from "@/services/db/connection";
import {
  muteThread,
  unmuteThread,
  getMutedThreadIds,
  deleteAllThreadsForAccount,
  getThreadsForAccounts,
  getThreadsForCategoryAcrossAccounts,
  getThreadsWithContact,
} from "./threads";
import { createMockDb } from "@/test/mocks";

const mockDb = createMockDb();

describe("threads service - deleteAllThreadsForAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDb>>);
  });

  it("deletes all threads for the given account", async () => {
    await deleteAllThreadsForAccount("acc-1");

    expect(mockDb.execute).toHaveBeenCalledWith(
      "DELETE FROM threads WHERE account_id = $1",
      ["acc-1"],
    );
  });
});

describe("threads service - mute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDb>>);
  });

  describe("muteThread", () => {
    it("calls db.execute with correct SQL to set is_muted = 1", async () => {
      await muteThread("acc-1", "thread-1");

      expect(mockDb.execute).toHaveBeenCalledWith(
        "UPDATE threads SET is_muted = 1 WHERE account_id = $1 AND id = $2",
        ["acc-1", "thread-1"],
      );
    });
  });

  describe("unmuteThread", () => {
    it("calls db.execute with correct SQL to set is_muted = 0", async () => {
      await unmuteThread("acc-1", "thread-1");

      expect(mockDb.execute).toHaveBeenCalledWith(
        "UPDATE threads SET is_muted = 0 WHERE account_id = $1 AND id = $2",
        ["acc-1", "thread-1"],
      );
    });
  });

  describe("getMutedThreadIds", () => {
    it("returns a Set of muted thread IDs", async () => {
      mockDb.select.mockResolvedValueOnce([
        { id: "thread-1" },
        { id: "thread-3" },
      ]);

      const result = await getMutedThreadIds("acc-1");

      expect(mockDb.select).toHaveBeenCalledWith(
        "SELECT id FROM threads WHERE account_id = $1 AND is_muted = 1",
        ["acc-1"],
      );
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has("thread-1")).toBe(true);
      expect(result.has("thread-3")).toBe(true);
    });

    it("returns an empty Set when no threads are muted", async () => {
      mockDb.select.mockResolvedValueOnce([]);

      const result = await getMutedThreadIds("acc-1");

      expect(result.size).toBe(0);
    });
  });
});


describe("threads service - unified inbox queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDb>>);
    mockDb.select.mockResolvedValue([]);
  });

  /** The SQL and bound parameters of the last select. */
  function lastSelect(): { sql: string; params: unknown[] } {
    const call = mockDb.select.mock.calls.at(-1)!;
    return { sql: call[0] as string, params: call[1] as unknown[] };
  }

  it("does not query at all for an empty account list", async () => {
    await expect(getThreadsForAccounts([])).resolves.toEqual([]);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("binds one placeholder per account, then limit and offset", async () => {
    await getThreadsForAccounts(["a", "b", "c"], undefined, 25, 50);
    const { sql, params } = lastSelect();
    expect(sql).toContain("t.account_id IN ($1, $2, $3)");
    expect(sql).toContain("LIMIT $4 OFFSET $5");
    expect(params).toEqual(["a", "b", "c", 25, 50]);
  });

  it("numbers the label placeholder after the accounts", async () => {
    await getThreadsForAccounts(["a", "b"], "INBOX", 10, 0);
    const { sql, params } = lastSelect();
    expect(sql).toContain("t.account_id IN ($1, $2)");
    expect(sql).toContain("tl.label_id = $3");
    expect(sql).toContain("LIMIT $4 OFFSET $5");
    expect(params).toEqual(["a", "b", "INBOX", 10, 0]);
  });

  it("still works for a single account", async () => {
    await getThreadsForAccounts(["only"], "SENT", 50, 0);
    const { sql, params } = lastSelect();
    expect(sql).toContain("t.account_id IN ($1)");
    expect(params).toEqual(["only", "SENT", 50, 0]);
  });

  it("treats Primary as including uncategorized threads", async () => {
    await getThreadsForCategoryAcrossAccounts(["a", "b"], "Primary", 50, 0);
    const { sql, params } = lastSelect();
    expect(sql).toContain("t.account_id IN ($1, $2)");
    expect(sql).toContain("tc.category IS NULL OR tc.category = 'Primary'");
    expect(sql).toContain("LIMIT $3 OFFSET $4");
    expect(params).toEqual(["a", "b", 50, 0]);
  });

  it("binds the category after the accounts for other categories", async () => {
    await getThreadsForCategoryAcrossAccounts(["a", "b", "c"], "Promotions", 20, 40);
    const { sql, params } = lastSelect();
    expect(sql).toContain("t.account_id IN ($1, $2, $3)");
    expect(sql).toContain("tc.category = $4");
    expect(sql).toContain("LIMIT $5 OFFSET $6");
    expect(params).toEqual(["a", "b", "c", "Promotions", 20, 40]);
  });

  it("orders across accounts by date rather than grouping by mailbox", async () => {
    await getThreadsForAccounts(["a", "b"]);
    const { sql } = lastSelect();
    expect(sql).toContain("ORDER BY t.is_pinned DESC, t.last_message_at DESC");
  });

  it("skips the category query for an empty account list", async () => {
    await expect(getThreadsForCategoryAcrossAccounts([], "Primary")).resolves.toEqual([]);
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});


describe("threads service - naming the other party", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDb>>);
    mockDb.select.mockResolvedValue([]);
  });

  function lastSelect(): { sql: string; params: unknown[] } {
    const call = mockDb.select.mock.calls.at(-1)!;
    return { sql: call[0] as string, params: call[1] as unknown[] };
  }

  it("does not join for the other party when no own addresses are known", async () => {
    await getThreadsForAccounts(["a"], "INBOX", 50, 0, []);
    const { sql, params } = lastSelect();
    expect(sql).not.toContain("peer_address");
    expect(params).toEqual(["a", "INBOX", 50, 0]);
  });

  it("selects the last message that is not from the user", async () => {
    await getThreadsForAccounts(["a"], "INBOX", 50, 0, ["me@x.com", "alias@y.com"]);
    const { sql, params } = lastSelect();
    expect(sql).toContain("peer_address");
    expect(sql).toContain("NOT IN ($3, $4)");
    expect(sql).toContain("LIMIT $5 OFFSET $6");
    expect(params).toEqual(["a", "INBOX", "me@x.com", "alias@y.com", 50, 0]);
  });

  it("compares addresses case-insensitively", async () => {
    await getThreadsForAccounts(["a"], undefined, 50, 0, ["Me@X.com"]);
    const { sql, params } = lastSelect();
    expect(sql).toContain("LOWER(COALESCE(m3.from_address, ''))");
    expect(params).toContain("me@x.com");
  });

  it("numbers placeholders correctly for the category query", async () => {
    await getThreadsForCategoryAcrossAccounts(["a", "b"], "Promotions", 25, 5, ["me@x.com"]);
    const { sql, params } = lastSelect();
    expect(sql).toContain("t.account_id IN ($1, $2)");
    expect(sql).toContain("tc.category = $3");
    expect(sql).toContain("NOT IN ($4)");
    expect(sql).toContain("LIMIT $5 OFFSET $6");
    expect(params).toEqual(["a", "b", "Promotions", "me@x.com", 25, 5]);
  });

  it("numbers placeholders correctly for the Primary query", async () => {
    await getThreadsForCategoryAcrossAccounts(["a"], "Primary", 50, 0, ["me@x.com"]);
    const { sql, params } = lastSelect();
    expect(sql).toContain("NOT IN ($2)");
    expect(sql).toContain("LIMIT $3 OFFSET $4");
    expect(params).toEqual(["a", "me@x.com", 50, 0]);
  });
});

describe("threads service - getThreadsWithContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(mockDb as unknown as Awaited<ReturnType<typeof getDb>>);
    mockDb.select.mockResolvedValue([]);
  });

  function lastSelect(): { sql: string; params: unknown[] } {
    const call = mockDb.select.mock.calls.at(-1)!;
    return { sql: call[0] as string, params: call[1] as unknown[] };
  }

  it("matches mail in both directions, lowercased", async () => {
    await getThreadsWithContact("acc-1", "Sam@Example.com", "thread-1", 10, 0);
    const { sql, params } = lastSelect();
    expect(sql).toContain("mc.from_address");
    expect(sql).toContain("mc.to_addresses");
    expect(sql).toContain("mc.cc_addresses");
    expect(params).toEqual([
      "acc-1",
      "thread-1",
      "sam@example.com",
      "%sam@example.com%",
      10,
      0,
    ]);
  });

  it("excludes the thread already on screen", async () => {
    await getThreadsWithContact("acc-1", "sam@example.com", "thread-1");
    const { sql } = lastSelect();
    expect(sql).toContain("t.id != $2");
  });

  it("does not query without an address", async () => {
    expect(await getThreadsWithContact("acc-1", "", null)).toEqual([]);
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});
