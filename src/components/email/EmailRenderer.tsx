import { useRef, useCallback, useLayoutEffect, useMemo, useState, useEffect } from "react";
import { ImageOff } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { stripRemoteImages, hasBlockedImages } from "@/utils/imageBlocker";
import { addToAllowlist } from "@/services/db/imageAllowlist";
import { sanitizeHtml } from "@/utils/sanitize";
import { linkifyPlainText } from "@/utils/linkify";
import { useUIStore } from "@/stores/uiStore";
import { LinkConfirmDialog } from "./LinkConfirmDialog";
import type { LinkAnalysis, MessageScanResult } from "@/utils/phishingDetector";
import type { DbAttachment } from "@/services/db/attachments";

/**
 * Minimum risk score that forces a confirmation dialog before a link opens.
 * 20 is the boundary between "safe" and "low" in phishingDetector.getRiskLevel.
 */
const CONFIRM_THRESHOLD = 20;

/**
 * Match a clicked anchor against the pre-computed scan results.
 *
 * scanLinksInHtml records the raw `href` attribute, while `anchor.href` is the
 * browser-resolved (and normalised) form, so try the raw attribute first and
 * fall back to comparing normalised URLs.
 */
function findAnalysis(
  scanResult: MessageScanResult | null,
  rawHref: string,
  resolvedHref: string,
): LinkAnalysis | null {
  if (!scanResult) return null;

  const direct = scanResult.links.find((l) => l.url === rawHref);
  if (direct) return direct;

  const normalise = (u: string): string | null => {
    try {
      return new URL(u).href;
    } catch {
      return null;
    }
  };
  const target = normalise(resolvedHref) ?? normalise(rawHref);
  if (!target) return null;

  return scanResult.links.find((l) => normalise(l.url) === target) ?? null;
}

interface EmailRendererProps {
  html: string | null;
  text: string | null;
  blockImages?: boolean;
  senderAddress?: string | null;
  accountId?: string | null;
  senderAllowlisted?: boolean;
  messageId?: string | null;
  inlineAttachments?: DbAttachment[];
  /** Result of the phishing link scan for this message, if scanning is enabled. */
  scanResult?: MessageScanResult | null;
}

export function EmailRenderer({
  html,
  text,
  blockImages = false,
  senderAddress,
  accountId,
  senderAllowlisted = false,
  messageId,
  inlineAttachments,
  scanResult,
}: EmailRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number>(0);
  const [overrideShow, setOverrideShow] = useState(false);
  const [cidMap, setCidMap] = useState<Map<string, string>>(new Map());
  const [pendingLink, setPendingLink] = useState<LinkAnalysis | null>(null);

  // Held in a ref so a scan arriving after render does not force the iframe
  // document to be rewritten (which would reset scroll position and images).
  const scanResultRef = useRef<MessageScanResult | null>(scanResult ?? null);
  useEffect(() => {
    scanResultRef.current = scanResult ?? null;
  }, [scanResult]);

  const theme = useUIStore((s) => s.theme);
  const isDark = theme === "dark"
    || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const shouldBlock = blockImages && !senderAllowlisted && !overrideShow;

  // Resolve cid: references by fetching inline attachment data
  useEffect(() => {
    if (!accountId || !messageId || !inlineAttachments?.length) return;

    const cidAttachments = inlineAttachments.filter(
      (a) => a.content_id && a.gmail_attachment_id,
    );
    if (cidAttachments.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const { getEmailProvider } = await import("@/services/email/providerFactory");
        const provider = await getEmailProvider(accountId);
        const resolved = new Map<string, string>();

        await Promise.all(
          cidAttachments.map(async (att) => {
            try {
              const response = await provider.fetchAttachment(
                messageId,
                att.gmail_attachment_id!,
              );
              const base64 = response.data.replace(/-/g, "+").replace(/_/g, "/");
              resolved.set(att.content_id!, `data:${att.mime_type ?? "image/png"};base64,${base64}`);
            } catch {
              // Skip individual failures
            }
          }),
        );

        if (!cancelled && resolved.size > 0) {
          setCidMap(resolved);
        }
      } catch {
        // Non-critical — images just won't render
      }
    })();

    return () => { cancelled = true; };
  }, [accountId, messageId, inlineAttachments]);

  // Sanitize once — reused by both content and blocked-image check
  const sanitizedBody = useMemo(() => {
    if (!html) return null;
    return sanitizeHtml(html);
  }, [html]);

  const isPlainText = !sanitizedBody;

  const bodyHtml = useMemo(() => {
    // A plain-text body still has links in it — they just have no markup
    let body = sanitizedBody
      ?? `<pre style="white-space: pre-wrap; font-family: inherit;">${linkifyPlainText(text ?? "")}</pre>`;

    if (shouldBlock && sanitizedBody) {
      body = stripRemoteImages(body);
    }

    // Replace cid: references with resolved data URIs
    if (cidMap.size > 0) {
      body = body.replace(
        /\bcid:([^"'\s)]+)/gi,
        (match, cidRef: string) => cidMap.get(cidRef) ?? match,
      );
    }

    return body;
  }, [sanitizedBody, text, shouldBlock, cidMap]);

  const blocked = useMemo(() => {
    if (!shouldBlock || !sanitizedBody) return false;
    return hasBlockedImages(stripRemoteImages(sanitizedBody));
  }, [shouldBlock, sanitizedBody]);

  // Write content directly into iframe document — synchronous, no srcDoc async parsing
  useLayoutEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    observerRef.current?.disconnect();

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    // Plain text: blend with app theme (dark text on light bg, light text on dark bg)
    // HTML emails: always render on a light background since senders design for white/light
    const plainTextDark = isDark && isPlainText;
    const htmlDark = isDark && !isPlainText;
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: ${plainTextDark ? "#e5e7eb" : "#1f2937"};
      background: ${htmlDark ? "#f8f9fa" : "transparent"};
      word-wrap: break-word;
      overflow-wrap: break-word;
      overflow: hidden;
    }
    img { max-width: 100%; height: auto; }
    a { color: ${plainTextDark ? "#60a5fa" : "#3b82f6"}; }
    blockquote {
      border-left: 3px solid ${plainTextDark ? "#4b5563" : "#d1d5db"};
      margin: 8px 0;
      padding: 4px 12px;
      color: ${plainTextDark ? "#9ca3af" : "#6b7280"};
    }
    pre { overflow-x: auto; }
    table { max-width: 100%; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`);
    doc.close();

    // Calculate and set height synchronously before paint
    const applyHeight = () => {
      if (!doc.body) return;
      const h = doc.body.scrollHeight;
      if (h > 0) {
        iframe.style.height = h + "px";
      }
    };
    applyHeight();

    // Watch for dynamic changes (images loading, etc.) — batched with rAF
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(applyHeight);
    });
    resizeObserver.observe(doc.body);
    observerRef.current = resizeObserver;

    // Open links in external browser via Tauri opener. Links the phishing
    // scanner flagged as anything above "safe" go through a confirmation
    // dialog first, which shows the real destination before anything opens.
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (anchor?.href) {
        e.preventDefault();

        const rawHref = anchor.getAttribute("href")?.trim() ?? anchor.href;
        const analysis = findAnalysis(scanResultRef.current, rawHref, anchor.href);
        if (analysis && analysis.riskScore >= CONFIRM_THRESHOLD) {
          setPendingLink(analysis);
          return;
        }

        openUrl(anchor.href).catch((err) => {
          console.error("Failed to open link:", err);
        });
      }
    };
    doc.addEventListener("click", handleClick);

    return () => {
      doc.removeEventListener("click", handleClick);
      observerRef.current?.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [bodyHtml, isDark, isPlainText]);

  const handleLoadImages = useCallback(() => {
    setOverrideShow(true);
  }, []);

  const handleConfirmLink = useCallback(() => {
    const url = pendingLink?.url;
    setPendingLink(null);
    if (!url) return;
    openUrl(url).catch((err) => {
      console.error("Failed to open link:", err);
    });
  }, [pendingLink]);

  const handleAlwaysLoad = useCallback(async () => {
    if (accountId && senderAddress) {
      await addToAllowlist(accountId, senderAddress);
    }
    setOverrideShow(true);
  }, [accountId, senderAddress]);

  return (
    <div>
      {blocked && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 text-xs bg-bg-tertiary rounded-md border border-border-secondary">
          <ImageOff size={14} className="text-text-tertiary shrink-0" />
          <span className="text-text-secondary">
            Images hidden to protect your privacy.
          </span>
          <button
            onClick={handleLoadImages}
            className="text-accent hover:text-accent-hover font-medium"
          >
            Load images
          </button>
          {senderAddress && accountId && (
            <button
              onClick={handleAlwaysLoad}
              className="text-accent hover:text-accent-hover font-medium"
            >
              Always load from sender
            </button>
          )}
        </div>
      )}
      <iframe
        ref={iframeRef}
        sandbox="allow-same-origin"
        className={`w-full border-0 ${isDark && !isPlainText ? "rounded-md" : ""}`}
        style={{ overflow: "hidden" }}
        title="Email content"
      />
      {pendingLink && (
        <LinkConfirmDialog
          linkAnalysis={pendingLink}
          onCancel={() => setPendingLink(null)}
          onConfirm={handleConfirmLink}
        />
      )}
    </div>
  );
}

