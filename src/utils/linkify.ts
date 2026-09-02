import { escapeHtml } from "./sanitize";

/**
 * Turn the links in a plain-text message into links.
 *
 * A text/plain body was being escaped straight into a <pre>, so a URL in it
 * was text and nothing more — no click, no hover, no way to follow it short
 * of retyping. Senders of plain text write bare URLs precisely because they
 * expect the reader's client to do this.
 */

/**
 * A URL in running text. Deliberately conservative about where it stops:
 * trailing punctuation usually belongs to the sentence, not the address, and
 * a closing bracket only belongs to the URL if an opening one did too.
 */
const URL_PATTERN =
  /\b((?:https?:\/\/|www\.)[^\s<>"']+)|(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b)/g;

/** Punctuation that ends a sentence rather than a URL. */
const TRAILING = /[.,;:!?)\]}'"»]+$/;

/**
 * Trim characters a sentence left on the end of a URL, keeping a bracket that
 * the URL opened itself — Wikipedia links depend on that.
 */
function trimTrailing(url: string): { url: string; tail: string } {
  let candidate = url;
  let tail = "";
  for (;;) {
    const match = candidate.match(TRAILING);
    if (!match) break;
    const stripped = candidate.slice(0, -match[0].length);
    // A closing bracket is part of the URL when it balances an opening one
    const closing = match[0];
    if (closing === ")" && countOf(stripped, "(") > countOf(stripped, ")")) break;
    if (closing === "]" && countOf(stripped, "[") > countOf(stripped, "]")) break;
    candidate = stripped;
    tail = closing + tail;
    if (candidate === "") break;
  }
  return { url: candidate, tail };
}

function countOf(text: string, char: string): number {
  let count = 0;
  for (const c of text) if (c === char) count++;
  return count;
}

/**
 * Escape a plain-text body and wrap its URLs and email addresses in anchors.
 *
 * Escaping happens per-segment, so the returned HTML is safe to insert: no
 * part of the original text can become markup, and the hrefs are built from
 * text that has been escaped for attribute context.
 */
export function linkifyPlainText(text: string): string {
  let out = "";
  let lastIndex = 0;

  URL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    out += escapeHtml(text.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;

    const [raw] = match;
    if (match[2]) {
      // An email address
      const address = escapeHtml(raw);
      out += `<a href="mailto:${address}">${address}</a>`;
      continue;
    }

    const { url, tail } = trimTrailing(raw);
    if (!url) {
      out += escapeHtml(raw);
      continue;
    }
    const href = escapeHtml(url.startsWith("www.") ? `https://${url}` : url);
    out += `<a href="${href}">${escapeHtml(url)}</a>${escapeHtml(tail)}`;
  }

  out += escapeHtml(text.slice(lastIndex));
  return out;
}
