import { extractEmailAddresses, normalizeEmail } from "@/utils/emailUtils";

/** Anything that can be a From address: a send-as alias, or an account identity. */
export interface FromCandidate {
  email: string;
  isPrimary: boolean;
  isDefault: boolean;
}

/** The recipient fields of a message, as stored on the messages table. */
export interface MessageRecipients {
  to_addresses?: string | null;
  cc_addresses?: string | null;
}

/**
 * The To/Cc headers of a thread, newest message first.
 *
 * Reply identity is resolved against this list in order, so the address the
 * most recent message reached the user at wins over an older one.
 */
export function recipientHeadersFromMessages(
  messages: MessageRecipients[],
): string[] {
  const headers: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message) continue;
    if (message.to_addresses) headers.push(message.to_addresses);
    if (message.cc_addresses) headers.push(message.cc_addresses);
  }
  return headers;
}

/**
 * Resolve which send-as alias to use as the "From" address.
 *
 * `recipientHeaders` are the raw To/Cc headers of the message(s) being replied
 * to or forwarded, most recent first. The reply goes out from the address the
 * message was delivered to, so the first alias appearing in those headers wins.
 *
 * Falls back to the default alias (isDefault), then primary alias.
 * Returns null if no aliases are available.
 */
export function resolveFromAddress<T extends FromCandidate>(
  aliases: T[],
  recipientHeaders: (string | null | undefined)[],
): T | null {
  if (aliases.length === 0) return null;

  // Headers are ordered by preference, and so are the addresses within one
  // header — the first alias hit is the one the message was addressed to.
  for (const header of recipientHeaders) {
    for (const address of extractEmailAddresses(header)) {
      const match = aliases.find((a) => normalizeEmail(a.email) === address);
      if (match) return match;
    }
  }

  // Fall back to default alias
  const defaultAlias = aliases.find((a) => a.isDefault);
  if (defaultAlias) return defaultAlias;

  // Fall back to primary alias
  const primaryAlias = aliases.find((a) => a.isPrimary);
  if (primaryAlias) return primaryAlias;

  // Last resort: return first alias
  return aliases[0] ?? null;
}
