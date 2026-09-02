import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getAllAccounts, type DbAccount } from "@/services/db/accounts";
import { getSetting } from "@/services/db/settings";
import { buildImapConfig } from "./imapConfigBuilder";

/**
 * Let the mail server say when something changed, instead of asking it.
 *
 * The Rust side holds an IMAP IDLE connection per account and emits
 * `velo-idle-activity` when the server speaks. That event is only a doorbell:
 * the sync that answers it is the same one the timer would have run, so a
 * Gmail account keeps using the Gmail API for the actual data and only stops
 * waiting a minute to find out there is any.
 */

/** Gmail's IMAP endpoint. Used for accounts that sync over the API. */
const GMAIL_IMAP = { host: "imap.gmail.com", port: 993, security: "ssl" };

/** Ignore a second doorbell for the same account within this window. */
const DEBOUNCE_MS = 3000;

let unlistenActivity: UnlistenFn | null = null;
let unlistenFailure: UnlistenFn | null = null;
let lastFired = new Map<string, number>();
const failedAccounts = new Set<string>();

/** Accounts that could not idle, so the UI can explain the fallback. */
export function accountsWithoutIdle(): Set<string> {
  return new Set(failedAccounts);
}

/**
 * Whether an account can idle at all.
 *
 * A Gmail account authorised before the full-mailbox scope was requested has
 * a token IMAP will refuse, and there is no way to tell from here — the
 * connection failing is what says so, and the watcher stops for that account
 * while polling carries on.
 */
function idleConfigFor(account: DbAccount, accessToken?: string) {
  if (account.provider === "imap") {
    if (!account.imap_host) return null;
    return buildImapConfig(account, accessToken);
  }
  if (account.provider === "gmail_api") {
    if (!accessToken) return null;
    return {
      ...GMAIL_IMAP,
      username: account.email,
      password: accessToken,
      auth_method: "oauth2",
      accept_invalid_certs: false,
    };
  }
  return null;
}

/**
 * Start watching every account that can be watched.
 *
 * Safe to call again — the Rust side replaces an account's watcher rather
 * than adding a second, so a settings change or a new account just re-runs
 * this.
 */
export async function startIdleWatchers(): Promise<void> {
  const enabled = (await getSetting("imap_idle")) !== "false";
  if (!enabled) {
    await stopIdleWatchers();
    return;
  }

  await attachListeners();

  const accounts = await getAllAccounts();
  for (const account of accounts) {
    if (account.is_active === 0) continue;
    try {
      let accessToken: string | undefined;
      if (account.auth_method !== "password") {
        const { ensureFreshToken } = await import("@/services/oauth/oauthTokenManager");
        accessToken = await ensureFreshToken(account);
      }
      const config = idleConfigFor(account, accessToken);
      if (!config) continue;

      await invoke("imap_start_idle", { accountId: account.id, config });
      failedAccounts.delete(account.id);
    } catch (err) {
      // Not fatal: the account keeps syncing on the timer
      failedAccounts.add(account.id);
      console.warn(`IDLE unavailable for ${account.email}:`, err);
    }
  }
}

/** Stop every watcher and detach the listeners. */
export async function stopIdleWatchers(): Promise<void> {
  try {
    await invoke("imap_stop_all_idle");
  } catch (err) {
    console.error("Failed to stop IDLE watchers:", err);
  }
  unlistenActivity?.();
  unlistenActivity = null;
  unlistenFailure?.();
  unlistenFailure = null;
  lastFired = new Map();
}

async function attachListeners(): Promise<void> {
  if (unlistenActivity) return;

  unlistenActivity = await listen<{ account_id: string }>(
    "velo-idle-activity",
    (event) => {
      const accountId = event.payload.account_id;
      // A single arriving message can produce several untagged responses;
      // one sync answers all of them
      const now = Date.now();
      if (now - (lastFired.get(accountId) ?? 0) < DEBOUNCE_MS) return;
      lastFired.set(accountId, now);

      window.dispatchEvent(
        new CustomEvent("velo-idle-sync", { detail: { accountId } }),
      );
    },
  );

  unlistenFailure = await listen<{ account_id: string; error: string }>(
    "velo-idle-failed",
    (event) => {
      failedAccounts.add(event.payload.account_id);
      console.warn(
        `IDLE dropped for ${event.payload.account_id}: ${event.payload.error}`,
      );
    },
  );
}
