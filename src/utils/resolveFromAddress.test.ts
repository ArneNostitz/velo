import { describe, it, expect } from "vitest";
import { resolveFromAddress, recipientHeadersFromMessages } from "./resolveFromAddress";
import { createMockSendAsAlias } from "@/test/mocks";

describe("resolveFromAddress", () => {
  it("returns null for empty aliases", () => {
    const result = resolveFromAddress([], ["someone@test.com"]);
    expect(result).toBeNull();
  });

  it("resolves matching alias from To header", () => {
    const aliases = [
      createMockSendAsAlias({ id: "a1", email: "primary@example.com", isPrimary: true }),
      createMockSendAsAlias({ id: "a2", email: "alias@example.com" }),
    ];

    const result = resolveFromAddress(aliases, ["alias@example.com, other@test.com"]);
    expect(result?.id).toBe("a2");
    expect(result?.email).toBe("alias@example.com");
  });

  it("resolves matching alias from Cc header", () => {
    const aliases = [
      createMockSendAsAlias({ id: "a1", email: "primary@example.com", isPrimary: true }),
      createMockSendAsAlias({ id: "a2", email: "work@example.com" }),
    ];

    const result = resolveFromAddress(aliases, ["someone@test.com", "work@example.com"]);
    expect(result?.id).toBe("a2");
    expect(result?.email).toBe("work@example.com");
  });

  it("matches an address wrapped in a display name", () => {
    const aliases = [
      createMockSendAsAlias({ id: "a1", email: "default@example.com", isDefault: true }),
      createMockSendAsAlias({ id: "a2", email: "arne@example.com" }),
    ];

    const result = resolveFromAddress(aliases, [
      '"Doe, John" <john@test.com>, Arne Nostitz <arne@example.com>',
    ]);
    expect(result?.id).toBe("a2");
  });

  it("is case-insensitive when matching addresses", () => {
    const aliases = [
      createMockSendAsAlias({ id: "a1", email: "User@Example.COM", isPrimary: true }),
    ];

    const result = resolveFromAddress(aliases, ["user@example.com"]);
    expect(result?.id).toBe("a1");
  });

  it("prefers the earlier header when several aliases were addressed", () => {
    const aliases = [
      createMockSendAsAlias({ id: "a1", email: "old@example.com" }),
      createMockSendAsAlias({ id: "a2", email: "new@example.com" }),
    ];

    const result = resolveFromAddress(aliases, ["new@example.com", "old@example.com"]);
    expect(result?.id).toBe("a2");
  });

  it("falls back to default when no match", () => {
    const aliases = [
      createMockSendAsAlias({ id: "a1", email: "primary@example.com", isPrimary: true }),
      createMockSendAsAlias({ id: "a2", email: "default@example.com", isDefault: true }),
    ];

    const result = resolveFromAddress(aliases, ["unknown@test.com"]);
    expect(result?.id).toBe("a2");
  });

  it("falls back to primary when no default and no match", () => {
    const aliases = [
      createMockSendAsAlias({ id: "a1", email: "secondary@example.com" }),
      createMockSendAsAlias({ id: "a2", email: "primary@example.com", isPrimary: true }),
    ];

    const result = resolveFromAddress(aliases, ["unknown@test.com"]);
    expect(result?.id).toBe("a2");
  });

  it("falls back to first alias when no default, no primary, no match", () => {
    const aliases = [
      createMockSendAsAlias({ id: "a1", email: "first@example.com" }),
      createMockSendAsAlias({ id: "a2", email: "second@example.com" }),
    ];

    const result = resolveFromAddress(aliases, ["unknown@test.com"]);
    expect(result?.id).toBe("a1");
  });

  it("handles null and empty headers", () => {
    const aliases = [
      createMockSendAsAlias({ id: "a1", email: "primary@example.com", isPrimary: true }),
      createMockSendAsAlias({ id: "a2", email: "default@example.com", isDefault: true }),
    ];

    expect(resolveFromAddress(aliases, [])?.id).toBe("a2");
    expect(resolveFromAddress(aliases, [null, undefined, ""])?.id).toBe("a2");
  });

  it("prefers an addressed alias over the default alias", () => {
    const aliases = [
      createMockSendAsAlias({ id: "a1", email: "default@example.com", isDefault: true }),
      createMockSendAsAlias({ id: "a2", email: "match@example.com" }),
    ];

    const result = resolveFromAddress(aliases, ["match@example.com"]);
    expect(result?.id).toBe("a2");
  });
});

describe("recipientHeadersFromMessages", () => {
  it("returns To and Cc newest message first", () => {
    const headers = recipientHeadersFromMessages([
      { to_addresses: "old-to@example.com", cc_addresses: "old-cc@example.com" },
      { to_addresses: "new-to@example.com", cc_addresses: null },
    ]);

    expect(headers).toEqual([
      "new-to@example.com",
      "old-to@example.com",
      "old-cc@example.com",
    ]);
  });

  it("returns nothing for messages without recipients", () => {
    expect(recipientHeadersFromMessages([])).toEqual([]);
    expect(recipientHeadersFromMessages([{ to_addresses: null, cc_addresses: null }])).toEqual([]);
  });
});
