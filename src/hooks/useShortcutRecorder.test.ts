import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { shortcutFromKeyboardEvent, useShortcutRecorder } from "./useShortcutRecorder";

describe("shortcutFromKeyboardEvent", () => {
  it("preserves the command and shift modifiers that were pressed", () => {
    expect(shortcutFromKeyboardEvent({
      key: "e",
      ctrlKey: false,
      metaKey: true,
      altKey: false,
      shiftKey: true,
    })).toBe("Cmd+Shift+E");
  });

  it("waits for a non-modifier key", () => {
    expect(shortcutFromKeyboardEvent({
      key: "Meta",
      ctrlKey: false,
      metaKey: true,
      altKey: false,
      shiftKey: false,
    })).toBeNull();
  });
});

describe("useShortcutRecorder", () => {
  it("records combinations from the window without requiring button focus", () => {
    const onRecord = vi.fn();
    renderHook(() => useShortcutRecorder(true, onRecord));

    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "r",
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }));

    expect(onRecord).toHaveBeenCalledWith("Cmd+Shift+R");
  });

  it("uses the cross-platform command label required by Tauri global shortcuts", () => {
    const onRecord = vi.fn();
    renderHook(() => useShortcutRecorder(true, onRecord, "CmdOrCtrl"));

    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "n",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    }));

    expect(onRecord).toHaveBeenCalledWith("CmdOrCtrl+N");
  });
});
