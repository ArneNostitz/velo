import { getAllAccounts } from "../db/accounts";
import { getSetting, getSecureSetting } from "../db/settings";
import { syncAccount } from "./syncManager";
import { getGmailClient } from "./tokenManager";

let controller: AbortController | null = null;
let relayConfig: { url: string; secret: string; topicName: string } | null = null;

function relayUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/** Listen for Gmail history notifications from the optional Velo relay. */
export async function startGmailPushRelay(): Promise<void> {
  stopGmailPushRelay();
  const configuredUrl = await getSetting("gmail_push_relay_url");
  const secret = await getSecureSetting("gmail_push_relay_secret");
  const topicName = await getSetting("gmail_push_topic_name");
  if (!configuredUrl || !secret || !topicName) return;

  const baseUrl = relayUrl(configuredUrl);
  relayConfig = { url: baseUrl, secret, topicName: topicName.trim() };
  const url = `${baseUrl}/events`;
  controller = new AbortController();
  const signal = controller.signal;

  const register = async (email: string): Promise<void> => {
    const accounts = await getAllAccounts();
    const account = accounts.find((item) => item.email.toLowerCase() === email.toLowerCase());
    if (!account || account.provider !== "gmail_api" || !account.is_active) return;
    const client = await getGmailClient(account.id);
    const response = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ email: account.email, accessToken: await client.getAccessToken(), topicName: relayConfig?.topicName }),
    });
    if (!response.ok) throw new Error(`Relay registration returned HTTP ${response.status}`);
  };

  try {
    const accounts = await getAllAccounts();
    const registrations = await Promise.allSettled(
      accounts
        .filter((account) => account.provider === "gmail_api" && account.is_active)
        .map((account) => register(account.email)),
    );
    for (const result of registrations) {
      if (result.status === "rejected") console.warn("Gmail push watch registration failed:", result.reason);
    }
    const response = await fetch(url, {
      headers: { Accept: "text/event-stream", Authorization: `Bearer ${secret}` },
      signal,
    });
    if (!response.ok || !response.body) throw new Error(`Relay returned HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const line = event.split("\n").find((part) => part.startsWith("data: "));
        if (!line) continue;
        try {
          const payload = JSON.parse(line.slice(6)) as { type?: string; email?: string };
          if (!payload.email) continue;
          if (payload.type === "renew-required") {
            void register(payload.email).catch((error) => console.warn("Gmail push watch renewal failed:", error));
          } else if (payload.type === "gmail-history") {
            const accounts = await getAllAccounts();
            const account = accounts.find((item) => item.email.toLowerCase() === payload.email!.toLowerCase());
            if (account?.provider === "gmail_api" && account.is_active) void syncAccount(account.id);
          }
        } catch (error) {
          console.warn("Ignoring malformed Gmail relay event", error);
        }
      }
    }
  } catch (error) {
    if (!signal.aborted) console.warn("Gmail push relay unavailable:", error);
  }
}

export function stopGmailPushRelay(): void {
  controller?.abort();
  controller = null;
  relayConfig = null;
}
