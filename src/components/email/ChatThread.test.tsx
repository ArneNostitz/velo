import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatThread, isOwnMessage } from "./ChatThread";
import type { DbMessage } from "@/services/db/messages";

// The bubble body renders a sandboxed iframe and fetches attachments — neither
// belongs in a test of the conversation layout
vi.mock("./EmailRenderer", () => ({
  EmailRenderer: ({ html, text }: { html: string | null; text: string | null }) => (
    <div data-testid="body">{html ?? text}</div>
  ),
}));
vi.mock("./InlineAttachmentPreview", () => ({ InlineAttachmentPreview: () => null }));
vi.mock("./AttachmentList", () => ({
  AttachmentList: () => null,
  // Left pending: resolving it would settle state outside act() and say
  // nothing about the layout under test
  getAttachmentsForMessage: () => new Promise(() => {}),
  useAttachmentViewer: () => ({ openAttachment: vi.fn(), viewer: null }),
}));
vi.mock("./SenderAvatar", () => ({ SenderAvatar: () => <div /> }));
vi.mock("./AuthBadge", () => ({ AuthBadge: () => null }));
vi.mock("@/hooks/useTimeFormat", () => ({ useTimeFormat: () => {} }));

function makeMessage(overrides: Partial<DbMessage> = {}): DbMessage {
  return {
    id: "m1",
    account_id: "a1",
    thread_id: "t1",
    from_address: "sam@example.com",
    from_name: "Sam",
    to_addresses: "me@example.com",
    cc_addresses: null,
    bcc_addresses: null,
    reply_to: null,
    subject: "Hi",
    snippet: "a snippet",
    date: 1_700_000_000_000,
    is_read: 1,
    is_starred: 0,
    body_html: "<p>hello</p>",
    body_text: null,
    body_cached: 1,
    raw_size: null,
    internal_date: null,
    list_unsubscribe: null,
    list_unsubscribe_post: null,
    auth_results: null,
    message_id_header: null,
    references_header: null,
    in_reply_to_header: null,
    imap_uid: null,
    imap_folder: null,
    disposition_notification_to: null,
    read_receipt_status: null,
    read_receipt_count: 0,
    read_receipt_last_at: null,
    ...overrides,
  };
}

const own = new Set(["me@example.com"]);

describe("isOwnMessage", () => {
  it("matches the user's own address case-insensitively", () => {
    expect(isOwnMessage(makeMessage({ from_address: "ME@Example.com" }), own)).toBe(true);
  });

  it("does not match the other side", () => {
    expect(isOwnMessage(makeMessage(), own)).toBe(false);
  });

  it("does not match a message with no sender", () => {
    expect(isOwnMessage(makeMessage({ from_address: null }), own)).toBe(false);
  });
});

describe("ChatThread", () => {
  const messages = [
    makeMessage({ id: "m1", from_address: "sam@example.com", from_name: "Sam" }),
    makeMessage({ id: "m2", from_address: "me@example.com", from_name: "Me" }),
  ];

  it("puts the user's messages on the right and theirs on the left", () => {
    const { container } = render(<ChatThread messages={messages} ownAddresses={own} blockImages={false} />);
    const rows = container.querySelectorAll(".flex.px-4.py-2");
    expect(rows[0]!.className).toContain("justify-start");
    expect(rows[1]!.className).toContain("justify-end");
  });

  it("names the user's own messages 'You'", () => {
    render(<ChatThread messages={messages} ownAddresses={own} blockImages={false} />);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
  });

  it("starts expanded and folds every message with one click", () => {
    render(<ChatThread messages={messages} ownAddresses={own} blockImages={false} />);
    expect(screen.getAllByTestId("body")).toHaveLength(2);

    fireEvent.click(screen.getByText("Collapse all"));
    expect(screen.queryAllByTestId("body")).toHaveLength(0);
    expect(screen.getByText("Expand all")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Expand all"));
    expect(screen.getAllByTestId("body")).toHaveLength(2);
  });

  it("starts folded when told to, and expands all from there", () => {
    render(
      <ChatThread messages={messages} ownAddresses={own} blockImages={false} defaultCollapsed />,
    );
    expect(screen.queryAllByTestId("body")).toHaveLength(0);

    fireEvent.click(screen.getByText("Expand all"));
    expect(screen.getAllByTestId("body")).toHaveLength(2);
  });

  it("hides the toolbar when the caller supplies its own", () => {
    render(<ChatThread messages={messages} ownAddresses={own} blockImages={false} hideToolbar />);
    expect(screen.queryByText("Collapse all")).not.toBeInTheDocument();
  });

  it("trims a quoted reply and offers the original", () => {
    const quoted = [
      makeMessage({
        id: "m3",
        body_html: "<div>Just the reply</div><blockquote>old mail</blockquote>",
      }),
    ];
    render(<ChatThread messages={quoted} ownAddresses={own} blockImages={false} />);
    expect(screen.getByTestId("body").textContent).toContain("Just the reply");
    expect(screen.getByTestId("body").textContent).not.toContain("old mail");

    fireEvent.click(screen.getByText("View full"));
    expect(screen.getByTestId("body").textContent).toContain("old mail");
  });
});
