import { getThreadById, getThreadLabelIds } from "../db/threads";
import { useThreadStore } from "@/stores/threadStore";

/**
 * Make a thread openable even when the list it belongs to is not the list on
 * screen — a notification's mail may have been archived by a rule, may live
 * in another mailbox, or may simply not be in the page the app has loaded.
 *
 * The thread goes into `cachedThreads`, which `ReadingPane` falls back to, so
 * nothing about the visible mailbox is rearranged to show it.
 *
 * Returns false when there is no such thread in the local database — the mail
 * has not been synced yet, or was deleted.
 */
export async function cacheThreadForOpening(
  accountId: string,
  threadId: string,
): Promise<boolean> {
  const { threadMap, cachedThreads } = useThreadStore.getState();
  if (threadMap.has(threadId) || cachedThreads.has(threadId)) return true;

  const dbThread = await getThreadById(accountId, threadId);
  if (!dbThread) return false;
  const labelIds = await getThreadLabelIds(accountId, threadId);

  useThreadStore.getState().cacheThread({
    id: dbThread.id,
    accountId: dbThread.account_id,
    subject: dbThread.subject,
    snippet: dbThread.snippet,
    lastMessageAt: dbThread.last_message_at ?? 0,
    messageCount: dbThread.message_count,
    isRead: dbThread.is_read === 1,
    isStarred: dbThread.is_starred === 1,
    isPinned: dbThread.is_pinned === 1,
    isMuted: dbThread.is_muted === 1,
    hasAttachments: dbThread.has_attachments === 1,
    labelIds,
    fromName: dbThread.from_name,
    fromAddress: dbThread.from_address,
  });
  return true;
}
