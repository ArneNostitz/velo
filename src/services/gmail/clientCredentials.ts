/**
 * Validation for the Google OAuth credentials the user supplies in Settings.
 *
 * The two values look nothing alike but sit next to each other in the setup
 * form, and pasting the secret into the Client ID field is easy to do. Google
 * answers that with `Error 401: invalid_client` on its own sign-in page, after
 * the browser has already been opened — so catch the swap here instead.
 */

/** Every Google OAuth client ID ends with this. */
export const CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";
/** Client secrets issued since 2021 carry this prefix. */
export const CLIENT_SECRET_PREFIX = "GOCSPX-";

/**
 * Check a Google OAuth client ID.
 * Returns an error message, or null when the value looks usable.
 */
export function validateClientId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Enter your Google OAuth Client ID.";
  if (value.startsWith(CLIENT_SECRET_PREFIX)) {
    return `That looks like the Client Secret. The Client ID ends in ${CLIENT_ID_SUFFIX}.`;
  }
  if (!value.endsWith(CLIENT_ID_SUFFIX)) {
    return `A Google Client ID ends in ${CLIENT_ID_SUFFIX}.`;
  }
  return null;
}

/**
 * Check a Google OAuth client secret.
 *
 * Only the reversed-fields mistake is rejected: secrets predating the
 * `GOCSPX-` prefix are still valid, so the prefix is not required.
 */
export function validateClientSecret(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Enter your Google OAuth Client Secret.";
  if (value.endsWith(CLIENT_ID_SUFFIX)) {
    return `That looks like the Client ID. The Client Secret starts with ${CLIENT_SECRET_PREFIX}.`;
  }
  return null;
}
