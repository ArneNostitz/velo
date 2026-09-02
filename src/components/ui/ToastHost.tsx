import { X, AlertCircle, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { useToastStore, type ToastKind } from "@/stores/toastStore";

const ICON: Record<ToastKind, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const ACCENT: Record<ToastKind, string> = {
  error: "border-l-danger text-danger",
  warning: "border-l-warning text-warning",
  info: "border-l-accent text-accent",
  success: "border-l-success text-success",
};

/**
 * Where the app says things out loud.
 *
 * Top right, under the title bar, so it never fights the undo-send and update
 * toasts at the bottom. Errors are `role="alert"` and stay until dismissed —
 * a failure the user never got to read was not reported.
 */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-12 right-4 z-[90] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = ICON[toast.kind];
        return (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto glass-panel rounded-lg shadow-lg border border-border-primary border-l-4 ${ACCENT[toast.kind]} toast-enter`}
          >
            <div className="flex items-start gap-2.5 px-3 py-2.5">
              <Icon size={16} className="shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary break-words">{toast.title}</p>
                {toast.detail && (
                  <p className="text-xs text-text-secondary mt-0.5 break-words whitespace-pre-wrap">
                    {toast.detail}
                  </p>
                )}
                {toast.action && (
                  <button
                    onClick={() => {
                      void toast.action?.run();
                      dismiss(toast.id);
                    }}
                    className="mt-1.5 text-xs font-medium text-accent hover:underline"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="shrink-0 p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
