import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, Copy, ExternalLink, MapPin, MessageSquare, Phone, UserPlus, X } from "lucide-react";
import type { EmailDataAction } from "@/utils/emailDataActions";

interface EmailDataActionMenuProps {
  action: EmailDataAction;
  position: { x: number; y: number };
  onClose: () => void;
  onOpen: (href: string) => void;
  onCopy: (value: string) => void;
  onCompose: (href: string) => void;
  onAddContact: (email: string, name: string | null) => void;
  onCreateEvent: (action: EmailDataAction) => void;
}

interface ActionButtonProps {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
}

function ActionButton({ icon: Icon, label, onClick }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-text-primary hover:bg-bg-hover transition-colors"
    >
      <Icon size={14} className="text-text-tertiary shrink-0" />
      {label}
    </button>
  );
}

export function EmailDataActionMenu({
  action,
  position,
  onClose,
  onOpen,
  onCopy,
  onCompose,
  onAddContact,
  onCreateEvent,
}: EmailDataActionMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const safePosition = useMemo(() => ({
    left: Math.max(8, Math.min(position.x, window.innerWidth - 248)),
    top: Math.max(8, Math.min(position.y + 8, window.innerHeight - 220)),
  }), [position]);

  useEffect(() => {
    const closeOnPointer = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", closeOnPointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnPointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const run = (callback: () => void) => {
    callback();
    onClose();
  };

  const simpleEmail = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(action.value);
  const displayName = simpleEmail && action.label.toLowerCase() !== action.value.toLowerCase()
    ? action.label
    : null;

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label={`Actions for ${action.label}`}
      className="fixed z-[100] w-60 overflow-hidden rounded-lg border border-border-primary bg-bg-primary glass-panel shadow-xl"
      style={safePosition}
    >
      <div className="flex items-start gap-2 border-b border-border-primary px-3 py-2">
        <p className="min-w-0 flex-1 whitespace-normal break-words text-xs font-medium text-text-primary">
          {action.label}
        </p>
        <button type="button" onClick={onClose} aria-label="Close actions" className="text-text-tertiary hover:text-text-primary">
          <X size={13} />
        </button>
      </div>

      {action.kind === "email" && (
        <>
          <ActionButton icon={MessageSquare} label="Write email" onClick={() => run(() => onCompose(action.href ?? `mailto:${action.value}`))} />
          <ActionButton icon={Copy} label="Copy email address" onClick={() => run(() => onCopy(action.value))} />
          {simpleEmail && (
            <ActionButton icon={UserPlus} label="Add to contacts" onClick={() => run(() => onAddContact(action.value, displayName))} />
          )}
        </>
      )}

      {action.kind === "phone" && (
        <>
          <ActionButton
            icon={action.href?.startsWith("sms:") ? MessageSquare : Phone}
            label={action.href?.startsWith("sms:") ? "Send message" : "Call"}
            onClick={() => run(() => onOpen(action.href ?? `tel:${action.value.replace(/[^+\d]/g, "")}`))}
          />
          <ActionButton icon={Copy} label="Copy phone number" onClick={() => run(() => onCopy(action.value))} />
        </>
      )}

      {action.kind === "date" && (
        <>
          <ActionButton icon={CalendarPlus} label="Create calendar event" onClick={() => run(() => onCreateEvent(action))} />
          <ActionButton icon={Copy} label="Copy date" onClick={() => run(() => onCopy(action.value))} />
        </>
      )}

      {action.kind === "address" && (
        <>
          <ActionButton
            icon={MapPin}
            label="Open in Maps"
            onClick={() => run(() => onOpen(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(action.value)}`))}
          />
          <ActionButton icon={Copy} label="Copy address" onClick={() => run(() => onCopy(action.value))} />
        </>
      )}

      {(action.kind === "url" || action.kind === "app") && action.href && (
        <>
          <ActionButton icon={ExternalLink} label="Open link" onClick={() => run(() => onOpen(action.href!))} />
          <ActionButton icon={Copy} label="Copy link" onClick={() => run(() => onCopy(action.href!))} />
        </>
      )}
    </div>,
    document.body,
  );
}
