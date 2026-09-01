/**
 * Normalize an email address for case-insensitive comparison.
 * Email addresses are case-insensitive per RFC 5321.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Split an address-list header (To, Cc, Reply-To, …) into bare email
 * addresses, dropping display names.
 *
 * Headers arrive as raw RFC 5322 lists — `"Doe, John" <j@x.com>, other@y.com` —
 * so a naive `split(",")` both keeps the display name and cuts quoted names in
 * half. This walks the string instead, tracking quotes and angle brackets.
 */
export function extractEmailAddresses(header: string | null | undefined): string[] {
  if (!header) return [];

  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  let inAngles = false;

  for (const char of header) {
    if (char === '"' && !inAngles) {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "<" && !inQuotes) inAngles = true;
    else if (char === ">" && !inQuotes) inAngles = false;

    if (char === "," && !inQuotes && !inAngles) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);

  const addresses: string[] = [];
  for (const part of parts) {
    const angled = part.match(/<([^<>]*)>/);
    const address = normalizeEmail(angled?.[1] ?? part);
    if (address.includes("@")) addresses.push(address);
  }
  return addresses;
}
