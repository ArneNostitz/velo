import { availableParallelism } from "node:os";
import { waitForNextWork, workerSignal } from "./runtime-control";

export function indexingCpuBudgetPercent(raw = process.env.UNIVERSAL_SEARCH_CPU_BUDGET_PERCENT): number {
  const value = raw?.trim() ? Number(raw) : 50;
  return Number.isFinite(value) ? Math.min(100, Math.max(20, value)) : 50;
}

export function embeddingRestMilliseconds(activeMs: number, logicalCpus = availableParallelism(), targetPercent = indexingCpuBudgetPercent()): number {
  if (!Number.isFinite(activeMs) || activeMs <= 0) return 0;
  const cpus = Number.isFinite(logicalCpus) ? Math.max(1, Math.trunc(logicalCpus)) : 1;
  const percent = Number.isFinite(targetPercent) ? Math.min(100, Math.max(20, targetPercent)) : 50;
  return Math.ceil(activeMs * (cpus * 100 / percent - 1));
}

// Invoke only after a successful embedding import and after consuming its body.
// Never put this in finally: a failed/timed-out request must report immediately.
// This is conservative average-duty pacing, not an OS CPU or RSS ceiling.
export async function restAfterEmbedding(startedAt: number, onRest?: (remainingMs: number) => void): Promise<void> {
  workerSignal.throwIfAborted();
  const restMs = embeddingRestMilliseconds(performance.now() - startedAt);
  const deadline = performance.now() + restMs;
  let remaining = restMs;
  while (remaining > 0) {
    workerSignal.throwIfAborted();
    onRest?.(Math.ceil(remaining));
    await waitForNextWork(Math.min(remaining, 5000));
    remaining = Math.max(0, deadline - performance.now());
  }
  onRest?.(0);
}
