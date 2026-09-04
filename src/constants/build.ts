/**
 * The fix number: which build of the current version this is.
 *
 * The version itself (`0.4.21`) is the release; this counts the fixes shipped
 * on top of it, so a build can be told apart from the one before it without
 * pretending to be a new release. Bump it in every PR that changes behaviour.
 *
 * It is also written to `bundle.macOS.bundleVersion` in `tauri.conf.json`,
 * which is what Finder's Get Info shows — a test keeps the two in step.
 */
export const FIX_NUMBER = "006";
