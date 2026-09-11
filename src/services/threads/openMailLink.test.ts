import { vi, beforeEach, describe, it, expect } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(), cache: vi.fn(), navigate: vi.fn(), request: vi.fn(), clearSearch: vi.fn(),
  setActiveAccount: vi.fn(), setThreads: vi.fn(), threadMap: new Map(), threads: [] as Array<{ id: string; accountId: string }>,
}));
vi.mock("../db/connection", () => ({ getDb: async () => ({ select: mocks.select }) }));
vi.mock("./openThread", () => ({ cacheThreadForOpening: mocks.cache }));
vi.mock("@/router/navigate", () => ({ navigateToLabel: mocks.navigate }));
vi.mock("@/stores/accountStore", () => ({ useAccountStore: { getState: () => ({ activeAccountId: "old", setActiveAccount: mocks.setActiveAccount }) } }));
vi.mock("@/stores/threadStore", () => ({ useThreadStore: { getState: () => ({ ...mocks }) } }));
vi.mock("@/stores/mailLinkStore", () => ({ useMailLinkStore: { getState: () => ({ request: mocks.request }) } }));
import { openMailLink } from "./openMailLink";

beforeEach(() => {
  vi.clearAllMocks(); mocks.threadMap.clear(); mocks.threads = [];
  mocks.select.mockResolvedValue([{ id: "t" }]); mocks.cache.mockResolvedValue(true);
});

describe("opening external mail", () => {
  it("validates all ownership identifiers before caching or navigating", async () => {
    const target = { accountId: "a", threadId: "t", messageId: "m" };
    await openMailLink(target);
    expect(mocks.select).toHaveBeenCalledWith(expect.stringContaining("m.account_id = t.account_id"), ["a", "t", "m"]);
    expect(mocks.select.mock.calls[0]![0]).toContain("m.thread_id = t.id");
    expect(mocks.cache).toHaveBeenCalledWith("a", "t");
    expect(mocks.request).toHaveBeenCalledWith(target);
    expect(mocks.navigate).toHaveBeenCalledWith("all", { threadId: "t", accountId: "a" });
  });
  it("rejects missing/mismatched account, thread, or message without switching account", async () => {
    mocks.select.mockResolvedValue([]);
    await expect(openMailLink({ accountId: "wrong", threadId: "t", messageId: "m" })).rejects.toThrow("unavailable");
    expect(mocks.cache).not.toHaveBeenCalled(); expect(mocks.setActiveAccount).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("removes a wrong-account list collision before caching the requested account", async () => {
    mocks.threads = [{ id: "t", accountId: "wrong" }, { id: "other", accountId: "wrong" }];
    mocks.threadMap.set("t", mocks.threads[0]);
    await openMailLink({ accountId: "a", threadId: "t" });
    expect(mocks.setThreads).toHaveBeenCalledWith([{ id: "other", accountId: "wrong" }]);
    expect(mocks.cache).toHaveBeenCalledWith("a", "t");
  });
  it("does not navigate when the thread disappears during opening", async () => {
    mocks.cache.mockResolvedValue(false);
    await expect(openMailLink({ accountId: "a", threadId: "t" })).rejects.toThrow("no longer");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
