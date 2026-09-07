import { useEffect, useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { useComposerStore } from "@/stores/composerStore";

export function UndoSendToast() {
  const {
    undoSendVisible,
    undoSendDeadline,
    undoSendDurationMs,
    undoSendCancel,
    undoSendSkip,
    clearUndoSend,
  } = useComposerStore();
  const toastRef = useRef<HTMLDivElement>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!undoSendVisible || !undoSendDeadline) {
      setRemainingMs(0);
      return;
    }

    const update = () => setRemainingMs(Math.max(0, undoSendDeadline - Date.now()));
    update();
    const interval = window.setInterval(update, 100);
    return () => window.clearInterval(interval);
  }, [undoSendDeadline, undoSendVisible]);

  const handleCancel = () => {
    undoSendCancel?.();
    clearUndoSend();
  };

  const handleSkip = () => {
    undoSendSkip?.();
  };

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const progress = undoSendDurationMs > 0
    ? Math.min(100, Math.max(0, (remainingMs / undoSendDurationMs) * 100))
    : 0;

  return (
    <CSSTransition nodeRef={toastRef} in={undoSendVisible} timeout={200} classNames="toast" unmountOnExit>
      <div ref={toastRef} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-text-primary text-bg-primary rounded-lg shadow-lg overflow-hidden">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <span className="text-sm tabular-nums">
            Sending email... {remainingSeconds}s
          </span>
          <button
            onClick={handleCancel}
            className="text-sm font-medium text-accent hover:text-accent-hover underline"
          >
            Cancel
          </button>
          <button
            onClick={handleSkip}
            className="text-sm font-medium text-accent hover:text-accent-hover underline"
          >
            Skip
          </button>
        </div>
        <div className="h-0.5 bg-white/20">
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${progress}%`, transition: "width 100ms linear" }}
          />
        </div>
      </div>
    </CSSTransition>
  );
}
