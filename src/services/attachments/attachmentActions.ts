import { invoke } from "@tauri-apps/api/core";
import { downloadDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { platform } from "@tauri-apps/plugin-os";
import { getSetting } from "@/services/db/settings";
import { getEmailProvider } from "@/services/email/providerFactory";

/** The minimum an attachment row needs to be fetched and saved. */
export interface AttachmentRef {
  accountId: string;
  messageId: string;
  gmailAttachmentId: string;
  filename: string | null;
}

/** Normalize URL-safe base64 (Gmail API) to standard base64. */
export function normalizeBase64(data: string): string {
  return data.replace(/-/g, "+").replace(/_/g, "/");
}

export function base64ToBytes(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/** Fetch attachment content from the provider as standard base64. */
export async function fetchAttachmentBase64(ref: AttachmentRef): Promise<string> {
  const provider = await getEmailProvider(ref.accountId);
  const response = await provider.fetchAttachment(ref.messageId, ref.gmailAttachmentId);
  return normalizeBase64(response.data);
}

/** Fetch attachment content from the provider as raw bytes. */
export async function fetchAttachmentBytes(ref: AttachmentRef): Promise<Uint8Array> {
  return base64ToBytes(await fetchAttachmentBase64(ref));
}

/**
 * The folder plain saves go to: the "download_dir" setting when set,
 * otherwise the OS Downloads folder.
 */
export async function getDownloadDirectory(): Promise<string> {
  const custom = await getSetting("download_dir");
  if (custom && custom.trim().length > 0) return custom;
  return downloadDir();
}

/**
 * Save an attachment into `dir` (defaults to the Downloads folder) without
 * overwriting existing files. Returns the path the file was saved to.
 */
export async function saveAttachmentToFolder(ref: AttachmentRef, dir?: string): Promise<string> {
  const targetDir = dir ?? (await getDownloadDirectory());
  const data = await fetchAttachmentBase64(ref);
  return invoke<string>("save_attachment", {
    dir: targetDir,
    filename: ref.filename ?? "attachment",
    dataBase64: data,
  });
}

/**
 * Ask for a folder, then save the attachment there.
 * Returns the saved path, or null when the picker was cancelled.
 */
export async function saveAttachmentWithPicker(ref: AttachmentRef): Promise<string | null> {
  const dir = await open({ directory: true, multiple: false, title: "Save attachment to..." });
  if (!dir || Array.isArray(dir)) return null;
  return saveAttachmentToFolder(ref, dir);
}

/**
 * Plain click saves to the Downloads folder; ⌘/Ctrl-click asks for a folder.
 * Returns the saved path, or null when a picker was cancelled.
 */
export async function saveAttachmentSmart(
  ref: AttachmentRef,
  event?: { metaKey: boolean; ctrlKey: boolean },
): Promise<string | null> {
  if (event && (event.metaKey || event.ctrlKey)) {
    return saveAttachmentWithPicker(ref);
  }
  return saveAttachmentToFolder(ref);
}

export function isMacPlatform(): boolean {
  try {
    return platform() === "macos";
  } catch {
    return false;
  }
}

/**
 * Open a set of attachments in macOS Quick Look, starting at `startIndex`.
 * Quick Look's own ←/→ arrows then move through the whole set. Files other
 * than the clicked one that fail to download are silently dropped from the
 * set. Returns false when Quick Look is not available (not macOS) or the
 * clicked file cannot be shown, so the caller can fall back to the in-app
 * preview.
 */
export async function quickLookAttachments(
  refs: AttachmentRef[],
  startIndex = 0,
): Promise<boolean> {
  if (!isMacPlatform() || refs.length === 0) return false;
  const start = Math.min(Math.max(startIndex, 0), refs.length - 1);

  const results = await Promise.allSettled(refs.map((r) => fetchAttachmentBase64(r)));
  if (results[start]!.status === "rejected") return false;

  // qlmanage always starts on the first file, so rotate the clicked one to
  // the front — the rest follow in their original order.
  const files: { filename: string; dataBase64: string }[] = [];
  for (let off = 0; off < refs.length; off++) {
    const i = (start + off) % refs.length;
    const result = results[i]!;
    if (result.status !== "fulfilled") continue;
    files.push({
      filename: refs[i]!.filename ?? "attachment",
      dataBase64: result.value,
    });
  }

  try {
    await invoke("quicklook_attachment", { files });
    return true;
  } catch (err) {
    console.error("Quick Look failed, falling back to in-app preview:", err);
    return false;
  }
}

/** Single-file convenience wrapper around {@link quickLookAttachments}. */
export async function quickLookAttachment(ref: AttachmentRef): Promise<boolean> {
  return quickLookAttachments([ref], 0);
}
