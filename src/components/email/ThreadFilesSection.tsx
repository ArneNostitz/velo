import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Paperclip, Download, Eye } from "lucide-react";
import { getAttachmentsForThread, type DbAttachment } from "@/services/db/attachments";
import { getEmailProvider } from "@/services/email/providerFactory";
import { formatFileSize, getFileIcon, canPreview } from "@/utils/fileTypeHelpers";
import { AttachmentPreview } from "./AttachmentList";

interface ThreadFilesSectionProps {
  accountId: string;
  threadId: string;
}

/** Strip path separators so a hostile filename cannot escape the chosen folder. */
function safeFilename(name: string | null, fallback: string): string {
  const cleaned = (name ?? "").replace(/[/\\]/g, "_").trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

async function fetchAttachmentBytes(
  accountId: string,
  att: DbAttachment,
): Promise<Uint8Array> {
  const provider = await getEmailProvider(accountId);
  const response = await provider.fetchAttachment(att.message_id, att.gmail_attachment_id!);
  const base64 = response.data.replace(/-/g, "+").replace(/_/g, "/");
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * "Files in this thread" — every attachment across the whole conversation,
 * with per-file preview and a save-all-into-folder action.
 */
export function ThreadFilesSection({ accountId, threadId }: ThreadFilesSectionProps) {
  const [files, setFiles] = useState<DbAttachment[]>([]);
  const [preview, setPreview] = useState<DbAttachment | null>(null);
  const [saveState, setSaveState] = useState<
    | { phase: "idle" }
    | { phase: "saving"; done: number; total: number }
    | { phase: "done"; total: number }
    | { phase: "failed" }
  >({ phase: "idle" });

  useEffect(() => {
    let cancelled = false;
    getAttachmentsForThread(accountId, threadId)
      .then((all) => {
        if (cancelled) return;
        // Skip inline images without a filename, then dedup by name+size
        const seen = new Set<string>();
        setFiles(
          all.filter((a) => {
            if (a.is_inline && !a.filename) return false;
            if (!a.gmail_attachment_id) return false;
            const key = `${a.filename}:${a.size}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      });
    return () => { cancelled = true; };
  }, [accountId, threadId]);

  if (files.length === 0) return null;

  const handleSaveAll = async () => {
    if (saveState.phase === "saving") return;
    const dir = await open({ directory: true, multiple: false, title: "Save attachments to..." });
    if (!dir || Array.isArray(dir)) return;

    setSaveState({ phase: "saving", done: 0, total: files.length });
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      const att = files[i]!;
      try {
        const bytes = await fetchAttachmentBytes(accountId, att);
        const name = safeFilename(att.filename, `attachment-${i + 1}`);
        await writeFile(`${dir}/${name}`, bytes);
      } catch (err) {
        console.error(`Failed to save ${att.filename}:`, err);
        failed++;
      }
      setSaveState({ phase: "saving", done: i + 1, total: files.length });
    }
    setSaveState(failed === files.length ? { phase: "failed" } : { phase: "done", total: files.length - failed });
    setTimeout(() => setSaveState({ phase: "idle" }), 3000);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          <Paperclip size={11} />
          Files in this thread
        </h4>
        <button
          onClick={handleSaveAll}
          disabled={saveState.phase === "saving"}
          className="flex items-center gap-1 text-[0.625rem] text-accent hover:text-accent-hover transition-colors disabled:opacity-60"
          title="Save all files to a folder"
        >
          <Download size={10} />
          {saveState.phase === "saving"
            ? `Saving ${saveState.done}/${saveState.total}...`
            : saveState.phase === "done"
              ? `Saved ${saveState.total}`
              : saveState.phase === "failed"
                ? "Failed — retry"
                : "Save all"}
        </button>
      </div>
      <div className="space-y-1">
        {files.map((att) => (
          <button
            key={att.id}
            onClick={() => setPreview(att)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-bg-hover transition-colors text-left group"
            title={canPreview(att.mime_type, att.filename) ? "Preview" : "Open details"}
          >
            <span className="shrink-0">{getFileIcon(att.mime_type)}</span>
            <div className="min-w-0 flex-1">
              <div className="text-text-secondary truncate">{att.filename ?? "Unnamed"}</div>
              {att.size != null && (
                <div className="text-text-tertiary text-[0.625rem]">{formatFileSize(att.size)}</div>
              )}
            </div>
            <Eye size={11} className="shrink-0 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

      {preview && (
        <AttachmentPreview
          attachment={preview}
          accountId={accountId}
          messageId={preview.message_id}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
