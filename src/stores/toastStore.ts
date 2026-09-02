import { create } from "zustand";

/**
 * Things the app has to say out loud.
 *
 * For a long time a failure went to the console and nowhere else — a sync
 * that stopped, a watcher that was refused, a migration that threw — and the
 * user saw an app that had quietly gone strange. Every failure now goes
 * through here and shows up as a toast, and it stays until dismissed: an
 * error that fades away on its own was never really reported.
 */

export type ToastKind = "error" | "warning" | "info" | "success";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  /** A second line — the underlying message, or what to do about it. */
  detail?: string;
  createdAt: number;
  /** Milliseconds until it removes itself. Errors never do. */
  ttlMs: number | null;
  /** An optional action, e.g. "Reconnect" or "Retry". */
  action?: ToastAction;
  /** Further actions — a login mail offers both "Copy code" and "Open link". */
  actions?: ToastAction[];
}

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
  /** Keep the toast open after running — e.g. copying, which the user may repeat. */
  keepOpen?: boolean;
}

interface ToastStore {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id" | "createdAt">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

/** How many to keep on screen; older ones drop off the bottom. */
const MAX_VISIBLE = 5;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID();
    const entry: Toast = { ...toast, id, createdAt: Date.now() };

    // The same error arriving on every retry must not stack up into a wall.
    // Identical title and detail replaces the older one instead.
    const existing = get().toasts.find(
      (t) => t.title === entry.title && t.detail === entry.detail && t.kind === entry.kind,
    );
    if (existing) {
      const pending = timers.get(existing.id);
      if (pending) clearTimeout(pending);
      timers.delete(existing.id);
    }

    set((s) => ({
      toasts: [entry, ...s.toasts.filter((t) => t.id !== existing?.id)].slice(0, MAX_VISIBLE),
    }));

    if (entry.ttlMs !== null) {
      timers.set(id, setTimeout(() => get().dismiss(id), entry.ttlMs));
    }
    return id;
  },
  dismiss: (id) => {
    const pending = timers.get(id);
    if (pending) clearTimeout(pending);
    timers.delete(id);
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  clear: () => {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    set({ toasts: [] });
  },
}));

/** The words inside whatever was thrown. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return err.message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Report a failure to the user, not just the console.
 *
 * The title says what was being attempted; the detail is the error itself.
 * Stays until dismissed. Also logs, so the console still has the full object
 * for anyone debugging.
 */
export function reportError(
  title: string,
  err?: unknown,
  action?: Toast["action"],
): string {
  const detail = err === undefined ? undefined : errorMessage(err);
  console.error(title, err);
  return useToastStore.getState().push({ kind: "error", title, detail, ttlMs: null, action });
}

/** Something worth a moment's attention that is not a failure. */
export function notify(
  kind: Exclude<ToastKind, "error">,
  title: string,
  detail?: string,
  ttlMs: number | null = 5000,
  actions?: ToastAction[],
): string {
  return useToastStore.getState().push({ kind, title, detail, ttlMs, actions });
}
