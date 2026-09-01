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
  setAccounts: (accounts: Account[], restoredId?: string | null) => void;
  setActiveAccount: (id: string) => void;
  setUnifiedInbox: (unified: boolean) => void;
  setAccountColor: (id: string, color: string) => void;
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
    set({ activeAccountId, unifiedInbox: false });
  },

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
      };
    }),
}));
