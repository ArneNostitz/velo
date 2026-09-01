import { getAliasesForAccount, mapDbAlias } from "@/services/db/sendAsAliases";
import { mailAccounts, type Account } from "@/stores/accountStore";

/**
 * One address the user can send from, together with the mailbox that sends it.
 *
 * An identity is either an account's own address or one of its verified
 * send-as aliases. The account matters as much as the address: Gmail only
 * accepts a From that is verified on the sending account, and a reply must go
 * out through the mailbox that holds the thread.
 */
export interface Identity {
  accountId: string;
  accountEmail: string;
  email: string;
  displayName: string | null;
  isPrimary: boolean;
  isDefault: boolean;
}

/**
 * Every address the user can send from, across all mail accounts.
 *
 * Accounts are kept in the order given, aliases in the order stored (primary
 * first). An account whose aliases have not been fetched — IMAP, or a Gmail
 * account authorized before the settings scope — still contributes its own
 * address, so it is never unsendable.
 */
export async function collectIdentities(accounts: Account[]): Promise<Identity[]> {
  const mail = mailAccounts(accounts);

  const aliasLists = await Promise.all(
    mail.map(async (account) => {
      try {
        return (await getAliasesForAccount(account.id)).map(mapDbAlias);
      } catch {
        // An account whose aliases cannot be read falls back to its own address
        return [];
      }
    }),
  );

  const identities: Identity[] = [];
  mail.forEach((account, index) => {
    const aliases = aliasLists[index] ?? [];
    if (aliases.length === 0) {
      identities.push({
        accountId: account.id,
        accountEmail: account.email,
        email: account.email,
        displayName: account.displayName,
        isPrimary: true,
        isDefault: true,
      });
      return;
    }
    for (const alias of aliases) {
      identities.push({
        accountId: account.id,
        accountEmail: account.email,
        email: alias.email,
        displayName: alias.displayName,
        isPrimary: alias.isPrimary,
        isDefault: alias.isDefault,
      });
    }
  });

  return identities;
}

/** The identities belonging to one account. */
export function identitiesForAccount(
  identities: Identity[],
  accountId: string | null,
): Identity[] {
  if (!accountId) return [];
  return identities.filter((i) => i.accountId === accountId);
}
