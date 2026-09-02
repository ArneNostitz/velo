import { describe, it, expect } from "vitest";
import { normalizeSubject } from "./threadLinker";

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
