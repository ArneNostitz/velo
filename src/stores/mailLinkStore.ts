import { create } from "zustand";
import type { MailLinkTarget } from "@/utils/mailLink";

/** Kept until the reading pane has loaded, including when opening a cold app. */
export const useMailLinkStore = create<{
  target: MailLinkTarget | null;
  request: (target: MailLinkTarget) => void;
  consumed: (target: MailLinkTarget) => void;
}>((set) => ({
  target: null,
  request: (target) => set({ target: { ...target } }),
  consumed: (target) => set((state) => state.target === target ? { target: null } : state),
}));
