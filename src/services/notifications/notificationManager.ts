import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  registerActionTypes,
  onAction,
} from "@tauri-apps/plugin-notification";
import { getSetting } from "../db/settings";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useComposerStore } from "../../stores/composerStore";
import { navigateToLabel } from "../../router/navigate";
import { normalizeEmail } from "@/utils/emailUtils";

let initialized = false;
let notificationsEnabled = true;

interface NotificationContext {
  threadId?: string;
  accountId?: string;
  fromAddress?: string;
  subject?: string;
  /** A one-time code the notification is offering to copy. */
  code?: string;
  /** A sign-in link the notification is offering to open. */
  linkUrl?: string;
}

let lastNotificationContext: NotificationContext | null = null;
const recentContexts = new Map<string, NotificationContext>();

async function showAndFocusMainWindow(): Promise<void> {
  const mainWindow = await WebviewWindow.getByLabel("main");
  if (mainWindow) {
    await mainWindow.show();
    await mainWindow.setFocus();
  }
}

/**
 * Initialize notification permissions and action types.
 */
export async function initNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const setting = await getSetting("notifications_enabled");
  notificationsEnabled = setting !== "false";

  if (!notificationsEnabled) return;

  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }

  if (!granted) {
    notificationsEnabled = false;
    return;
  }

  // Register action types and handlers (not available on all platforms)
  try {
    await registerActionTypes([
      {
        id: "default",
        actions: [],
      },
      {
        id: "email",
        actions: [
          { id: "reply", title: "Reply" },
          { id: "archive", title: "Archive" },
        ],
      },
      {
        id: "otp-code",
        actions: [{ id: "copy-code", title: "Copy code" }],
      },
      {
        id: "otp-link",
        actions: [{ id: "open-link", title: "Open link" }],
      },
      {
        id: "otp-both",
        actions: [
          { id: "copy-code", title: "Copy code" },
          { id: "open-link", title: "Open link" },
        ],
      },
    ]);

    await onAction(async (event) => {
      const actionId = event.actionTypeId;
      const ctx = lastNotificationContext;

      if (actionId === "copy-code" && ctx?.code) {
        try {
          const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
          await writeText(ctx.code);
        } catch (err) {
          console.error("Failed to copy the code from a notification:", err);
        }
      } else if (actionId === "open-link" && ctx?.linkUrl) {
        // Through the app rather than straight to the browser: a link in mail
        // is exactly the phishing vector, so it goes past the same check a
        // click inside the message would
        await showAndFocusMainWindow();
        window.dispatchEvent(new CustomEvent("velo-open-signin-link", {
          detail: { url: ctx.linkUrl, threadId: ctx.threadId, accountId: ctx.accountId },
        }));
      } else if (actionId === "reply" && ctx?.threadId && ctx?.accountId) {
        await showAndFocusMainWindow();
        useComposerStore.getState().openComposer({
          mode: "reply",
          to: ctx.fromAddress ? [ctx.fromAddress] : [],
          subject: ctx.subject ? `Re: ${ctx.subject}` : "",
          threadId: ctx.threadId,
          accountId: ctx.accountId,
        });
      } else if (actionId === "archive" && ctx?.threadId && ctx?.accountId) {
        try {
          const { archiveThread } = await import("../emailActions");
          await archiveThread(ctx.accountId, ctx.threadId, []);
        } catch (err) {
          console.error("Failed to archive from notification:", err);
        }
      } else {
        await showAndFocusMainWindow();
        if (ctx?.threadId) {
          navigateToLabel("inbox", { threadId: ctx.threadId });
        }
      }
    });
  } catch {
    // registerActionTypes/onAction not available on this platform (e.g. Windows)
  }
}

/**
 * Show a notification for new emails.
 * Batches notifications to avoid spam during sync.
 */
let pendingCount = 0;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

export function queueNewEmailNotification(
  from: string,
  subject: string,
  threadId?: string,
  accountId?: string,
  fromAddress?: string,
): void {
  if (!notificationsEnabled) return;

  pendingCount++;

  // Store context for action handling
  const ctx = { threadId, accountId, fromAddress, subject };
  lastNotificationContext = ctx;
  if (threadId) recentContexts.set(threadId, ctx);

  // Debounce: wait 2s before showing, to batch during sync
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    if (pendingCount === 1) {
      sendNotification({
        title: from,
        body: subject || "(No subject)",
        actionTypeId: "email",
      });
    } else if (pendingCount > 1) {
      sendNotification({
        title: "Velo",
        body: `${pendingCount} new emails`,
        actionTypeId: "email",
      });
    }
    pendingCount = 0;
    notifyTimer = null;
  }, 2000);
}

/**
 * Determine if a new email should trigger a notification based on smart notification settings.
 * Pure function — no I/O, all config is passed in from the sync cycle.
 */
export function shouldNotifyForMessage(
  smartEnabled: boolean,
  allowedCategories: Set<string>,
  vipSenders: Set<string>,
  threadCategory: string | null,
  fromAddress?: string,
  opts?: {
    /** Mailboxes chosen in settings. Empty means every account notifies. */
    allowedAccounts?: Set<string>;
    accountId?: string;
    /** A mail rule matched this message with a "Notify me" action. */
    ruleRequested?: boolean;
  },
): boolean {
  // A mailbox the user did not pick stays quiet even for a rule or a VIP — it
  // is the coarsest choice they made, so it wins. Picking none means none:
  // silence is a setting, not an empty list to be ignored. One-time codes and
  // sign-in links never reach this function, so they still come through.
  const allowedAccounts = opts?.allowedAccounts;
  if (allowedAccounts && opts?.accountId && !allowedAccounts.has(opts.accountId)) {
    return false;
  }
  // A rule saying "notify me" is an explicit instruction, so it outranks the
  // category filter the same way a VIP does
  if (opts?.ruleRequested) return true;
  if (!smartEnabled) return true; // Smart notifications off → notify everything
  if (fromAddress && vipSenders.has(normalizeEmail(fromAddress))) return true; // VIP always notifies
  const category = threadCategory ?? "Primary"; // uncategorized defaults to Primary
  return allowedCategories.has(category);
}

/**
 * Show a notification for a follow-up reminder that fired.
 */
export function notifyFollowUpDue(
  subject: string,
  threadId?: string,
  accountId?: string,
): void {
  if (!notificationsEnabled) return;
  const ctx = { threadId, accountId, subject };
  lastNotificationContext = ctx;
  if (threadId) recentContexts.set(threadId, ctx);
  sendNotification({
    title: "Follow up needed",
    body: subject || "(No subject)",
    actionTypeId: "email",
  });
}

/**
 * Show a notification for a snoozed email returning.
 */
export function notifySnoozeReturn(subject: string): void {
  if (!notificationsEnabled) return;
  sendNotification({
    title: "Snoozed email returned",
    body: subject || "(No subject)",
    actionTypeId: "default",
  });
}

/**
 * Announce a one-time code or a sign-in link, with the buttons that make it
 * useful and the context the click handler needs.
 *
 * Sent through here rather than calling sendNotification directly, because a
 * notification with no actionTypeId carries no buttons and no context — the
 * click then has nothing to open and merely focuses the window.
 */
export function notifyOneTimeCode(opts: {
  code?: string;
  linkUrl?: string;
  sender: string;
  copied: boolean;
  threadId?: string;
  accountId?: string;
}): void {
  if (!notificationsEnabled) return;

  const ctx: NotificationContext = {
    threadId: opts.threadId,
    accountId: opts.accountId,
    code: opts.code,
    linkUrl: opts.linkUrl,
  };
  lastNotificationContext = ctx;
  if (opts.threadId) recentContexts.set(opts.threadId, ctx);

  if (opts.code && opts.linkUrl) {
    sendNotification({
      title: opts.copied ? `Code copied: ${opts.code}` : `Code: ${opts.code}`,
      // No buttons on desktop notifications; the link is a click away in Velo
      body: `From ${opts.sender} — ${opts.copied ? "ready to paste. " : ""}Sign-in link waiting in Velo`,
      actionTypeId: "otp-both",
    });
    return;
  }

  if (opts.code) {
    sendNotification({
      title: opts.copied ? `Code copied: ${opts.code}` : `Code: ${opts.code}`,
      body: opts.copied ? `From ${opts.sender} — ready to paste` : `From ${opts.sender}`,
      actionTypeId: "otp-code",
    });
    return;
  }

  sendNotification({
    title: "Sign-in link",
    body: `From ${opts.sender} — open it from Velo`,
    actionTypeId: "otp-link",
  });
}
