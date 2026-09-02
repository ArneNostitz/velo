import { describe, it, expect, beforeEach, vi } from "vitest";
import { useToastStore, reportError, notify, errorMessage } from "./toastStore";

describe("toastStore", () => {
  beforeEach(() => {
    useToastStore.getState().clear();
    vi.useRealTimers();
  });

  it("keeps an error until it is dismissed", () => {
    vi.useFakeTimers();
    const id = reportError("Sync failed", new Error("boom"));
    vi.advanceTimersByTime(60_000);
    expect(useToastStore.getState().toasts.map((t) => t.id)).toContain(id);
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("lets a notice fade on its own", () => {
    vi.useFakeTimers();
    notify("success", "Sent", undefined, 1000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("puts the thrown message in the detail", () => {
    reportError("Could not connect", new Error("AUTHENTICATIONFAILED"));
    const [toast] = useToastStore.getState().toasts;
    expect(toast?.title).toBe("Could not connect");
    expect(toast?.detail).toBe("AUTHENTICATIONFAILED");
    expect(toast?.kind).toBe("error");
  });

  it("does not stack the same error arriving on every retry", () => {
    reportError("IDLE dropped", new Error("same"));
    reportError("IDLE dropped", new Error("same"));
    reportError("IDLE dropped", new Error("same"));
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("keeps only the newest few", () => {
    for (let i = 0; i < 8; i++) reportError(`Error ${i}`);
    const titles = useToastStore.getState().toasts.map((t) => t.title);
    expect(titles).toHaveLength(5);
    expect(titles[0]).toBe("Error 7");
  });

  it("carries an action the user can take", () => {
    const run = vi.fn();
    reportError("Instant delivery stopped", undefined, { label: "Reconnect", run });
    expect(useToastStore.getState().toasts[0]?.action?.label).toBe("Reconnect");
  });
});

describe("errorMessage", () => {
  it("reads an Error, a string, and a message-shaped object", () => {
    expect(errorMessage(new Error("x"))).toBe("x");
    expect(errorMessage("plain")).toBe("plain");
    expect(errorMessage({ message: "from tauri" })).toBe("from tauri");
  });

  it("survives something with no message at all", () => {
    expect(errorMessage({ code: 7 })).toBe('{"code":7}');
  });
});
