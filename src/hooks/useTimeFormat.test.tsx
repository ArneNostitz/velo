import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("@/services/db/settings", () => ({
  setSetting: vi.fn(() => Promise.resolve()),
}));

import { useUIStore } from "@/stores/uiStore";
import { useTimeFormat } from "./useTimeFormat";
import { formatFullDate, getTimeFormatPreference } from "@/utils/date";

/** 13:30 today, so the formatter renders a clock time either way. */
function halfPastOne(): number {
  const d = new Date();
  d.setHours(13, 30, 0, 0);
  return d.getTime();
}

function Clock() {
  // Subscribing is what makes a preference change repaint this
  useTimeFormat();
  return <span data-testid="clock">{formatFullDate(halfPastOne())}</span>;
}

/** Same component without the subscription — the bug this hook exists to fix. */
function UnsubscribedClock() {
  return <span data-testid="stale">{formatFullDate(halfPastOne())}</span>;
}

describe("useTimeFormat", () => {
  beforeEach(() => {
    act(() => {
      useUIStore.getState().setTimeFormat("system");
    });
  });

  it("keeps the module preference in step with the store", () => {
    act(() => {
      useUIStore.getState().setTimeFormat("24h");
    });
    expect(getTimeFormatPreference()).toBe("24h");
  });

  it("re-renders a subscribed component when the preference changes", () => {
    act(() => {
      useUIStore.getState().setTimeFormat("12h");
    });
    render(<Clock />);
    expect(screen.getByTestId("clock").textContent).toMatch(/[AP]M/i);

    act(() => {
      useUIStore.getState().setTimeFormat("24h");
    });

    // The formatters read module state, so without the subscription React
    // would never repaint and the setting would look like it does nothing
    expect(screen.getByTestId("clock").textContent).not.toMatch(/[AP]M/i);
    expect(screen.getByTestId("clock").textContent).toContain("13");
  });

  it("does not repaint a component that skipped the subscription", () => {
    act(() => {
      useUIStore.getState().setTimeFormat("12h");
    });
    render(<UnsubscribedClock />);
    const before = screen.getByTestId("stale").textContent;

    act(() => {
      useUIStore.getState().setTimeFormat("24h");
    });

    // Documents why every time-rendering component has to call the hook
    expect(screen.getByTestId("stale").textContent).toBe(before);
  });
});
