import { getDb } from "../db/connection";
import { cacheThreadForOpening } from "./openThread";
import { useAccountStore } from "@/stores/accountStore";
import { useThreadStore } from "@/stores/threadStore";
import { useMailLinkStore } from "@/stores/mailLinkStore";
import { navigateToLabel } from "@/router/navigate";
import type { MailLinkTarget } from "@/utils/mailLink";

export async function openMailLink(target: MailLinkTarget): Promise<void> {
  const db = await getDb();
  // Even a previously cached thread must be checked against current ownership.
  const rows = await db.select<Array<{ id: string }>>(
    `SELECT t.id FROM threads t JOIN accounts a ON a.id = t.account_id
     WHERE t.account_id = $1 AND t.id = $2` + (target.messageId ?
      ` AND EXISTS (SELECT 1 FROM messages m WHERE m.account_id = t.account_id
         AND m.thread_id = t.id AND m.id = $3 AND m.is_read_receipt = 0)` : ""),
    target.messageId ? [target.accountId, target.threadId, target.messageId] : [target.accountId, target.threadId],
  );
  if (!rows.length) throw new Error("This email is unavailable in that account. It may have been moved, deleted, or not synced yet.");
  // Clear a stale list entry with the same provider ID in another mailbox.
  const store = useThreadStore.getState();
  const collision = store.threadMap.get(target.threadId);
  if (collision && collision.accountId !== target.accountId) {
    store.setThreads(store.threads.filter((thread) => thread.id !== target.threadId));
  }
  if (!await cacheThreadForOpening(target.accountId, target.threadId)) {
    throw new Error("This email is no longer available. Refresh the search index and try again.");
  }
  const accounts = useAccountStore.getState();
  if (accounts.activeAccountId !== target.accountId) accounts.setActiveAccount(target.accountId);
  useThreadStore.getState().clearSearch();
  useMailLinkStore.getState().request(target);
  navigateToLabel("all", { threadId: target.threadId, accountId: target.accountId });
}
