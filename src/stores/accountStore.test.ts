import { describe, it, expect, beforeEach } from "vitest";
import {
  useAccountStore,
  listedAccountIds,
  mailAccounts,
  type Account,
} from "./accountStore";

const mockAccount: Account = {
  id: "acc-1",
  email: "test@gmail.com",
  displayName: "Test User",
  avatarUrl: null,
  isActive: true,
};

const mockAccount2: Account = {
  id: "acc-2",
  email: "work@gmail.com",
  displayName: "Work Account",
  avatarUrl: null,
  isActive: true,
};

describe("accountStore", () => {
  beforeEach(() => {
    useAccountStore.setState({
      accounts: [],
      activeAccountId: null,
      unifiedInbox: false,
    });
  });

  it("should start with no accounts", () => {
    const state = useAccountStore.getState();
    expect(state.accounts).toHaveLength(0);
    expect(state.activeAccountId).toBeNull();
  });

  it("should add an account and set it as active", () => {
    useAccountStore.getState().addAccount(mockAccount);
    const state = useAccountStore.getState();
    expect(state.accounts).toHaveLength(1);
    expect(state.activeAccountId).toBe("acc-1");
  });

  it("should not override active account when adding second account", () => {
    useAccountStore.getState().addAccount(mockAccount);
    useAccountStore.getState().addAccount(mockAccount2);
    const state = useAccountStore.getState();
    expect(state.accounts).toHaveLength(2);
    expect(state.activeAccountId).toBe("acc-1");
  });

  it("should switch active account", () => {
    useAccountStore.getState().addAccount(mockAccount);
    useAccountStore.getState().addAccount(mockAccount2);
    useAccountStore.getState().setActiveAccount("acc-2");
    expect(useAccountStore.getState().activeAccountId).toBe("acc-2");
  });

  it("should remove account and update active if needed", () => {
    useAccountStore.getState().addAccount(mockAccount);
    useAccountStore.getState().addAccount(mockAccount2);
    useAccountStore.getState().removeAccount("acc-1");

    const state = useAccountStore.getState();
    expect(state.accounts).toHaveLength(1);
    expect(state.activeAccountId).toBe("acc-2");
  });

  it("should set active to null when last account removed", () => {
    useAccountStore.getState().addAccount(mockAccount);
    useAccountStore.getState().removeAccount("acc-1");

    const state = useAccountStore.getState();
    expect(state.accounts).toHaveLength(0);
    expect(state.activeAccountId).toBeNull();
  });

  it("should set accounts from array", () => {
    useAccountStore.getState().setAccounts([mockAccount, mockAccount2]);
    const state = useAccountStore.getState();
    expect(state.accounts).toHaveLength(2);
    expect(state.activeAccountId).toBe("acc-1");
  });

  describe("unified inbox", () => {
    const calDavAccount: Account = {
      id: "cal-1",
      email: "cal@icloud.com",
      displayName: "Calendar",
      avatarUrl: null,
      isActive: true,
      provider: "caldav",
    };

    it("is off by default", () => {
      expect(useAccountStore.getState().unifiedInbox).toBe(false);
    });

    it("lists only the active account when off", () => {
      useAccountStore.getState().setAccounts([mockAccount, mockAccount2]);
      expect(listedAccountIds(useAccountStore.getState())).toEqual(["acc-1"]);
    });

    it("lists every active mailbox when on", () => {
      useAccountStore.getState().setAccounts([mockAccount, mockAccount2]);
      useAccountStore.getState().setUnifiedInbox(true);
      expect(listedAccountIds(useAccountStore.getState())).toEqual([
        "acc-1",
        "acc-2",
      ]);
    });

    it("leaves out inactive accounts", () => {
      useAccountStore
        .getState()
        .setAccounts([mockAccount, { ...mockAccount2, isActive: false }]);
      useAccountStore.getState().setUnifiedInbox(true);
      expect(listedAccountIds(useAccountStore.getState())).toEqual(["acc-1"]);
    });

    it("leaves out CalDAV accounts, which have no mailbox", () => {
      useAccountStore.getState().setAccounts([mockAccount, calDavAccount]);
      useAccountStore.getState().setUnifiedInbox(true);
      expect(listedAccountIds(useAccountStore.getState())).toEqual(["acc-1"]);
      expect(mailAccounts(useAccountStore.getState().accounts)).toHaveLength(1);
    });

    it("returns nothing when there is no account at all", () => {
      expect(listedAccountIds(useAccountStore.getState())).toEqual([]);
    });

    it("leaves the unified view when a specific account is picked", () => {
      useAccountStore.getState().setAccounts([mockAccount, mockAccount2]);
      useAccountStore.getState().setUnifiedInbox(true);
      useAccountStore.getState().setActiveAccount("acc-2");

      const state = useAccountStore.getState();
      expect(state.unifiedInbox).toBe(false);
      expect(listedAccountIds(state)).toEqual(["acc-2"]);
    });

    it("drops the unified view when only one mailbox is left", () => {
      useAccountStore.getState().setAccounts([mockAccount, mockAccount2]);
      useAccountStore.getState().setUnifiedInbox(true);
      useAccountStore.getState().removeAccount("acc-2");
      expect(useAccountStore.getState().unifiedInbox).toBe(false);
    });

    it("restores a persisted value without writing it back", () => {
      useAccountStore.getState().setAccounts([mockAccount, mockAccount2]);
      useAccountStore.getState().restoreUnifiedInbox(true);
      expect(useAccountStore.getState().unifiedInbox).toBe(true);
    });
  });
});
