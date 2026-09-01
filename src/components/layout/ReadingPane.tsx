import { ThreadView } from "../email/ThreadView";
import { useThreadStore } from "@/stores/threadStore";
import { useSelectedThreadId } from "@/hooks/useRouteNavigation";
import { EmptyState } from "../ui/EmptyState";
import { ReadingPaneIllustration } from "../ui/illustrations";

export function ReadingPane() {
  const selectedThreadId = useSelectedThreadId();
  // Falls back to the detached cache so a thread opened from the contact
  // sidebar keeps rendering even as the list reloads underneath it.
  const selectedThread = useThreadStore((s) =>
    selectedThreadId
      ? s.threadMap.get(selectedThreadId) ?? s.cachedThreads.get(selectedThreadId) ?? null
      : null,
  );

  if (!selectedThread) {
    return (
      <div className="flex-1 flex flex-col bg-bg-primary/50 glass-panel">
        <EmptyState illustration={ReadingPaneIllustration} title="Velo" subtitle="Select an email to read" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-bg-primary/50 overflow-hidden glass-panel">
      {/* Keyed so switching threads resets per-thread state — an open inline
          reply with text in it must not follow you to the next thread */}
      <ThreadView key={selectedThread.id} thread={selectedThread} />
    </div>
  );
}
