import { create } from "zustand";

/**
 * Whether instant delivery is actually live for an account.
 *
 * "off"        — the setting is off, or the account cannot idle at all
 * "connecting" — a watcher has been asked for and has not reported back
 * "connected"  — the server is holding our IDLE connection open
 * "failed"     — the last attempt was refused; the timer covers the account
 *
 * The setting being on says nothing about any of this — a Gmail account
 * authorised without the mail scope is refused every time — so the state is
 * driven by what the Rust watcher reports, not by what was requested.
 */
export type IdleState = "off" | "connecting" | "connected" | "failed";

interface IdleStatusStore {
  statuses: Record<string, IdleState>;
  /** The reason behind a "failed", for the tooltip to explain. */
  reasons: Record<string, string>;
  setStatus: (accountId: string, state: IdleState, reason?: string) => void;
  clearAll: () => void;
}

export const useIdleStatusStore = create<IdleStatusStore>((set) => ({
  statuses: {},
  reasons: {},
  setStatus: (accountId, state, reason) =>
    set((s) => {
      const reasons = { ...s.reasons };
      if (reason) reasons[accountId] = reason;
      else delete reasons[accountId];
      return { statuses: { ...s.statuses, [accountId]: state }, reasons };
    }),
  clearAll: () => set({ statuses: {}, reasons: {} }),
}));

/** Plain words for a state, shared by every place that shows it. */
export function describeIdleState(state: IdleState | undefined): string {
  switch (state) {
    case "connected":
      return "Instant delivery on";
    case "connecting":
      return "Connecting…";
    case "failed":
      return "Checking on a timer";
    default:
      return "Instant delivery off";
  }
}

/**
 * Turn a server's refusal into something a person can act on. The raw error
 * is kept in the store for the tooltip; this is the one-line version.
 */
export function explainIdleFailure(reason: string | undefined): string {
  if (!reason) return "The server refused the connection.";
  if (/AUTHENTICATIONFAILED|invalid credentials|auth/i.test(reason)) {
    return "The server refused the login. For Gmail this means the account needs re-authorising to grant IMAP access.";
  }
  if (/timed out|timeout/i.test(reason)) {
    return "The server did not answer in time.";
  }
  if (/IMAP.*disabled|not enabled/i.test(reason)) {
    return "IMAP is switched off for this account in the provider's settings.";
  }
  return reason;
}
