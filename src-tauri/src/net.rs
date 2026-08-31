//! Narrowly-scoped outbound HTTP performed in Rust.
//!
//! The frontend used to hold a wildcard `http://*` / `https://*` capability so
//! it could issue RFC 8058 one-click unsubscribe POSTs to arbitrary hosts.
//! That capability bypasses the webview CSP, so it doubled as an unrestricted
//! exfiltration channel for any XSS or compromised dependency.
//!
//! This command replaces it with a single fixed-shape request: a POST of the
//! literal body `List-Unsubscribe=One-Click`, whose response body is never
//! handed back to the frontend — only whether the server accepted it.

use std::time::Duration;

const ONE_CLICK_BODY: &str = "List-Unsubscribe=One-Click";
const TIMEOUT_SECS: u64 = 15;

/// Perform an RFC 8058 one-click unsubscribe POST.
///
/// Only `http`/`https` URLs are accepted. Returns `true` when the server
/// answered with a success status. The response body is discarded.
#[tauri::command]
pub async fn unsubscribe_one_click(url: String) -> Result<bool, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("Invalid unsubscribe URL: {e}"))?;
    match parsed.scheme() {
        "http" | "https" => {}
        other => return Err(format!("Unsupported unsubscribe scheme: {other}")),
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let response = client
        .post(parsed)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(ONE_CLICK_BODY)
        .send()
        .await
        .map_err(|e| format!("Unsubscribe request failed: {e}"))?;

    Ok(response.status().is_success())
}
