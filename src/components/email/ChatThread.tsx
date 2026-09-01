import { useCallback, useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import type { DbMessage } from "@/services/db/messages";

interface ChatThreadProps {
  messages: DbMessage[];
  /** Lowercased addresses belonging to the user — these draw on the right. */
  ownAddresses: Set<string>;
  blockImages?: boolean | null;
  allowlistedSenders?: Set<string>;
  isSpam?: boolean;
  onMessageContextMenu?: (e: React.MouseEvent, message: DbMessage) => void;
  /** Hides the collapse-all bar for nested lists that supply their own. */
  hideToolbar?: boolean;
  /**
   * Start every bubble folded. Used for past conversations, where the point
   * is to scan a long history rather than read it end to end.
   */
  defaultCollapsed?: boolean;
}

export function isOwnMessage(message: DbMessage, ownAddresses: Set<string>): boolean {
  return !!message.from_address && ownAddresses.has(message.from_address.toLowerCase());
}

/**
 * A thread rendered as a conversation: the user's messages on the right,
 * everyone else's on the left, each stripped down to the words that were
 * actually written.
 *
 * Every bubble starts open — the point of the view is to read the exchange in
 * one pass — with a single control to fold them all away again.
 */
export function ChatThread({
  messages,
  ownAddresses,
  blockImages,
  allowlistedSenders,
  isSpam,
  onMessageContextMenu,
  hideToolbar,
  defaultCollapsed = false,
}: ChatThreadProps) {
  // Only the exceptions to the default are tracked, so a newly synced message
  // inherits the default instead of appearing in whatever state a stale map
  // happened to hold
  const [toggledIds, setToggledIds] = useState<Set<string>>(() => new Set());
  const isCollapsed = useCallback(
    (id: string) => (defaultCollapsed ? !toggledIds.has(id) : toggledIds.has(id)),
    [defaultCollapsed, toggledIds],
  );

  const allCollapsed = messages.length > 0 && messages.every((m) => isCollapsed(m.id));

  const toggleAll = useCallback(() => {
    setToggledIds(() =>
      // The set holds exceptions to the default, so which side of the toggle
      // needs the full set flips with defaultCollapsed
      allCollapsed === defaultCollapsed ? new Set(messages.map((m) => m.id)) : new Set(),
    );
  }, [messages, allCollapsed, defaultCollapsed]);

  const toggleOne = useCallback((id: string) => {
    setToggledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rendered = useMemo(
    () => messages.map((msg) => ({ msg, mine: isOwnMessage(msg, ownAddresses) })),
    [messages, ownAddresses],
  );

  return (
    <div className="py-2">
      {!hideToolbar && (
        <div className="flex justify-end px-4 pb-1">
          <button
            onClick={toggleAll}
            className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {allCollapsed ? <ChevronsUpDown size={12} /> : <ChevronsDownUp size={12} />}
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
        </div>
      )}

      {rendered.map(({ msg, mine }) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          isMine={mine}
          collapsed={isCollapsed(msg.id)}
          onToggleCollapse={() => toggleOne(msg.id)}
          blockImages={blockImages}
          senderAllowlisted={
            msg.from_address ? allowlistedSenders?.has(msg.from_address) ?? false : false
          }
          isSpam={isSpam}
          onContextMenu={
            onMessageContextMenu ? (e) => onMessageContextMenu(e, msg) : undefined
          }
        />
      ))}
    </div>
  );
}
