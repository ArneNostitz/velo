import { describe, it, expect } from "vitest";
import { threadFolder } from "./threadFolder";

describe("threadFolder", () => {
  it("names Trash even when the thread still carries INBOX", () => {
    expect(threadFolder(["INBOX", "TRASH", "UNREAD"])).toEqual({ id: "trash", name: "Trash" });
  });

  it("puts Spam ahead of the inbox", () => {
    expect(threadFolder(["SPAM", "INBOX"]).id).toBe("spam");
  });

  it("names Drafts, Snoozed, Inbox and Sent", () => {
    expect(threadFolder(["DRAFT"]).name).toBe("Drafts");
    expect(threadFolder(["SNOOZED"]).name).toBe("Snoozed");
    expect(threadFolder(["INBOX", "STARRED"]).name).toBe("Inbox");
    expect(threadFolder(["SENT"]).name).toBe("Sent");
  });

  it("prefers the inbox over sent for a conversation the user replied in", () => {
    expect(threadFolder(["SENT", "INBOX"]).id).toBe("inbox");
  });

  it("names a user label when the thread is filed under one", () => {
    const names = new Map([["Label_12", "Receipts"]]);
    expect(threadFolder(["Label_12", "STARRED"], names)).toEqual({ id: "label", name: "Receipts" });
  });

  it("ignores markers and categories that are not a place", () => {
    expect(threadFolder(["STARRED", "IMPORTANT", "CATEGORY_PROMOTIONS"]).id).toBe("archive");
  });

  it("calls an unknown label archived when it has no name to show", () => {
    expect(threadFolder(["Label_99"])).toEqual({ id: "archive", name: "Archive" });
  });

  it("calls a thread with no labels archived", () => {
    expect(threadFolder([]).name).toBe("Archive");
  });
});
