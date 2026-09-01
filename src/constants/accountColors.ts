/**
 * Colours used to tell accounts apart — on the unified inbox pill, the account
 * switcher, and anywhere else a thread's mailbox needs to be identifiable at a
 * glance. Deliberately separate from the accent theme, which the user picks for
 * the whole app.
 */
export interface AccountColor {
  id: string;
  label: string;
  /** Solid colour for dots and rings */
  hex: string;
  /** Tailwind classes for the account pill (light + dark) */
  pill: string;
}

export const ACCOUNT_COLORS: AccountColor[] = [
  { id: "indigo", label: "Indigo", hex: "#6366f1", pill: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  { id: "emerald", label: "Emerald", hex: "#10b981", pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { id: "amber", label: "Amber", hex: "#f59e0b", pill: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { id: "rose", label: "Rose", hex: "#f43f5e", pill: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  { id: "sky", label: "Sky", hex: "#0ea5e9", pill: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { id: "violet", label: "Violet", hex: "#8b5cf6", pill: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { id: "orange", label: "Orange", hex: "#f97316", pill: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  { id: "teal", label: "Teal", hex: "#14b8a6", pill: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
];

const FALLBACK = ACCOUNT_COLORS[0]!;

/**
 * Resolve an account's colour.
 *
 * Accounts added before colours existed have none stored, so fall back to a
 * stable choice derived from position — two accounts never start out sharing
 * a colour, and the value does not change as the list is re-read.
 */
export function accountColor(colorId: string | null | undefined, index = 0): AccountColor {
  if (colorId) {
    const match = ACCOUNT_COLORS.find((c) => c.id === colorId);
    if (match) return match;
  }
  return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length] ?? FALLBACK;
}
