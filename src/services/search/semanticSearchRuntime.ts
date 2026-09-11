import { invoke } from "@tauri-apps/api/core";
import { errorMessage, reportError } from "@/stores/toastStore";

/** Native status strings stay open so a newer backend remains inspectable. */
export interface SemanticSearchStatus {
  supported: boolean;
  enabled: boolean;
  state: string;
  modelState: string;
  downloadedBytes: number;
  totalBytes: number | null;
  indexedDocuments: number | null;
  message: string | null;
  dataPath: string;
  modelId: string;
}

// Serialize status reads and mutations, including across panel remounts.
// A rejected command must not prevent subsequent retries.
let commandTail: Promise<unknown> = Promise.resolve();
// Shared by mutations, Settings reads, and the application observer. Retain
// failures until a healthy snapshot so dismissing a toast does not recreate it.
const reportedFailures = new Set<string>();

function reportRuntimeFailure(title: string, error: unknown) {
  const detail = errorMessage(error) || "Unknown native error";
  const signature = detail.trim();
  if (reportedFailures.has(signature)) return;
  reportedFailures.add(signature);
  reportError(title, detail);
}

const COMMAND_FAILURES: Record<string, string> = {
  semantic_search_status: "Could not read local search status",
  semantic_search_set_enabled: "Could not change local search activation",
  semantic_search_download_model: "Could not download the search model",
  semantic_search_reindex: "Could not update the mail index",
};

function reportStatusFailure(status: SemanticSearchStatus) {
  const quiet = !status.supported || status.state === "unsupported" ||
    status.state === "disabled" || status.state === "cancelled" || status.state === "canceled";
  const failed = status.state === "error" || status.state === "conflict" || status.modelState === "error";
  if (quiet || !failed) {
    reportedFailures.clear();
    return;
  }
  const detail = status.message || (status.modelState === "error"
    ? "The search model download failed. Retry the download in Settings > General."
    : "Local search could not run. Open Settings > General for status and recovery controls.");
  reportRuntimeFailure("Local semantic search needs attention", detail);
}

function command(
  name: string,
  args?: { enabled: boolean },
  signal?: AbortSignal,
): Promise<SemanticSearchStatus> {
  const result = commandTail.then(() => {
    // Unmount cancels queued work; an IPC already sent cannot be cancelled here.
    if (signal?.aborted) throw new Error("Semantic search request cancelled");
    return invoke<SemanticSearchStatus>(name, args).then(
      (status) => {
        if (name === "semantic_search_status" && signal?.aborted) return status;
        // Report before the component checks its abort signal: already-sent
        // commands can fail or return an error status after Settings closes.
        reportStatusFailure(status);
        return status;
      },
      (error: unknown) => {
        const title = COMMAND_FAILURES[name] ?? "Local search request failed";
        if (name !== "semantic_search_status" || !signal?.aborted) {
          reportRuntimeFailure(title, error);
        }
        throw error;
      },
    );
  });
  commandTail = result.then(() => undefined, () => undefined);
  return result;
}

export function getSemanticSearchStatus(signal?: AbortSignal) {
  return command("semantic_search_status", undefined, signal);
}

/** Read-only app-lifetime observer; never enables, downloads, or indexes mail. */
export function startSemanticSearchStatusObserver(): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function poll() {
    if (controller.signal.aborted) return;
    try {
      // The first snapshot also reports failures from native autoresume.
      await getSemanticSearchStatus(controller.signal);
    } catch {
      // The shared command wrapper reports real IPC failures once. Cleanup
      // cancellations are silent; neither path escapes as an unhandled promise.
    } finally {
      if (!controller.signal.aborted) {
        timer = setTimeout(() => void poll(), 5000);
      }
    }
  }

  void poll();
  return () => {
    controller.abort();
    if (timer !== undefined) clearTimeout(timer);
  };
}

export function setSemanticSearchEnabled(enabled: boolean, signal?: AbortSignal) {
  return command("semantic_search_set_enabled", { enabled }, signal);
}

export function downloadSemanticSearchModel(signal?: AbortSignal) {
  return command("semantic_search_download_model", undefined, signal);
}

/** Non-destructive incremental rescan; native retains existing embeddings. */
export function reindexSemanticSearch(signal?: AbortSignal) {
  return command("semantic_search_reindex", undefined, signal);
}
