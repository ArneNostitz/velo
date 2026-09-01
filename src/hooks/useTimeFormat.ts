import { useUIStore, type TimeFormat } from "@/stores/uiStore";

/**
 * Subscribe to the clock preference.
 *
 * The formatters in `utils/date` read the preference from module state so they
 * stay callable outside React, which means React has no idea when it changes.
 * Any component that renders a time must call this so switching between 12- and
 * 24-hour actually repaints it.
 */
export function useTimeFormat(): TimeFormat {
  return useUIStore((s) => s.timeFormat);
}
