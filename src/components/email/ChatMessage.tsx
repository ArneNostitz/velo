import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Maximize2, Minimize2, CheckCheck } from "lucide-react";
import { formatFullDate } from "@/utils/date";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { trimMessageBody } from "@/utils/messageTrim";
import { EmailRenderer } from "./EmailRenderer";
import { InlineAttachmentPreview } from "./InlineAttachmentPreview";
import { AttachmentList, useAttachmentViewer, getAttachmentsForMessage } from "./AttachmentList";
import { SenderAvatar } from "./SenderAvatar";
import { AuthBadge } from "./AuthBadge";
import type { DbMessage } from "@/services/db/messages";
import type { DbAttachment } from "@/services/db/attachments";

interface ChatMessageProps {
  message: DbMessage;
  /** Written by the user — draws on the right, in the accent colour. */
  isMine: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  blockImages?: boolean | null;
  senderAllowlisted?: boolean;
  isSpam?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/**
 * One message as a chat bubble.
 *
 * The body is trimmed to what the sender actually typed — the quoted mail
 * they replied to and their signature are the previous bubbles and the header
 * respectively, so repeating them turns a conversation into a wall. "View
 * full" puts the original back for the one message the reader cares about.
 */
export const ChatMessage = memo(function ChatMessage({
  message,
  isMine,
  collapsed,
  onToggleCollapse,
  blockImages,
  senderAllowlisted,
  isSpam,
  onContextMenu,
}: ChatMessageProps) {
  useTimeFormat();
  const [showFull, setShowFull] = useState(false);
  const [attachments, setAttachments] = useState<DbAttachment[]>([]);
  const attachmentsLoadedRef = useRef(false);

  useEffect(() => {
    if (collapsed || attachmentsLoadedRef.current) return;
    attachmentsLoadedRef.current = true;
    getAttachmentsForMessage(message.account_id, message.id)
      .then(setAttachments)
      .catch(() => {
        // Non-critical — the bubble still renders, just without attachments
      });
  }, [collapsed, message.account_id, message.id]);

  const trimmed = useMemo(
    () => trimMessageBody(message.body_html, message.body_text),
    [message.body_html, message.body_text],
  );

  const referencedCids = useMemo(() => {
    const cids = new Set<string>();
    const source = showFull ? message.body_html : trimmed.html;
    if (!source) return cids;
    const regex = /\bcid:([^"'\s)]+)/gi;
    let m;
    while ((m = regex.exec(source)) !== null) {
      cids.add(m[1]!);
    }
    return cids;
  }, [showFull, message.body_html, trimmed.html]);

  const { openAttachment, viewer: attachmentViewer } = useAttachmentViewer(
    message.account_id,
    attachments,
    referencedCids,
  );

  const fromDisplay = message.from_name ?? message.from_address ?? "Unknown";
  const openedCount = isMine ? (message.read_receipt_count ?? 0) : 0;
  const bodyHtml = showFull ? message.body_html : trimmed.html;
  const bodyText = showFull ? message.body_text : trimmed.text;

  return (
    <div
      className={`flex px-4 py-2 ${isMine ? "justify-end" : "justify-start"}`}
      onContextMenu={onContextMenu}
    >
      <div className={`min-w-0 max-w-[85%] @[900px]:max-w-[72%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
        {/* Who and when, bundled — the avatar sits on the outside edge so the
            two sides of the conversation read as two columns */}
        <div className={`flex items-center gap-2 mb-1 ${isMine ? "flex-row-reverse" : ""}`}>
          <SenderAvatar
            email={message.from_address}
            name={message.from_name}
            isRead
            className="w-6 h-6 text-[0.625rem] shrink-0"
          />
          <div className={`flex items-baseline gap-1.5 min-w-0 ${isMine ? "flex-row-reverse" : ""}`}>
            <span className="text-xs font-medium text-text-primary truncate">
              {isMine ? "You" : fromDisplay}
            </span>
            <span className="text-[0.625rem] text-text-tertiary whitespace-nowrap">
              {formatFullDate(message.date)}
            </span>
            <AuthBadge authResults={message.auth_results} />
            {openedCount > 0 && (
              <span
                className="inline-flex items-center gap-0.5 text-[0.625rem] px-1.5 py-px rounded-full bg-success/15 text-success shrink-0"
                title="Read receipt received"
              >
                <CheckCheck size={10} />
                {openedCount > 1 ? `${openedCount}×` : "Opened"}
              </span>
            )}
          </div>
        </div>

        <div
          className={`w-full rounded-2xl border px-3 py-2 ${
            isSpam
              ? "bg-red-500/10 border-red-500/30"
              : isMine
                ? "bg-accent-light border-accent/25 rounded-tr-sm"
                : "bg-bg-secondary border-border-secondary rounded-tl-sm"
          }`}
        >
          {collapsed ? (
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center gap-1 text-left text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <ChevronRight size={12} className="shrink-0" />
              <span className="truncate">{message.snippet || "(No preview)"}</span>
            </button>
          ) : (
            <>
              {blockImages != null ? (
                <EmailRenderer
                  html={bodyHtml}
                  text={bodyText}
                  blockImages={blockImages}
                  senderAddress={message.from_address}
                  accountId={message.account_id}
                  senderAllowlisted={senderAllowlisted}
                  messageId={message.id}
                  inlineAttachments={attachments.filter((a) => a.content_id)}
                />
              ) : (
                <div className="py-4 text-center text-text-tertiary text-xs">Loading...</div>
              )}

              <InlineAttachmentPreview
                accountId={message.account_id}
                messageId={message.id}
                attachments={attachments}
                referencedCids={referencedCids}
                onAttachmentClick={openAttachment}
              />

              <AttachmentList
                accountId={message.account_id}
                messageId={message.id}
                attachments={attachments}
                referencedCids={referencedCids}
                onOpenAttachment={openAttachment}
              />

              {attachmentViewer}
            </>
          )}
        </div>

        {/* Controls sit under the bubble so they never crowd the text */}
        {!collapsed && (
          <div className={`flex items-center gap-2 mt-1 ${isMine ? "flex-row-reverse" : ""}`}>
            <button
              onClick={onToggleCollapse}
              className="flex items-center gap-0.5 text-[0.625rem] text-text-tertiary hover:text-text-secondary transition-colors"
              title="Collapse this message"
            >
              <ChevronDown size={11} />
              Collapse
            </button>
            {(trimmed.trimmed || showFull) && (
              <button
                onClick={() => setShowFull((v) => !v)}
                className="flex items-center gap-0.5 text-[0.625rem] text-accent hover:underline"
                title={showFull ? "Hide quotes and signature again" : "Show the original mail with quotes and signature"}
              >
                {showFull ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                {showFull ? "View trimmed" : "View full"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
