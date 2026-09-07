import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/accounts", () => ({
  getAllAccounts: vi.fn(),
}));
vi.mock("../db/settings", () => ({
  getSetting: vi.fn(),
  getSecureSetting: vi.fn(),
}));
vi.mock("./tokenManager", () => ({
  getGmailClient: vi.fn(),
}));
vi.mock("./syncManager", () => ({
  syncAccount: vi.fn(),
}));

import { getAllAccounts } from "../db/accounts";
import { getSecureSetting, getSetting } from "../db/settings";
import { getGmailClient } from "./tokenManager";
import { startGmailPushRelay, stopGmailPushRelay } from "./gmailPushRelay";

const mockGetAllAccounts = vi.mocked(getAllAccounts);
const mockGetSetting = vi.mocked(getSetting);
const mockGetSecureSetting = vi.mocked(getSecureSetting);
const mockGetGmailClient = vi.mocked(getGmailClient);

const account = {
  id: "account-1",
  email: "user@gmail.com",
  provider: "gmail_api" as const,
  is_active: 1,
};

describe("gmailPushRelay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllAccounts.mockResolvedValue([account] as never);
    mockGetSetting.mockImplementation(async (key: string) => {
      if (key === "gmail_push_relay_url") return "https://relay.example.com";
      if (key === "gmail_push_topic_name") return "projects/test/topics/gmail";
      return null;
    });
    mockGetSecureSetting.mockResolvedValue("relay-secret");
  });

  afterEach(() => {
    stopGmailPushRelay();
    vi.unstubAllGlobals();
  });

  it("does not let a stopped run register with a stale token or secret", async () => {
    let releaseAccessToken!: () => void;
    const accessToken = new Promise<string>((resolve) => {
      releaseAccessToken = () => resolve("access-token");
    });
    mockGetGmailClient.mockResolvedValue({ getAccessToken: () => accessToken } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const firstRun = startGmailPushRelay();
    await Promise.resolve();
    stopGmailPushRelay();
    releaseAccessToken();
    await firstRun;

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
