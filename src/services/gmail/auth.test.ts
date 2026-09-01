import { describe, it, expect } from "vitest";
import { startOAuthFlow } from "./auth";

describe("startOAuthFlow", () => {
  it("throws when client secret is undefined", async () => {
    await expect(startOAuthFlow("client-id")).rejects.toThrow(
      "Client Secret is not configured. Go to Settings → Google API to add it.",
    );
  });

  it("throws when client secret is empty string", async () => {
    await expect(startOAuthFlow("client-id", "")).rejects.toThrow(
      "Client Secret is not configured",
    );
  });
});

describe("OAuth scopes", () => {
  it("requests the scope send-as aliases need", async () => {
    // users.settings.sendAs.list 403s without gmail.settings.basic, which left
    // "send from a different address" silently unavailable.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/services/gmail/auth.ts", "utf8"),
    );
    expect(source).toContain(
      "https://www.googleapis.com/auth/gmail.settings.basic",
    );
  });
});
