import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Account } from "@/stores/accountStore";

const getAliasesForAccount = vi.fn();

vi.mock("@/services/db/sendAsAliases", async () => {
  const actual = await vi.importActual<typeof import("@/services/db/sendAsAliases")>(
    "@/services/db/sendAsAliases",
  );
  return {
    ...actual,
    getAliasesForAccount: (accountId: string) => getAliasesForAccount(accountId),
  };
});

const { collectIdentities, identitiesForAccount } = await import("./identities");

function account(id: string, email: string, provider = "gmail_api"): Account {
  return {
    id,
    email,
    displayName: null,
    avatarUrl: null,
    isActive: true,
    provider,
  };
}

function dbAlias(accountId: string, email: string, isPrimary = false) {
  return {
    id: `${accountId}-${email}`,
    account_id: accountId,
    email,
    display_name: null,
    reply_to_address: null,
    signature_id: null,
    is_primary: isPrimary ? 1 : 0,
    is_default: 0,
    treat_as_alias: 0,
    verification_status: "accepted",
    created_at: 0,
  };
}

describe("collectIdentities", () => {
  beforeEach(() => {
    getAliasesForAccount.mockReset();
  });

  it("returns every account's aliases tagged with their mailbox", async () => {
    getAliasesForAccount.mockImplementation((id: string) =>
      Promise.resolve(
        id === "acc-1"
          ? [dbAlias("acc-1", "arne@diracting.com", true)]
          : [
              dbAlias("acc-2", "hello@diracting.com", true),
              dbAlias("acc-2", "hello@matchmii.com"),
            ],
      ),
    );

    const identities = await collectIdentities([
      account("acc-1", "arne@diracting.com"),
      account("acc-2", "hello@diracting.com"),
    ]);

    expect(identities.map((i) => [i.accountId, i.email])).toEqual([
      ["acc-1", "arne@diracting.com"],
      ["acc-2", "hello@diracting.com"],
      ["acc-2", "hello@matchmii.com"],
    ]);
  });

  it("falls back to the account address when no aliases are stored", async () => {
    getAliasesForAccount.mockResolvedValue([]);

    const identities = await collectIdentities([account("acc-1", "user@imap.test", "imap")]);

    expect(identities).toEqual([
      {
        accountId: "acc-1",
        accountEmail: "user@imap.test",
        email: "user@imap.test",
        displayName: null,
        isPrimary: true,
        isDefault: true,
      },
    ]);
  });

  it("falls back to the account address when aliases cannot be read", async () => {
    getAliasesForAccount.mockRejectedValue(new Error("no db"));

    const identities = await collectIdentities([account("acc-1", "user@example.com")]);

    expect(identities.map((i) => i.email)).toEqual(["user@example.com"]);
  });

  it("skips CalDAV accounts, which have no mailbox", async () => {
    getAliasesForAccount.mockResolvedValue([]);

    const identities = await collectIdentities([
      account("acc-1", "cal@example.com", "caldav"),
      account("acc-2", "mail@example.com"),
    ]);

    expect(identities.map((i) => i.accountId)).toEqual(["acc-2"]);
  });
});

describe("identitiesForAccount", () => {
  const identities = [
    { accountId: "a", accountEmail: "a@x", email: "a@x", displayName: null, isPrimary: true, isDefault: false },
    { accountId: "b", accountEmail: "b@x", email: "b@x", displayName: null, isPrimary: true, isDefault: false },
  ];

  it("filters to one mailbox", () => {
    expect(identitiesForAccount(identities, "b").map((i) => i.email)).toEqual(["b@x"]);
  });

  it("returns nothing without an account", () => {
    expect(identitiesForAccount(identities, null)).toEqual([]);
  });
});
