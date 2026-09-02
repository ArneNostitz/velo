import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.fn(() => Promise.resolve());
const mockListen = vi.fn(() => Promise.resolve(() => {}));
const settings = new Map<string, string>();
let accounts: Record<string, unknown>[] = [];

vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => mockInvoke(...a) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: (...a: unknown[]) => mockListen(...a) }));
vi.mock("@/services/db/settings", () => ({
  getSetting: (k: string) => Promise.resolve(settings.get(k) ?? null),
}));
vi.mock("@/services/db/accounts", () => ({ getAllAccounts: () => Promise.resolve(accounts) }));
vi.mock("@/services/oauth/oauthTokenManager", () => ({
  ensureFreshToken: () => Promise.resolve("tok-123"),
}));
vi.mock("./imapConfigBuilder", () => ({
  buildImapConfig: () => ({ host: "imap.example.com", port: 993 }),
}));

import { startIdleWatchers, stopIdleWatchers, accountsWithoutIdle } from "./idleManager";

const gmail = { id: "g1", email: "a@gmail.com", provider: "gmail_api", auth_method: "oauth2", is_active: 1 };
const imap = { id: "i1", email: "b@host.tld", provider: "imap", auth_method: "password", is_active: 1, imap_host: "imap.host.tld" };

describe("startIdleWatchers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    settings.clear();
    accounts = [];
    await stopIdleWatchers();
    vi.clearAllMocks();
  });

  it("points a Gmail account at Gmail's IMAP endpoint with its token", async () => {
    accounts = [gmail];
    await startIdleWatchers();
    expect(mockInvoke).toHaveBeenCalledWith("imap_start_idle", {
      accountId: "g1",
      config: expect.objectContaining({
        host: "imap.gmail.com",
        auth_method: "oauth2",
        password: "tok-123",
      }),
    });
  });

  it("uses the account's own server for an IMAP account", async () => {
    accounts = [imap];
    await startIdleWatchers();
    expect(mockInvoke).toHaveBeenCalledWith("imap_start_idle", {
      accountId: "i1",
      config: expect.objectContaining({ host: "imap.example.com" }),
    });
  });

  it("does nothing at all when the setting is off", async () => {
    settings.set("imap_idle", "false");
    accounts = [gmail];
    await startIdleWatchers();
    expect(mockInvoke).not.toHaveBeenCalledWith("imap_start_idle", expect.anything());
  });

  it("skips a disabled account", async () => {
    accounts = [{ ...gmail, is_active: 0 }];
    await startIdleWatchers();
    expect(mockInvoke).not.toHaveBeenCalledWith("imap_start_idle", expect.anything());
  });

  it("keeps going when one account refuses, and remembers which", async () => {
    // The scope-less Gmail account: IMAP rejects the token, polling carries on
    mockInvoke.mockImplementationOnce(() => Promise.reject(new Error("AUTHENTICATIONFAILED")));
    accounts = [gmail, imap];
    await startIdleWatchers();
    expect(accountsWithoutIdle().has("g1")).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith("imap_start_idle", {
      accountId: "i1",
      config: expect.anything(),
    });
  });

  it("stops every watcher on request", async () => {
    await stopIdleWatchers();
    expect(mockInvoke).toHaveBeenCalledWith("imap_stop_all_idle");
  });
});
