import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SetupClientId } from "./SetupClientId";

vi.mock("@/services/db/settings", () => ({
  setSetting: vi.fn().mockResolvedValue(undefined),
  setSecureSetting: vi.fn().mockResolvedValue(undefined),
}));

const openUrl = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));

const VALID_ID = "1234567890-abcdefghijklmnop.apps.googleusercontent.com";
const VALID_SECRET = "GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz";

describe("SetupClientId", () => {
  it("disables Save button when both fields are empty", () => {
    render(<SetupClientId onComplete={() => {}} onCancel={() => {}} />);
    const saveButton = screen.getByText("Save & Continue");
    expect(saveButton).toBeDisabled();
  });

  it("disables Save button when only client ID is provided", () => {
    render(<SetupClientId onComplete={() => {}} onCancel={() => {}} />);
    const inputs = screen.getAllByRole("textbox");
    // Client ID is the text input; secret is password (not a textbox role)
    const clientIdInput = screen.getByPlaceholderText(
      "Paste your Client ID here...",
    );
    fireEvent.change(clientIdInput, { target: { value: VALID_ID } });

    const saveButton = screen.getByText("Save & Continue");
    expect(saveButton).toBeDisabled();
  });

  it("disables Save button when only client secret is provided", () => {
    render(<SetupClientId onComplete={() => {}} onCancel={() => {}} />);
    const secretInput = screen.getByPlaceholderText(
      "Paste your Client Secret here...",
    );
    fireEvent.change(secretInput, { target: { value: VALID_SECRET } });

    const saveButton = screen.getByText("Save & Continue");
    expect(saveButton).toBeDisabled();
  });

  it("enables Save button when both fields are filled", () => {
    render(<SetupClientId onComplete={() => {}} onCancel={() => {}} />);
    const clientIdInput = screen.getByPlaceholderText(
      "Paste your Client ID here...",
    );
    const secretInput = screen.getByPlaceholderText(
      "Paste your Client Secret here...",
    );

    fireEvent.change(clientIdInput, { target: { value: VALID_ID } });
    fireEvent.change(secretInput, { target: { value: VALID_SECRET } });

    const saveButton = screen.getByText("Save & Continue");
    expect(saveButton).not.toBeDisabled();
  });

  it("catches the client secret being pasted into the Client ID field", () => {
    // Google only reports this as "Error 401: invalid_client" on its own page,
    // after the browser has already opened.
    render(<SetupClientId onComplete={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Paste your Client ID here..."), {
      target: { value: VALID_SECRET },
    });
    fireEvent.change(screen.getByPlaceholderText("Paste your Client Secret here..."), {
      target: { value: VALID_SECRET },
    });

    expect(screen.getByText(/looks like the Client Secret/)).toBeInTheDocument();
    expect(screen.getByText("Save & Continue")).toBeDisabled();
  });

  it("catches the client ID being pasted into the Client Secret field", () => {
    render(<SetupClientId onComplete={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Paste your Client ID here..."), {
      target: { value: VALID_ID },
    });
    fireEvent.change(screen.getByPlaceholderText("Paste your Client Secret here..."), {
      target: { value: VALID_ID },
    });

    expect(screen.getByText(/looks like the Client ID/)).toBeInTheDocument();
    expect(screen.getByText("Save & Continue")).toBeDisabled();
  });

  it("shows helper text about client secret being required", () => {
    render(<SetupClientId onComplete={() => {}} onCancel={() => {}} />);
    expect(
      screen.getByText("Required for Web application credentials"),
    ).toBeInTheDocument();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<SetupClientId onComplete={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("opens the Google Cloud credentials page in the browser", () => {
    render(<SetupClientId onComplete={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByText("Open Google Cloud credentials"));
    expect(openUrl).toHaveBeenCalledWith(
      "https://console.cloud.google.com/apis/credentials",
    );
  });

  it("shows the redirect URI the user has to authorize", () => {
    render(<SetupClientId onComplete={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("http://127.0.0.1:17248")).toBeInTheDocument();
  });
});
