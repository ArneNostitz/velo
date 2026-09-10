import DOMPurify from "dompurify";

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|sms|facetime|facetime-audio|maps|zoommtg|msteams|slack|cid):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "width", "height", "class", "style",
      "target", "rel", "colspan", "rowspan", "cellpadding", "cellspacing",
      "border", "align", "valign", "bgcolor", "color", "dir", "lang",
      "data-blocked-src",
    ],
  });
}
