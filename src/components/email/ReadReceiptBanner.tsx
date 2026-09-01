import { useEffect, useRef, useState } from "react";
import { CheckCheck, X } from "lucide-react";
import type { DbMessage } from "@/services/db/messages";
import { useAccountStore } from "@/stores/accountStore";
import {
  dismissReadReceipt,
  getReadReceiptResponseMode,
  isReceiptAddressSuspicious,
  needsReadReceipt,
  parseReceiptAddress,
  sendReadReceipt,
} from "@/services/email/readReceipts";

interface ReadReceiptBannerProps {
  message: DbMessage;
}

type BannerState =
  | "hidden"
  | "ask"
  | "sending"
  | "sent"
  | "failed";

/**
 * Shown on an opened message whose sender requested a read receipt
 * (Disposition-Notification-To). The `read_receipt_response` setting decides
 * whether to ask, answer automatically, or stay silent; an answered or
 * dismissed request never prompts again.
 */
export function ReadReceiptBanner({ message }: ReadReceiptBannerProps) {
  const accounts = useAccountStore((s) => s.accounts);
  const [state, setState] = useState<BannerState>("hidden");
  const startedRef = useRef(false);

  const accountEmail =
    accounts.find((a) => a.id === message.account_id)?.email ?? null;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!needsReadReceipt(message, accountEmail)) return;

    let cancelled = false;
    (async () => {
      const mode = await getReadReceiptResponseMode();
      if (cancelled || mode === "never") return;

      const receiptAddress = parseReceiptAddress(
        message.disposition_notification_to,
      );
      const suspicious =
        !receiptAddress ||
        isReceiptAddressSuspicious(receiptAddress, message.from_address);

      // "Always" auto-answers, but a receipt address on a foreign domain
      // still gets an explicit prompt (RFC 8098 §2.1 anti-tracking advice)
      if (mode === "always" && !suspicious) {
        setState("sending");
        try {
          await sendReadReceipt(message, true);
          if (!cancelled) setState("hidden");
        } catch (err) {
          console.error("Failed to auto-send read receipt:", err);
          if (!cancelled) setState("hidden");
        }
        return;
      }

      if (!cancelled) setState("ask");
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "hidden" || state === "sending") return null;

  const requester = message.from_name ?? message.from_address ?? "The sender";

  const handleSend = async () => {
    setState("sending");
    try {
      await sendReadReceipt(message, false);
      setState("sent");
    } catch (err) {
      console.error("Failed to send read receipt:", err);
      setState("failed");
    }
  };

  const handleDismiss = async () => {
    setState("hidden");
    try {
      await dismissReadReceipt(message);
    } catch (err) {
      console.error("Failed to record read receipt dismissal:", err);
    }
  };

  if (state === "sent") {
    return (
      <div className="bg-success/10 border border-success/20 rounded-lg p-3 mb-3 flex items-center gap-2">
        <CheckCheck size={16} className="text-success shrink-0" />
        <p className="text-sm text-text-secondary">Read receipt sent.</p>
      </div>
    );
  }

  return (
    <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 mb-3 flex items-start gap-2">
      <CheckCheck size={16} className="text-accent shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary font-medium">
          {state === "failed"
            ? "Sending the read receipt failed"
            : "Read receipt requested"}
        </p>
        <p className="text-xs text-text-secondary mt-0.5">
          {requester} asked to be notified when you read this message.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleSend}
            className="text-xs px-2.5 py-1 rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            {state === "failed" ? "Retry" : "Send receipt"}
          </button>
          <button
            onClick={handleDismiss}
            className="text-xs px-2.5 py-1 rounded-md text-text-secondary hover:bg-bg-hover transition-colors"
          >
            Don't send
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-0.5 rounded hover:bg-accent/10 text-text-tertiary hover:text-text-secondary transition-colors"
        aria-label="Dismiss read receipt request"
      >
        <X size={14} />
      </button>
    </div>
  );
}
