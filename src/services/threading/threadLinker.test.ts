import { describe, it, expect } from "vitest";
import { normalizeSubject, qualifiesForSubjectMerge, type SubjectCandidate } from "./threadLinker";

describe("normalizeSubject", () => {
  it("joins the two subjects Gmail split", () => {
    // Verbatim from the mailbox: Outlook's AW: stacked on Apple Mail's Re:,
    // which left a stray colon behind
    expect(normalizeSubject("AW: : AI:AT Coworking - Feedback Session #1"))
      .toBe(normalizeSubject("AI:AT Coworking - Feedback Session #1"));
    expect(normalizeSubject("Re: : AI:AT Coworking - Feedback Session #1"))
      .toBe("ai:at coworking - feedback session #1");
  });

  it("strips stacked prefixes in several languages", () => {
    for (const subject of [
      "Re: Fwd: WG: Quarterly numbers",
      "AW: Antw: Quarterly numbers",
      "FW: Re: Quarterly numbers",
    ]) {
      expect(normalizeSubject(subject)).toBe("quarterly numbers");
    }
  });

  it("keeps a colon that belongs to the subject itself", () => {
    expect(normalizeSubject("AI:AT Coworking")).toBe("ai:at coworking");
  });

  it("collapses whitespace and case", () => {
    expect(normalizeSubject("  Re:   Two   Words ")).toBe("two words");
  });

  it("handles a missing subject", () => {
    expect(normalizeSubject(null)).toBe("");
  });

  it("does not mistake a word starting with re for a prefix", () => {
    expect(normalizeSubject("Rechnung 2026")).toBe("rechnung 2026");
  });
});

describe("qualifiesForSubjectMerge", () => {
  const at = (hoursAgo: number) => Date.now() - hoursAgo * 3_600_000;
  const own = new Set(["me@x.com"]);
  const thread = (over: Partial<SubjectCandidate>): SubjectCandidate => ({
    id: "t", subject: "x", last_message_at: at(1), peers: "", own_count: 0, foreign_count: 0, ...over,
  });

  it("joins a real exchange the user and the same person are both in", () => {
    const a = thread({ id: "a", peers: "me@x.com,mara@ai-at.eu", own_count: 1, foreign_count: 1 });
    const b = thread({ id: "b", peers: "mara@ai-at.eu,me@x.com", own_count: 1, foreign_count: 2, last_message_at: at(3) });
    expect(qualifiesForSubjectMerge(a, b, own)).toBe(true);
  });

  it("does not join magic-link mails that arrive from the user's own address", () => {
    // Every "Dein MatchMii-Login" is From: the user — own_count > 0 and
    // nobody else in it. Twice this shape got folded into one thread.
    const a = thread({ id: "a", peers: "me@x.com", own_count: 1, foreign_count: 0 });
    const b = thread({ id: "b", peers: "me@x.com", own_count: 1, foreign_count: 0, last_message_at: at(2) });
    expect(qualifiesForSubjectMerge(a, b, own)).toBe(false);
  });

  it("does not join a notification stream the user never wrote in", () => {
    const a = thread({ id: "a", peers: "noreply@shop.tld", own_count: 0, foreign_count: 1 });
    const b = thread({ id: "b", peers: "noreply@shop.tld", own_count: 0, foreign_count: 1 });
    expect(qualifiesForSubjectMerge(a, b, own)).toBe(false);
  });

  it("does not join two exchanges with different people", () => {
    const a = thread({ id: "a", peers: "me@x.com,anna@y.tld", own_count: 1, foreign_count: 1 });
    const b = thread({ id: "b", peers: "me@x.com,bob@z.tld", own_count: 1, foreign_count: 1 });
    expect(qualifiesForSubjectMerge(a, b, own)).toBe(false);
  });

  it("does not join across the time window", () => {
    const a = thread({ id: "a", peers: "me@x.com,mara@ai-at.eu", own_count: 1, foreign_count: 1 });
    const b = thread({ id: "b", peers: "me@x.com,mara@ai-at.eu", own_count: 1, foreign_count: 1, last_message_at: at(24 * 45) });
    expect(qualifiesForSubjectMerge(a, b, own)).toBe(false);
  });
});
