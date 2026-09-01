/**
 * Reduce a mail body to what the sender actually wrote.
 *
 * Mail clients keep appending: the quoted message being replied to, a
 * signature, a legal footer, an "On <date>, <name> wrote:" line. In a chat
 * view every one of those is text the reader has already seen a screen
 * earlier, so the bubble shows only the new part and offers "View full" for
 * the original.
 *
 * The trim is deliberately conservative — when nothing recognisable is found
 * the body is returned untouched, and a trim that would leave nothing behind
 * is discarded rather than showing an empty bubble.
 */

export interface TrimResult {
  /** Body with quotes, signatures and footers removed. */
  html: string | null;
  text: string | null;
  /** True when anything was actually removed. */
  trimmed: boolean;
}

/**
 * Selectors used by the major clients to wrap a quoted message.
 * Gmail, Apple Mail, Outlook, Thunderbird, Yahoo and the generic RFC form.
 */
const QUOTE_SELECTORS = [
  "blockquote",
  ".gmail_quote",
  ".gmail_extra",
  ".gmail_attr",
  "div.yahoo_quoted",
  "div.moz-cite-prefix",
  "#divRplyFwdMsg",
  "div[id^='divRplyFwdMsg']",
  "hr#stopSpelling",
  "[data-velo-quote]",
];

/** Selectors used to wrap a signature. */
const SIGNATURE_SELECTORS = [
  ".gmail_signature",
  "[data-smartmail='gmail_signature']",
  "div.moz-signature",
  "signature",
  "[data-velo-signature]",
];

/**
 * Lines that introduce a quoted message. Matched against a trimmed line of
 * plain text; the line and everything after it goes.
 */
const ATTRIBUTION_PATTERNS: RegExp[] = [
  // "On Tue, Sep 1, 2026 at 23:27, Arne wrote:" and its localisations that
  // still end in a colon after a name
  /^on\s.{6,200}\bwrote:\s*$/i,
  /^am\s.{6,200}\bschrieb\s.{0,120}:\s*$/i,
  /^le\s.{6,200}\ba écrit\s*:\s*$/i,
  /^el\s.{6,200}\bescribió:\s*$/i,
  // Outlook / Apple Mail header blocks
  /^-{2,}\s*original message\s*-{2,}$/i,
  /^-{2,}\s*forwarded message\s*-{2,}$/i,
  /^-{5,}\s*urspr(ü|ue)ngliche nachricht\s*-{5,}$/i,
  /^from:\s.+$/i,
  /^von:\s.+$/i,
  /^\s*_{10,}\s*$/,
  /^sent from my \w+/i,
  /^gesendet von meinem \w+/i,
];

/** A line that opens a signature block. */
const SIGNATURE_SEPARATOR = /^--\s?$/;

/**
 * Drop quoted mail and signatures from an HTML body.
 *
 * Runs on a detached document, so nothing here loads resources or executes
 * scripts — the caller still sanitises before rendering.
 */
export function trimHtmlBody(html: string): { html: string; trimmed: boolean } {
  if (typeof DOMParser === "undefined") return { html, trimmed: false };

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return { html, trimmed: false };
  }
  const body = doc.body;
  if (!body) return { html, trimmed: false };

  let removed = false;

  const removeAll = (selectors: string[]) => {
    for (const selector of selectors) {
      let nodes: NodeListOf<Element>;
      try {
        nodes = body.querySelectorAll(selector);
      } catch {
        // An invalid selector must not take the whole trim down with it
        continue;
      }
      for (const node of Array.from(nodes)) {
        // A quote nested inside an already-removed quote is gone already
        if (!node.isConnected) continue;
        node.remove();
        removed = true;
      }
    }
  };

  removeAll(QUOTE_SELECTORS);
  removeAll(SIGNATURE_SELECTORS);

  // Attribution lines ("On <date>, <name> wrote:") often sit outside the
  // blockquote they introduce. Once the quote is gone they are a dangling
  // fragment, so drop the element holding one along with its siblings.
  removed = removeAttributionTail(body) || removed;
  removed = removeTrailingSignature(body) || removed;

  if (!removed) return { html, trimmed: false };

  const result = body.innerHTML;
  // Never trade a readable body for an empty one
  if (body.textContent?.trim() === "" && !body.querySelector("img")) {
    return { html, trimmed: false };
  }
  return { html: result, trimmed: true };
}

/**
 * Remove the element containing a quote-attribution line and everything after
 * it. Only looks at top-level children, so a "wrote:" inside a paragraph of
 * real prose is left alone.
 */
function removeAttributionTail(body: HTMLElement): boolean {
  const children = Array.from(body.children);
  for (let i = 0; i < children.length; i++) {
    const text = (children[i]!.textContent ?? "").trim();
    if (!text) continue;
    if (text.length > 300) continue;
    if (!ATTRIBUTION_PATTERNS.some((p) => p.test(text))) continue;
    // Keep at least something above the cut
    if (i === 0) continue;
    for (let j = children.length - 1; j >= i; j--) children[j]!.remove();
    return true;
  }
  return false;
}

/** Remove a trailing `-- ` separated signature block. */
function removeTrailingSignature(body: HTMLElement): boolean {
  const children = Array.from(body.children);
  for (let i = children.length - 1; i >= 1; i--) {
    const text = (children[i]!.textContent ?? "").trim();
    if (!SIGNATURE_SEPARATOR.test(text) && text !== "--") continue;
    for (let j = children.length - 1; j >= i; j--) children[j]!.remove();
    return true;
  }
  return false;
}

/** Drop quoted lines, attribution lines and signatures from a plain-text body. */
export function trimTextBody(text: string): { text: string; trimmed: boolean } {
  const lines = text.split(/\r?\n/);
  let cut = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (SIGNATURE_SEPARATOR.test(line) || line === "--") {
      cut = i;
      break;
    }
    if (i > 0 && ATTRIBUTION_PATTERNS.some((p) => p.test(line))) {
      cut = i;
      break;
    }
    // A run of ">" quoting with nothing but quotes after it
    if (line.startsWith(">") && lines.slice(i).every((l) => {
      const t = l.trim();
      return t === "" || t.startsWith(">");
    })) {
      cut = i;
      break;
    }
  }

  if (cut === lines.length) return { text, trimmed: false };
  const kept = lines.slice(0, cut).join("\n").trimEnd();
  if (kept.trim() === "") return { text, trimmed: false };
  return { text: kept, trimmed: true };
}

/**
 * Trim whichever body a message actually has, preferring HTML.
 */
export function trimMessageBody(
  html: string | null,
  text: string | null,
): TrimResult {
  if (html) {
    const result = trimHtmlBody(html);
    return { html: result.html, text, trimmed: result.trimmed };
  }
  if (text) {
    const result = trimTextBody(text);
    return { html: null, text: result.text, trimmed: result.trimmed };
  }
  return { html, text, trimmed: false };
}
