import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNotify = vi.fn();
const mockWriteText = vi.fn(() => Promise.resolve());
const settings = new Map<string, string>();

vi.mock("@/services/notifications/notificationManager", () => ({
  notifyOneTimeCode: (...args: unknown[]) => mockNotify(...args),
}));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: (...args: unknown[]) => mockWriteText(...args),
}));
vi.mock("@/services/db/settings", () => ({
  getSetting: (key: string) => Promise.resolve(settings.get(key) ?? null),
}));

import { processIncomingCodes, resetHandledCodes } from "./otpManager";

const NOW = 1_700_000_000_000;

function codeMail(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    subject: "Your verification code is 493028",
    bodyText: null,
    bodyHtml: null,
    date: NOW,
    fromName: "Example",
    fromAddress: "no-reply@example.com",
    ...overrides,
  };
}

describe("processIncomingCodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings.clear();
    resetHandledCodes();
  });

  it("copies the code and says so", async () => {
    const out = await processIncomingCodes([codeMail()], NOW);
    expect(out).toEqual([{ code: "493028", linkUrl: null, copied: true }]);
    expect(mockWriteText).toHaveBeenCalledWith("493028");
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ code: "493028", copied: true }),
    );
  });

  it("still notifies when auto-copy is off", async () => {
    settings.set("otp_auto_copy", "false");
    const out = await processIncomingCodes([codeMail()], NOW);
    expect(mockWriteText).not.toHaveBeenCalled();
    expect(out[0]!.copied).toBe(false);
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ code: "493028", copied: false }));
  });

  it("does nothing when detection is switched off", async () => {
    settings.set("otp_detection", "false");
    expect(await processIncomingCodes([codeMail()], NOW)).toEqual([]);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("ignores an old message, so a first sync cannot hijack the clipboard", async () => {
    const old = codeMail({ date: NOW - 60 * 60 * 1000 });
    expect(await processIncomingCodes([old], NOW)).toEqual([]);
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it("acts on a message only once, however often it re-syncs", async () => {
    await processIncomingCodes([codeMail()], NOW);
    await processIncomingCodes([codeMail()], NOW);
    expect(mockWriteText).toHaveBeenCalledTimes(1);
  });

  it("offers the code and the link together when a mail carries both", async () => {
    const out = await processIncomingCodes([
      codeMail({
        id: "m4",
        subject: "Dein Login",
        bodyText: "Anmelden\nOder dieser Code\n271260\n",
        bodyHtml: '<a href="https://app.example.com/login?t=9">Anmelden</a><p>Oder dieser Code</p><p>271260</p>',
      }),
    ], NOW);
    expect(out).toEqual([{ code: "271260", linkUrl: "https://app.example.com/login?t=9", copied: true }]);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ code: "271260", linkUrl: "https://app.example.com/login?t=9" }),
    );
  });

  it("surfaces a sign-in link when there is no code", async () => {
    const out = await processIncomingCodes([
      codeMail({
        id: "m2",
        subject: "Finish signing in",
        bodyHtml: '<a href="https://app.example.com/magic?t=1">Sign in</a>',
      }),
    ], NOW);
    expect(out).toEqual([{ code: null, linkUrl: "https://app.example.com/magic?t=1", copied: false }]);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ linkUrl: "https://app.example.com/magic?t=1" }),
    );
  });

  it("stays quiet for ordinary mail", async () => {
    const out = await processIncomingCodes([
      codeMail({ id: "m3", subject: "Lunch tomorrow?", bodyText: "Are you free at 1230?" }),
    ], NOW);
    expect(out).toEqual([]);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("survives a clipboard that refuses", async () => {
    mockWriteText.mockRejectedValue(new Error("denied"));
    // The browser fallback is unavailable in jsdom too
    Object.assign(navigator, { clipboard: { writeText: () => Promise.reject(new Error("no")) } });
    const out = await processIncomingCodes([codeMail()], NOW);
    expect(out[0]!.copied).toBe(false);
    expect(mockNotify).toHaveBeenCalled();
  });
  it("carries the thread so clicking the notification can open the message", async () => {
    await processIncomingCodes([codeMail({ threadId: "t-1", accountId: "a-1" })], NOW);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "t-1", accountId: "a-1" }),
    );
  });
});
