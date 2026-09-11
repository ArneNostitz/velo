import { setTimeout as sleep } from "node:timers/promises";

const controller = new AbortController();
export const workerSignal = controller.signal;

export function stopWorker(): void {
  if (!workerSignal.aborted) controller.abort(new Error("Semantic worker stopped"));
}

export async function waitForNextWork(milliseconds: number): Promise<void> {
  workerSignal.throwIfAborted();
  await sleep(Math.max(1, milliseconds), undefined, { signal: workerSignal });
}
