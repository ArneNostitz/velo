import { create } from "zustand";
import { setSetting } from "../services/db/settings";

export interface Account {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  provider?: string;
  /** Palette id from ACCOUNT_COLORS; null means "derive one from position" */
  color?: string | null;
}

interface AccountState {
  accounts: Account[];
  activeAccountId: string | null;
  /**
   * Show every mailbox in one list. `activeAccountId` still points at the
   * account used for composing and for account-specific views (custom labels,
   * smart folders, settings) — unified only changes which threads are listed.
   */
  unifiedInbox: boolean;
  /**
   * Send-as address the composer should default to, or null to use the
   * account's own address. Gmail only accepts addresses verified as send-as on
   * the account, so this always belongs to `activeAccountId`.
   */
  activeAliasEmail: string | null;
  /**
   * Account whose calendars the Calendar page shows. Separate from
   * `activeAccountId` so a calendar can be read without switching mailbox —
   * and so a CalDAV account, which has no mailbox at all, can be selected.
   */
  calendarAccountId: string | null;
  setAccounts: (accounts: Account[], restoredId?: string | null) => void;
  setActiveAccount: (id: string) => void;
  setUnifiedInbox: (unified: boolean) => void;
  setAccountColor: (id: string, color: string) => void;
  setActiveIdentity: (accountId: string, aliasEmail: string | null) => void;
  restoreActiveIdentity: (aliasEmail: string | null) => void;
  setCalendarAccountId: (id: string | null) => void;
  restoreCalendarAccountId: (id: string | null) => void;
  restoreUnifiedInbox: (unified: boolean) => void;
  addAccount: (account: Account) => void;
  removeAccount: (id: string) => void;
}

/** Mail accounts only — CalDAV accounts have no mailbox to list. */
export function mailAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.provider !== "caldav");
}

/**
 * Which accounts the thread list should draw from.
 *
 * Unified spans every active mailbox; otherwise it is just the active one.
 * Returns an empty array when there is nothing to list.
 */
export function listedAccountIds(state: {
  accounts: Account[];
  activeAccountId: string | null;
  unifiedInbox: boolean;
}): string[] {
  if (state.unifiedInbox) {
    return mailAccounts(state.accounts)
      .filter((a) => a.isActive)
      .map((a) => a.id);
  }
  return state.activeAccountId ? [state.activeAccountId] : [];
}

export const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  activeAccountId: null,
  unifiedInbox: false,
  activeAliasEmail: null,
  calendarAccountId: null,

  setAccounts: (accounts, restoredId) => {
    const activeId = (restoredId && accounts.some((a) => a.id === restoredId))
      ? restoredId
      : accounts[0]?.id ?? null;
    set({ accounts, activeAccountId: activeId });
  },

  setActiveAccount: (activeAccountId) => {
    setSetting("active_account_id", activeAccountId).catch(() => {});
    // Picking a specific mailbox leaves the unified view.
    setSetting("unified_inbox", "false").catch(() => {});
    // The previous identity belonged to the previous account
    setSetting("active_alias_email", "").catch(() => {});
    set({ activeAccountId, unifiedInbox: false, activeAliasEmail: null });
  },

  /**
   * Choose which address new mail is sent from. Switches to the owning account
   * so the identity and the mailbox never disagree.
   */
  setActiveIdentity: (accountId, aliasEmail) => {
    setSetting("active_account_id", accountId).catch(() => {});
    setSetting("unified_inbox", "false").catch(() => {});
    setSetting("active_alias_email", aliasEmail ?? "").catch(() => {});
    set({
      activeAccountId: accountId,
      unifiedInbox: false,
      activeAliasEmail: aliasEmail,
    });
  },

  /** Apply a persisted value on startup without writing it back. */
  restoreActiveIdentity: (activeAliasEmail) => set({ activeAliasEmail }),

  setCalendarAccountId: (calendarAccountId) => {
    setSetting("calendar_account_id", calendarAccountId ?? "").catch(() => {});
    set({ calendarAccountId });
  },

  /** Apply a persisted value on startup without writing it back. */
  restoreCalendarAccountId: (calendarAccountId) => set({ calendarAccountId }),

  setAccountColor: (id, color) =>
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? { ...a, color } : a)),
    })),

  setUnifiedInbox: (unifiedInbox) => {
    setSetting("unified_inbox", String(unifiedInbox)).catch(() => {});
    set({ unifiedInbox });
  },

  /** Apply a persisted value on startup without writing it back. */
  restoreUnifiedInbox: (unifiedInbox) => set({ unifiedInbox }),

  addAccount: (account) =>
    set((state) => ({
      accounts: [...state.accounts, account],
      activeAccountId: state.activeAccountId ?? account.id,
    })),

  removeAccount: (id) =>
    set((state) => {
      const accounts = state.accounts.filter((a) => a.id !== id);
      return {
        accounts,
        activeAccountId:
          state.activeAccountId === id
            ? (accounts[0]?.id ?? null)
            : state.activeAccountId,
        // Nothing left to unify
        unifiedInbox: accounts.length > 1 ? state.unifiedInbox : false,
        // Fall back to picking a calendar again if this one is gone
        calendarAccountId:
          state.calendarAccountId === id ? null : state.calendarAccountId,
      };
    }),
}));
