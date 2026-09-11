import { useEffect } from "react";

type CommandModifierLabel = "pressed" | "CmdOrCtrl";

function isModifierKey(key: string): boolean {
  return key === "Control" || key === "Meta" || key === "Shift" || key === "Alt";
}

export function shortcutFromKeyboardEvent(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
  commandModifierLabel: CommandModifierLabel = "pressed",
): string | null {
  if (isModifierKey(event.key)) return null;

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push(
      commandModifierLabel === "CmdOrCtrl"
        ? "CmdOrCtrl"
        : event.metaKey
          ? "Cmd"
          : "Ctrl",
    );
  }
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");

  parts.push(parts.length > 0 && event.key.length === 1 ? event.key.toUpperCase() : event.key);
  return parts.join("+");
}

/**
 * Capture a shortcut at the window boundary so recording does not depend on
 * WebKit focusing a button after it is clicked.
 */
export function useShortcutRecorder(
  active: boolean,
  onRecord: (shortcut: string) => void,
  commandModifierLabel: CommandModifierLabel = "pressed",
): void {
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const shortcut = shortcutFromKeyboardEvent(event, commandModifierLabel);
      if (shortcut) onRecord(shortcut);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [active, commandModifierLabel, onRecord]);
}
