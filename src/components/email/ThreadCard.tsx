import { memo, useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Thread } from "@/stores/threadStore";
import { useAccountStore } from "@/stores/accountStore";
import { accountColor } from "@/constants/accountColors";
import { useThreadStore } from "@/stores/threadStore";
import { useUIStore } from "@/stores/uiStore";
import { useActiveLabel } from "@/hooks/useRouteNavigation";
import { formatRelativeDate } from "@/utils/date";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { Paperclip, Star, Check, Pin, BellRing, VolumeX, CheckSquare } from "lucide-react";
import { SenderAvatar } from "./SenderAvatar";
import type { DragData } from "@/components/dnd/DndProvider";
import { useLabelStore } from "@/stores/labelStore";
import { threadFolder, type ThreadFolderId } from "@/utils/threadFolder";

// A search result names where it lives. Trash and Spam shout: acting on a
// hit there is not the same as acting on one in the inbox.
const FOLDER_COLORS: Partial<Record<ThreadFolderId, string>> = {
  trash: "bg-danger/15 text-danger",
  spam: "bg-warning/15 text-warning",
  drafts: "bg-accent/15 text-accent",
};

const CATEGORY_COLORS: Record<string, string> = {
  Updates: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  Promotions: "bg-green-500/15 text-green-600 dark:text-green-400",
  Social: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  Newsletters: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
};

interface ThreadCardProps {
  thread: Thread;
  isSelected: boolean;
  onClick: (thread: Thread) => void;
  onContextMenu?: (e: React.MouseEvent, threadId: string) => void;
  category?: string;
  showCategoryBadge?: boolean;
  hasFollowUp?: boolean;
  hasTask?: boolean;
  /** Tag the row with the folder it is in — for search hits, which can come from anywhere */
  showFolder?: boolean;
}

export const ThreadCard = memo(function ThreadCard({ thread, isSelected, onClick, onContextMenu, category, showCategoryBadge, hasFollowUp, hasTask, showFolder }: ThreadCardProps) {
  const isMultiSelected = useThreadStore((s) => s.selectedThreadIds.has(thread.id));
  const isRemoving = useThreadStore((s) => s.removingThreadIds.has(thread.id));
  const hasMultiSelect = useThreadStore((s) => s.selectedThreadIds.size > 0);
  const toggleThreadSelection = useThreadStore((s) => s.toggleThreadSelection);
  const selectThreadRange = useThreadStore((s) => s.selectThreadRange);
  const activeLabel = useActiveLabel();
  // Only in the unified list is it ambiguous which mailbox a thread came from
  const unifiedInbox = useAccountStore((s) => s.unifiedInbox);
  const accounts = useAccountStore((s) => s.accounts);
  const threadAccountIndex = unifiedInbox
    ? accounts.findIndex((a) => a.id === thread.accountId)
    : -1;
  const threadAccount = threadAccountIndex >= 0 ? accounts[threadAccountIndex] : undefined;
  const threadAccountColor = threadAccount
    ? accountColor(threadAccount.color, threadAccountIndex)
    : null;
  const emailDensity = useUIStore((s) => s.emailDensity);
  // Repaint when the 12/24-hour preference changes
  useTimeFormat();
  const isSpam = thread.labelIds.includes("SPAM");
  // Names for user labels, so a hit filed under one says "Receipts" not "Archive"
  const labels = useLabelStore((s) => s.labels);
  const folder = useMemo(() => {
    if (!showFolder) return null;
    const names = new Map(labels.map((l) => [l.id, l.name]));
    return threadFolder(thread.labelIds, names);
  }, [showFolder, labels, thread.labelIds]);

  // Read selectedThreadIds lazily for drag — avoids subscribing all cards to the Set reference
  const dragData: DragData = useMemo(() => ({
    threadIds: hasMultiSelect && isMultiSelected
      ? [...useThreadStore.getState().selectedThreadIds]
      : [thread.id],
    sourceLabel: activeLabel,
  }), [hasMultiSelect, isMultiSelected, thread.id, activeLabel]);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `thread-${thread.id}`,
    data: dragData,
  });

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      e.preventDefault();
      selectThreadRange(thread.id);
    } else if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggleThreadSelection(thread.id);
    } else if (hasMultiSelect) {
      toggleThreadSelection(thread.id);
    } else {
      onClick(thread);
    }
  };

  const handleContextMenu = onContextMenu
    ? (e: React.MouseEvent) => onContextMenu(e, thread.id)
    : undefined;

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      aria-label={`${thread.isRead ? "" : "Unread "}email from ${thread.fromName ?? thread.fromAddress ?? "Unknown"}: ${thread.subject ?? "(No subject)"}`}
      aria-selected={isSelected}
      className={`relative w-full text-left border-b border-border-secondary group hover-lift press-scale ${
        isRemoving ? "thread-exit " : ""
      }${
        emailDensity === "compact" ? "px-3 py-1.5" : emailDensity === "spacious" ? "px-4 py-4" : "px-4 py-3"
      } ${
        isDragging
          ? "opacity-50"
          : isMultiSelected
            ? "bg-accent/10"
            : isSelected
              ? "bg-bg-selected"
              : "hover:bg-bg-hover"
      } ${isSpam ? "bg-red-500/8 dark:bg-red-500/10" : ""}`}
    >
      {/* Which mailbox this belongs to — only ambiguous in the unified list */}
      {threadAccount && threadAccountColor && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: threadAccountColor.hex }}
          title={threadAccount.email}
        />
      )}

      <div className="flex items-start gap-3">
        {/* Avatar (sender photo → domain logo → initial); unread is a ring
            around it plus a dot below, so the avatar itself never changes.
            The column stretches to the row's height so the dot can sit in the
            space under the avatar rather than hanging off its edge. */}
        <div className="flex flex-col items-center self-stretch shrink-0">
          {isMultiSelected ? (
            <div
              className={`rounded-full flex items-center justify-center font-medium text-white bg-accent ${
                emailDensity === "compact" ? "w-7 h-7 text-xs" : emailDensity === "spacious" ? "w-10 h-10 text-sm" : "w-9 h-9 text-sm"
              }`}
            >
              <Check size={emailDensity === "compact" ? 14 : 16} />
            </div>
          ) : (
            <SenderAvatar
              email={thread.fromAddress}
              name={thread.fromName}
              className={`${
                emailDensity === "compact" ? "w-7 h-7 text-xs" : emailDensity === "spacious" ? "w-10 h-10 text-sm" : "w-9 h-9 text-sm"
              } ${
                // Unread rings the avatar rather than recolouring it: a photo or
                // a company logo cannot be tinted, so only the ring is a mark
                // every sender can carry. Offset transparent so the row's own
                // background — hover, selected, spam — shows through the gap.
                thread.isRead ? "" : "ring-2 ring-accent ring-offset-1 ring-offset-transparent"
              }`}
            />
          )}
          {!thread.isRead && !isMultiSelected && (
            <div aria-hidden="true" className="flex-1 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* First row: sender + date */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-sm truncate ${
                thread.isRead
                  ? "text-text-secondary"
                  : "font-semibold text-text-primary"
              }`}
            >
              {thread.fromName ?? thread.fromAddress ?? "Unknown"}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              {folder && (
                <span
                  data-testid="thread-folder"
                  className={`text-[0.625rem] px-1.5 rounded-full leading-normal whitespace-nowrap max-w-24 truncate ${
                    FOLDER_COLORS[folder.id] ?? "bg-bg-tertiary text-text-secondary"
                  }`}
                  title={`In ${folder.name}`}
                >
                  {folder.name}
                </span>
              )}
              <span className="text-xs text-text-tertiary whitespace-nowrap">
                {formatRelativeDate(thread.lastMessageAt)}
              </span>
            </span>
          </div>

          {/* Subject */}
          <div
            className={`text-sm truncate mt-0.5 ${
              thread.isRead ? "text-text-secondary" : "text-text-primary"
            }`}
          >
            {thread.subject ?? "(No subject)"}
          </div>

          {/* Snippet + indicators */}
          <div className={`flex items-center gap-1.5 mt-0.5 ${emailDensity === "compact" ? "hidden" : ""}`}>
            <span className="text-xs text-text-tertiary truncate flex-1">
              {/* Who spoke last — a thread waiting on them reads differently
                  from one waiting on you */}
              {thread.lastFromMe && (
                <span
                  className="mr-1 px-1 py-px bg-blue-500/15 text-blue-600 dark:text-blue-300 font-medium align-baseline"
                  style={{ borderRadius: "5px" }}
                  title="You sent the last message"
                >
                  me:
                </span>
              )}
              {thread.snippet}
            </span>
            {showCategoryBadge && category && category !== "Primary" && CATEGORY_COLORS[category] && (
              <span className={`shrink-0 text-[0.625rem] px-1.5 rounded-full leading-normal ${CATEGORY_COLORS[category]}`}>
                {category}
              </span>
            )}
            {hasFollowUp && (
              <span className="shrink-0 text-accent" title="Follow-up reminder set">
                <BellRing size={12} />
              </span>
            )}
            {hasTask && (
              <span className="shrink-0 text-accent" title="Has an open task">
                <CheckSquare size={12} />
              </span>
            )}
            {thread.isMuted && (
              <span className="shrink-0 text-warning" title="Muted">
                <VolumeX size={12} />
              </span>
            )}
            {thread.isPinned && (
              <span className="shrink-0 text-accent" title="Pinned">
                <Pin size={12} className="fill-current" />
              </span>
            )}
            {thread.hasAttachments && (
              <span className="shrink-0 text-text-tertiary" title="Has attachments">
                <Paperclip size={12} />
              </span>
            )}
            {thread.isStarred && (
              <span className="shrink-0 text-warning star-animate" title="Starred">
                <Star size={12} className="fill-current" />
              </span>
            )}
            {thread.messageCount > 1 && (
              <span className="text-xs text-text-tertiary shrink-0 bg-bg-tertiary rounded-full px-1.5">
                {thread.messageCount}
              </span>
            )}
          </div>
        </div>
      </div>

    </button>
  );
});
