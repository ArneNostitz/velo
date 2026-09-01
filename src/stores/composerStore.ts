import { create } from "zustand";

export type ComposerMode = "new" | "reply" | "replyAll" | "forward";
export type ComposerViewMode = "modal" | "fullpage";

export interface ComposerAttachment {
  id: string;
  file: File;
  filename: string;
  mimeType: string;
  size: number;
  content: string; // base64
}

export interface ComposerState {
  isOpen: boolean;
  mode: ComposerMode;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  bodyHtml: string;
  threadId: string | null;
  inReplyToMessageId: string | null;
  /**
   * Mailbox this message is sent from, or null to use the active account.
   * A unified list spans accounts, so a reply must go out through the account
   * that holds the thread rather than whichever mailbox is currently selected.
   */
  accountId: string | null;
  /**
   * Raw To/Cc headers of the message(s) being replied to or forwarded, newest
   * first. Drives the From default: a reply goes out from the address the mail
   * was delivered to, not the account's default alias.
   */
  originalRecipients: string[];
  showCcBcc: boolean;
  draftId: string | null;
  undoSendTimer: ReturnType<typeof setTimeout> | null;
  undoSendVisible: boolean;
  attachments: ComposerAttachment[];
  lastSavedAt: number | null;
  isSaving: boolean;
  fromEmail: string | null;
  viewMode: ComposerViewMode;
  signatureHtml: string;
  signatureId: string | null;
  requestReadReceipt: boolean;

  openComposer: (opts?: {
    mode?: ComposerMode;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    bodyHtml?: string;
    threadId?: string | null;
    inReplyToMessageId?: string | null;
    originalRecipients?: string[];
    fromEmail?: string | null;
    accountId?: string | null;
    draftId?: string | null;
  }) => void;
  closeComposer: () => void;
  setTo: (to: string[]) => void;
  setCc: (cc: string[]) => void;
  setBcc: (bcc: string[]) => void;
  setSubject: (subject: string) => void;
  setBodyHtml: (bodyHtml: string) => void;
  setShowCcBcc: (show: boolean) => void;
  setDraftId: (id: string | null) => void;
  setUndoSendTimer: (timer: ReturnType<typeof setTimeout> | null) => void;
  setUndoSendVisible: (visible: boolean) => void;
  addAttachment: (attachment: ComposerAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  setLastSavedAt: (ts: number | null) => void;
  setIsSaving: (saving: boolean) => void;
  setFromEmail: (email: string | null) => void;
  /** Switch the sending mailbox; drops thread and draft state tied to the old one. */
  setAccountId: (accountId: string | null) => void;
  setViewMode: (mode: ComposerViewMode) => void;
  setSignatureHtml: (html: string) => void;
  setSignatureId: (id: string | null) => void;
  setRequestReadReceipt: (request: boolean) => void;
}

export const useComposerStore = create<ComposerState>((set) => ({
  isOpen: false,
  mode: "new",
  to: [],
  cc: [],
  bcc: [],
  subject: "",
  bodyHtml: "",
  threadId: null,
  inReplyToMessageId: null,
  accountId: null,
  originalRecipients: [],
  showCcBcc: false,
  draftId: null,
  undoSendTimer: null,
  undoSendVisible: false,
  attachments: [],
  viewMode: "modal",
  fromEmail: null,
  lastSavedAt: null,
  isSaving: false,
  signatureHtml: "",
  signatureId: null,
  requestReadReceipt: false,

  openComposer: (opts) =>
    set({
      isOpen: true,
      mode: opts?.mode ?? "new",
      to: opts?.to ?? [],
      cc: opts?.cc ?? [],
      bcc: opts?.bcc ?? [],
      subject: opts?.subject ?? "",
      bodyHtml: opts?.bodyHtml ?? "",
      threadId: opts?.threadId ?? null,
      inReplyToMessageId: opts?.inReplyToMessageId ?? null,
      accountId: opts?.accountId ?? null,
      originalRecipients: opts?.originalRecipients ?? [],
      showCcBcc: (opts?.cc?.length ?? 0) > 0 || (opts?.bcc?.length ?? 0) > 0,
      draftId: opts?.draftId ?? null,
      viewMode: "modal",
      fromEmail: opts?.fromEmail ?? null,
      attachments: [],
      lastSavedAt: null,
      isSaving: false,
      signatureHtml: "",
      signatureId: null,
      requestReadReceipt: false,
    }),
  closeComposer: () =>
    set({
      isOpen: false,
      mode: "new",
      to: [],
      cc: [],
      bcc: [],
      subject: "",
      bodyHtml: "",
      threadId: null,
      inReplyToMessageId: null,
      accountId: null,
      originalRecipients: [],
      showCcBcc: false,
      draftId: null,
      viewMode: "modal",
      fromEmail: null,
      attachments: [],
      lastSavedAt: null,
      isSaving: false,
      signatureHtml: "",
      signatureId: null,
      requestReadReceipt: false,
    }),
  setTo: (to) => set({ to }),
  setCc: (cc) => set({ cc }),
  setBcc: (bcc) => set({ bcc }),
  setSubject: (subject) => set({ subject }),
  setBodyHtml: (bodyHtml) => set({ bodyHtml }),
  setShowCcBcc: (showCcBcc) => set({ showCcBcc }),
  setDraftId: (draftId) => set({ draftId }),
  setUndoSendTimer: (undoSendTimer) => set({ undoSendTimer }),
  setUndoSendVisible: (undoSendVisible) => set({ undoSendVisible }),
  addAttachment: (attachment) =>
    set((state) => ({ attachments: [...state.attachments, attachment] })),
  removeAttachment: (id) =>
    set((state) => ({
      attachments: state.attachments.filter((a) => a.id !== id),
    })),
  clearAttachments: () => set({ attachments: [] }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
  setIsSaving: (isSaving) => set({ isSaving }),
  setFromEmail: (fromEmail) => set({ fromEmail }),
  setAccountId: (accountId) =>
    set((state) =>
      state.accountId === accountId
        ? { accountId }
        : {
            accountId,
            // Thread and draft ids belong to the mailbox that issued them
            threadId: null,
            draftId: null,
            inReplyToMessageId: null,
          },
    ),
  setViewMode: (viewMode) => set({ viewMode }),
  setSignatureHtml: (signatureHtml) => set({ signatureHtml }),
  setSignatureId: (signatureId) => set({ signatureId }),
  setRequestReadReceipt: (requestReadReceipt) => set({ requestReadReceipt }),
}));
