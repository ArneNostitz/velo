/**
 * Find the one-time code in a message.
 *
 * The bar is deliberately high. A false positive is not a harmless miss: with
 * auto-copy on it silently replaces whatever the user had on their clipboard,
 * so an order number or a year must never be mistaken for a login code. A
 * code is only reported when a word that means "this is a code" sits next to
 * a token that looks like one.
 */

export interface OtpMatch {
  code: string;
  /** The words that qualified it, for the banner to explain itself. */
  context: string;
}

/**
 * Words that introduce a code, across the languages this mailbox sees. Kept
 * narrow: "password" alone is not here, because "your password has changed"
 * is a notification, not a code.
 */
const KEYWORDS = [
  "one-time code", "one time code", "onetime code", "one-time password",
  "verification code", "verify code", "security code", "login code",
  "access code", "confirmation code", "authentication code", "auth code",
  "sign-in code", "sign in code", "passcode", "otp", "2fa",
  "two-factor", "two factor", "single-use code",
  // German
  "bestätigungscode", "bestaetigungscode", "sicherheitscode",
  "verifizierungscode", "anmeldecode", "einmalcode", "einmalpasswort",
  "zugangscode", "authentifizierungscode",
  // French / Spanish / Italian / Dutch
  "code de vérification", "code de verification", "code de sécurité",
  "código de verificación", "codigo de verificacion", "código de seguridad",
  "codice di verifica", "verificatiecode", "beveiligingscode",
];

/**
 * A plausible code: 4–8 digits, or 6–8 characters mixing letters and digits.
 * Purely alphabetic runs are excluded — they are words.
 */
const CODE_PATTERN = /\b(?:\d[\d  -]{2,10}\d|[A-Z0-9]{6,8})\b/g;

/** How far from a keyword a code may sit and still belong to it. */
const WINDOW = 60;

/** Years and other numbers that are never one-time codes. */
function isImplausible(code: string): boolean {
  const digits = code.replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 8) {
    // Alphanumeric codes keep their letters, so only reject on length
    if (!/^[A-Z0-9]{6,8}$/.test(code)) return true;
    if (!/\d/.test(code) || !/[A-Z]/.test(code)) return true;
    return false;
  }
  // A bare four-digit number in the range of a plausible year is too risky
  if (digits.length === 4) {
    const asNumber = parseInt(digits, 10);
    if (asNumber >= 1900 && asNumber <= 2200) return true;
  }
  // All-same digits is a placeholder in a template, not a real code
  if (/^(\d)\1+$/.test(digits)) return true;
  return false;
}

/** Normalise the spacing some senders put inside a code ("123 456"). */
function tidy(code: string): string {
  return /^[\d  -]+$/.test(code) ? code.replace(/[  -]/g, "") : code;
}

/**
 * Extract a one-time code from a message's subject and body.
 *
 * Returns null unless a code keyword and a code-shaped token appear within
 * `WINDOW` characters of each other. The subject is searched first: senders
 * increasingly put the code there precisely so it can be read without opening
 * the mail.
 */
export function detectOtpCode(
  subject: string | null,
  body: string | null,
): OtpMatch | null {
  for (const source of [subject, body]) {
    if (!source) continue;
    const match = findInText(source);
    if (match) return match;
  }
  return null;
}

function findInText(raw: string): OtpMatch | null {
  // Collapse whitespace so a code split across a line break still reads as one
  const text = raw.replace(/\s+/g, " ");
  const haystack = text.toLowerCase();

  let best: { code: string; distance: number; context: string } | null = null;

  for (const keyword of KEYWORDS) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(keyword, from);
      if (at === -1) break;
      from = at + keyword.length;

      const start = Math.max(0, at - WINDOW);
      const end = Math.min(text.length, at + keyword.length + WINDOW);
      const around = text.slice(start, end);

      CODE_PATTERN.lastIndex = 0;
      let candidate: RegExpExecArray | null;
      while ((candidate = CODE_PATTERN.exec(around)) !== null) {
        const code = tidy(candidate[0]!.trim());
        if (isImplausible(code)) continue;
        // Prefer the code closest to the words that qualified it
        const absolute = start + candidate.index;
        const distance = Math.abs(absolute - at);
        if (!best || distance < best.distance) {
          best = { code, distance, context: keyword };
        }
      }
    }
  }

  return best ? { code: best.code, context: best.context } : null;
}

/**
 * Words that mark a link as the one that signs you in, rather than the
 * unsubscribe footer or a marketing button sitting next to it.
 */
const LINK_KEYWORDS = [
  "sign in", "sign-in", "signin", "log in", "log-in", "login",
  "verify", "confirm", "activate", "magic link", "continue to",
  "complete your", "authenticate", "reset your password",
  "anmelden", "einloggen", "bestätigen", "bestaetigen", "verifizieren",
  "se connecter", "vérifier", "verifier", "iniciar sesión", "verificar",
];

/** Links that are never the sign-in link, however they are worded. */
const LINK_EXCLUDE = /unsubscribe|abmelden|preferences|privacy|terms|imprint|impressum|\.(png|jpg|jpeg|gif|svg|css)(\?|$)/i;

export interface SignInLink {
  url: string;
  /** The anchor's own words, so the notification can name it. */
  label: string;
}

/**
 * Find the sign-in link in a message body.
 *
 * Anchors are read from the HTML rather than the text so the link's own words
 * can qualify it — "Sign in to your account" is the button, the bare URL next
 * to the footer is not. Returns null when nothing clearly qualifies; guessing
 * here would put a one-click launcher on an arbitrary link in an email.
 */
export function detectSignInLink(html: string | null): SignInLink | null {
  if (!html || typeof DOMParser === "undefined") return null;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return null;
  }

  for (const anchor of Array.from(doc.querySelectorAll("a[href]"))) {
    const url = anchor.getAttribute("href")?.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (LINK_EXCLUDE.test(url)) continue;

    const label = (anchor.textContent ?? "").replace(/\s+/g, " ").trim();
    const haystack = `${label} ${url}`.toLowerCase();
    if (LINK_EXCLUDE.test(label)) continue;
    if (!LINK_KEYWORDS.some((k) => haystack.includes(k))) continue;

    return { url, label: label || url };
  }
  return null;
}
