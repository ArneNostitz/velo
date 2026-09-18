// WebKit suppresses even parent-owned DOM event listeners in a sandbox without
// allow-scripts. Use CSP to disable *all email script* instead, so the app's
// listeners (executing in the parent realm) can handle selection and menus.
// Install this policy before writing any sanitized message markup.
export const EMAIL_FRAME_SANDBOX = "allow-same-origin allow-scripts allow-top-navigation-by-user-activation";
export const EMAIL_FRAME_CSP = "script-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";
