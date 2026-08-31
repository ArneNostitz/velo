import { render, waitFor, screen } from "@testing-library/react";
import { act } from "react";
import { EmailRenderer } from "./EmailRenderer";
import type { DbAttachment } from "@/services/db/attachments";
import type { MessageScanResult } from "@/utils/phishingDetector";

// Mock dependencies
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/utils/sanitize", () => ({
  sanitizeHtml: (html: string) => html,
  escapeHtml: (text: string) => text,
}));

vi.mock("@/services/db/imageAllowlist", () => ({
  addToAllowlist: vi.fn(),
}));

vi.mock("@/stores/uiStore", () => ({
  useUIStore: (selector: (s: { theme: string }) => string) =>
    selector({ theme: "light" }),
}));

const mockFetchAttachment = vi.fn();

vi.mock("@/services/email/providerFactory", () => ({
  getEmailProvider: vi.fn().mockResolvedValue({
    fetchAttachment: (...args: unknown[]) => mockFetchAttachment(...args),
  }),
}));

// Mock ResizeObserver for jsdom
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

function makeAttachment(overrides: Partial<DbAttachment> = {}): DbAttachment {
  return {
    id: "att-1",
    message_id: "msg-1",
    account_id: "acc-1",
    filename: "icon.png",
    mime_type: "image/png",
    size: 1024,
    gmail_attachment_id: "gmail-att-1",
    content_id: "icon@example.com",
    is_inline: 1,
    local_path: null,
    ...overrides,
  };
}


function makeScanResult(
  url: string,
  riskScore: number,
  overrides: Partial<MessageScanResult> = {},
): MessageScanResult {
  return {
    messageId: "msg-1",
    links: [
      {
        url,
        displayText: "Click here",
        riskScore,
        riskLevel: riskScore >= 60 ? "high" : riskScore >= 40 ? "medium" : riskScore >= 20 ? "low" : "safe",
        triggeredRules: riskScore
          ? [{ ruleId: "test-rule", name: "Test Rule", score: riskScore, detail: "why it is suspicious" }]
          : [],
      },
    ],
    maxRiskScore: riskScore,
    suspiciousLinkCount: riskScore >= 20 ? 1 : 0,
    showBanner: riskScore >= 40,
    scannedAt: Date.now(),
    ...overrides,
  };
}

/** Click the first anchor inside the rendered iframe document. */
function clickIframeLink(container: HTMLElement): void {
  const iframe = container.querySelector("iframe") as HTMLIFrameElement;
  const doc = iframe.contentDocument!;
  const anchor = doc.querySelector("a")!;
  act(() => {
    anchor.dispatchEvent(new doc.defaultView!.MouseEvent("click", { bubbles: true }));
  });
}

describe("EmailRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders plain text when no html provided", () => {
    const { container } = render(
      <EmailRenderer html={null} text="Hello world" />,
    );
    expect(container.querySelector("iframe")).toBeTruthy();
  });

  it("renders html content in iframe", () => {
    const { container } = render(
      <EmailRenderer html="<p>Hello</p>" text={null} />,
    );
    expect(container.querySelector("iframe")).toBeTruthy();
  });

  it("resolves cid: references by fetching inline attachment data", async () => {
    const base64Data = btoa("fake-image-data");
    mockFetchAttachment.mockResolvedValue({ data: base64Data, size: 100 });

    const inlineAttachments = [makeAttachment()];

    const { container } = render(
      <EmailRenderer
        html='<img src="cid:icon@example.com" />'
        text={null}
        accountId="acc-1"
        messageId="msg-1"
        inlineAttachments={inlineAttachments}
      />,
    );

    await waitFor(() => {
      expect(mockFetchAttachment).toHaveBeenCalledWith("msg-1", "gmail-att-1");
    });

    expect(container.querySelector("iframe")).toBeTruthy();
  });

  it("skips cid resolution when no inline attachments", () => {
    render(
      <EmailRenderer
        html='<img src="cid:missing@example.com" />'
        text={null}
        accountId="acc-1"
        messageId="msg-1"
        inlineAttachments={[]}
      />,
    );

    expect(mockFetchAttachment).not.toHaveBeenCalled();
  });

  it("skips cid resolution when accountId or messageId missing", () => {
    const inlineAttachments = [makeAttachment()];

    render(
      <EmailRenderer
        html='<img src="cid:icon@example.com" />'
        text={null}
        inlineAttachments={inlineAttachments}
      />,
    );

    expect(mockFetchAttachment).not.toHaveBeenCalled();
  });

  it("handles fetch failure gracefully", async () => {
    mockFetchAttachment.mockRejectedValue(new Error("Network error"));

    const inlineAttachments = [makeAttachment()];

    const { container } = render(
      <EmailRenderer
        html='<img src="cid:icon@example.com" />'
        text={null}
        accountId="acc-1"
        messageId="msg-1"
        inlineAttachments={inlineAttachments}
      />,
    );

    await waitFor(() => {
      expect(mockFetchAttachment).toHaveBeenCalled();
    });

    expect(container.querySelector("iframe")).toBeTruthy();
  });

  it("resolves multiple cid references", async () => {
    mockFetchAttachment
      .mockResolvedValueOnce({ data: btoa("img1"), size: 50 })
      .mockResolvedValueOnce({ data: btoa("img2"), size: 60 });

    const inlineAttachments = [
      makeAttachment({ id: "att-1", content_id: "img1@ex.com", gmail_attachment_id: "g1" }),
      makeAttachment({ id: "att-2", content_id: "img2@ex.com", gmail_attachment_id: "g2", mime_type: "image/jpeg" }),
    ];

    render(
      <EmailRenderer
        html='<img src="cid:img1@ex.com" /><img src="cid:img2@ex.com" />'
        text={null}
        accountId="acc-1"
        messageId="msg-1"
        inlineAttachments={inlineAttachments}
      />,
    );

    await waitFor(() => {
      expect(mockFetchAttachment).toHaveBeenCalledTimes(2);
      expect(mockFetchAttachment).toHaveBeenCalledWith("msg-1", "g1");
      expect(mockFetchAttachment).toHaveBeenCalledWith("msg-1", "g2");
    });
  });

  it("ignores attachments without content_id or gmail_attachment_id", () => {
    const inlineAttachments = [
      makeAttachment({ content_id: null }),
      makeAttachment({ id: "att-2", gmail_attachment_id: null }),
    ];

    render(
      <EmailRenderer
        html='<img src="cid:icon@example.com" />'
        text={null}
        accountId="acc-1"
        messageId="msg-1"
        inlineAttachments={inlineAttachments}
      />,
    );

    expect(mockFetchAttachment).not.toHaveBeenCalled();
  });

  describe("phishing link confirmation", () => {
    const html = '<a href="https://paypal-security.com/verify">Click here</a>';

    it("opens a safe link directly without a confirmation dialog", async () => {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      const { container } = render(
        <EmailRenderer html={html} text={null} scanResult={makeScanResult("https://paypal-security.com/verify", 0)} />,
      );

      clickIframeLink(container);

      expect(openUrl).toHaveBeenCalledWith("https://paypal-security.com/verify");
      expect(screen.queryByText(/Suspicious Link|High Risk Link/)).toBeNull();
    });

    it("shows the confirmation dialog instead of opening a flagged link", async () => {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      const { container } = render(
        <EmailRenderer html={html} text={null} scanResult={makeScanResult("https://paypal-security.com/verify", 50)} />,
      );

      clickIframeLink(container);

      expect(openUrl).not.toHaveBeenCalled();
      expect(screen.getByText("Suspicious Link")).toBeTruthy();
      // The real destination is shown to the user before anything opens
      expect(screen.getByText("https://paypal-security.com/verify")).toBeTruthy();
      expect(screen.getByText("Test Rule")).toBeTruthy();
    });

    it("labels a high-risk link differently", async () => {
      const { container } = render(
        <EmailRenderer html={html} text={null} scanResult={makeScanResult("https://paypal-security.com/verify", 70)} />,
      );

      clickIframeLink(container);

      expect(screen.getByText("High Risk Link")).toBeTruthy();
    });

    it("opens the link after the user confirms", async () => {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      const { container } = render(
        <EmailRenderer html={html} text={null} scanResult={makeScanResult("https://paypal-security.com/verify", 50)} />,
      );

      clickIframeLink(container);
      act(() => {
        screen.getByText("Open Anyway").click();
      });

      await waitFor(() => {
        expect(openUrl).toHaveBeenCalledWith("https://paypal-security.com/verify");
      });
    });

    it("does not open the link when the user goes back", async () => {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      const { container } = render(
        <EmailRenderer html={html} text={null} scanResult={makeScanResult("https://paypal-security.com/verify", 50)} />,
      );

      clickIframeLink(container);
      act(() => {
        screen.getByText("Go Back").click();
      });

      expect(openUrl).not.toHaveBeenCalled();
      expect(screen.queryByText("Suspicious Link")).toBeNull();
    });

    it("matches a flagged link even when the href is normalised by the browser", async () => {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      // Scan recorded the raw href without a trailing slash; anchor.href adds one
      const { container } = render(
        <EmailRenderer
          html='<a href="https://evil.example">Click here</a>'
          text={null}
          scanResult={makeScanResult("https://evil.example", 50)}
        />,
      );

      clickIframeLink(container);

      expect(openUrl).not.toHaveBeenCalled();
      expect(screen.getByText("Suspicious Link")).toBeTruthy();
    });

    it("opens links normally when scanning is disabled (no scan result)", async () => {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      const { container } = render(<EmailRenderer html={html} text={null} scanResult={null} />);

      clickIframeLink(container);

      expect(openUrl).toHaveBeenCalledWith("https://paypal-security.com/verify");
    });
  });
});
