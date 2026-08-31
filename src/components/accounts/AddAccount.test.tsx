import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const startOAuthFlow = vi.hoisted(() => vi.fn());
const insertAccount = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const getClientId = vi.hoisted(() => vi.fn());
const getClientSecret = vi.hoisted(() => vi.fn());

vi.mock("@/services/gmail/auth", () => ({ startOAuthFlow }));
vi.mock("@/services/db/accounts", () => ({
  insertAccount,
  insertImapAccount: vi.fn(),
  insertOAuthImapAccount: vi.fn(),
  insertCalDavAccount: vi.fn(),
}));
vi.mock("@/services/gmail/tokenManager", () => ({ getClientId, getClientSecret }));
vi.mock("@/services/db/settings", () => ({
  setSetting: vi.fn().mockResolvedValue(undefined),
  setSecureSetting: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@/services/calendar/autoDiscovery", () => ({
  discoverCalDavSettings: vi.fn(),
  testCalDavConnection: vi.fn(),
}));

import { AddAccount } from "./AddAccount";

describe("AddAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClientId.mockResolvedValue("client-id");
    getClientSecret.mockResolvedValue("client-secret");
    startOAuthFlow.mockImplementation(() => new Promise(() => {}));
  });

  it("offers Google, provider presets and a manual IMAP option", () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);

    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    expect(screen.getByText("iCloud")).toBeInTheDocument();
    expect(screen.getByText("Fastmail")).toBeInTheDocument();
    expect(
      screen.getByText("Other mail account (IMAP/SMTP)"),
    ).toBeInTheDocument();
  });

  it("starts the browser OAuth flow directly from the Google tile", async () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.click(screen.getByText("Continue with Google"));

    await waitFor(() =>
      expect(startOAuthFlow).toHaveBeenCalledWith("client-id", "client-secret"),
    );
    expect(
      await screen.findByText(
        "Finish signing in in your browser, then come back here.",
      ),
    ).toBeInTheDocument();
  });

  it("falls back to credential setup when no client ID is configured", async () => {
    getClientId.mockRejectedValue(new Error("Client ID not configured"));

    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    fireEvent.click(screen.getByText("Continue with Google"));

    expect(await screen.findByText("Google API Setup")).toBeInTheDocument();
  });

  it("surfaces OAuth errors instead of silently failing", async () => {
    startOAuthFlow.mockRejectedValue(new Error("user closed the browser"));

    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);
    fireEvent.click(screen.getByText("Continue with Google"));

    expect(
      await screen.findByText("user closed the browser"),
    ).toBeInTheDocument();
  });

  it("opens the IMAP wizard pre-filled when a provider preset is picked", async () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.click(screen.getByText("Fastmail"));

    expect(await screen.findByText("Set up Fastmail")).toBeInTheDocument();
    // Step 2 of the wizard carries the provider's incoming server
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "me@fastmail.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter your email password or app password"),
      { target: { value: "hunter2" } },
    );
    fireEvent.click(screen.getByText("Next"));

    expect(
      await screen.findByDisplayValue("imap.fastmail.com"),
    ).toBeInTheDocument();
  });

  it("returns to the picker from the IMAP wizard", async () => {
    render(<AddAccount onClose={() => {}} onSuccess={() => {}} />);

    fireEvent.click(screen.getByText("Other mail account (IMAP/SMTP)"));
    expect(await screen.findByText("Add IMAP/SMTP Account")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Back"));
    expect(await screen.findByText("Continue with Google")).toBeInTheDocument();
  });
});
