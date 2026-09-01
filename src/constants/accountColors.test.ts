import { describe, it, expect } from "vitest";
import { ACCOUNT_COLORS, accountColor } from "./accountColors";

describe("accountColor", () => {
  it("returns the stored colour when it names one in the palette", () => {
    expect(accountColor("emerald").id).toBe("emerald");
  });

  it("falls back to position when no colour is stored", () => {
    // Accounts added before colours existed must still look distinct
    expect(accountColor(null, 0).id).toBe(ACCOUNT_COLORS[0]!.id);
    expect(accountColor(null, 1).id).toBe(ACCOUNT_COLORS[1]!.id);
    expect(accountColor(undefined, 2).id).toBe(ACCOUNT_COLORS[2]!.id);
  });

  it("wraps around for more accounts than colours", () => {
    const n = ACCOUNT_COLORS.length;
    expect(accountColor(null, n).id).toBe(ACCOUNT_COLORS[0]!.id);
    expect(accountColor(null, n + 3).id).toBe(ACCOUNT_COLORS[3]!.id);
  });

  it("falls back to position for a colour id that is no longer in the palette", () => {
    expect(accountColor("chartreuse", 1).id).toBe(ACCOUNT_COLORS[1]!.id);
  });

  it("gives every palette entry a hex and pill classes", () => {
    for (const color of ACCOUNT_COLORS) {
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color.pill).toContain("bg-");
      expect(color.pill).toContain("dark:");
    }
  });

  it("has no duplicate ids", () => {
    const ids = ACCOUNT_COLORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
