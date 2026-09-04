import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { FIX_NUMBER } from "@/constants/build";

describe("tauri.conf.json", () => {
  const configPath = resolve(__dirname, "../../src-tauri/tauri.conf.json");
  const config = JSON.parse(readFileSync(configPath, "utf-8"));

  it("should disable native drag-drop on the main window so HTML5 events reach the webview", () => {
    const mainWindow = config.app.windows.find(
      (w: { label: string }) => w.label === "main",
    );
    expect(mainWindow).toBeDefined();
    expect(mainWindow.dragDropEnabled).toBe(false);
  });

  it("signs the macOS bundle so the notification centre will accept it", () => {
    // Without an identity the bundler skips codesign entirely and the app
    // ships linker-signed: its code-signing identifier is a hash, its
    // Info.plist is unbound, and UNUserNotificationCenter refuses to
    // register it — which silently drops Velo to plain-text notifications
    // with no buttons and no click to hear.
    expect(config.bundle.macOS.signingIdentity).toBeTruthy();
  });

  it("carries the same fix number the app shows", () => {
    // Two places have to agree: what Settings → About prints and what Finder
    // reads out of the bundle. Only one of them is easy to forget.
    expect(config.bundle.macOS.bundleVersion).toBe(FIX_NUMBER);
  });

  it("is named and identified as Velo Pro", () => {
    expect(config.identifier).toBe("com.anydaysomething.velopro");
    expect(config.productName).toBe("Velo Pro");
  });
});
