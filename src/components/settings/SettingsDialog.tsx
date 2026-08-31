import { lazy, Suspense, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CSSTransition } from "react-transition-group";
import { useUIStore } from "@/stores/uiStore";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

const SettingsPage = lazy(() =>
  import("./SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

/**
 * Settings overlay. Opens with Cmd/Ctrl+, from anywhere, closes with Escape or
 * the backdrop. Rendered at the app root so the mail view stays mounted behind
 * it and the user lands back exactly where they were.
 */
export function SettingsDialog() {
  const isOpen = useUIStore((s) => s.settingsOpen);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // A nested overlay (add-account wizard, editor modal) owns Escape first.
      if (document.querySelector("[data-modal-overlay]")) return;
      e.stopPropagation();
      closeSettings();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeSettings]);

  return createPortal(
    <CSSTransition in={isOpen} timeout={150} classNames="modal" unmountOnExit nodeRef={nodeRef}>
      <div
        ref={nodeRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
        onContextMenu={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-black/30 glass-backdrop" onClick={closeSettings} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
          className="relative flex flex-col w-full max-w-4xl h-[min(46rem,88vh)] bg-bg-primary border border-border-primary rounded-xl glass-modal overflow-hidden"
        >
          <ErrorBoundary name="SettingsPage">
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">
                  Loading settings...
                </div>
              }
            >
              <SettingsPage />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </CSSTransition>,
    document.body,
  );
}
