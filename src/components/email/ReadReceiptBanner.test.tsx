import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { DbMessage } from "@/services/db/messages";
import { useAccountStore } from "@/stores/accountStore";

const mockCollectOwnAddresses = vi.fn();
const mockGetSetting = vi.fn();

vi.mock("@/services/accounts/ownAddresses", () => ({
  collectOwnAddresses: (...args: unknown[]) => mockCollectOwnAddresses(...args),
}));

vi.mock("@/services/db/settings", () => ({
  getSetting: (...args: unknown[]) => mockGetSetting(...args),
}));

import { ReadReceiptBanner } from "./ReadReceiptBanner";

const message: DbMessage = {
  id: "sent-from-alias",
  account_id: "account-1",
  thread_id: "thread-1",
  from_address: "alias@example.com",
  from_name: "Me",
  to_addresses: "reader@example.net",
  cc_addresses: null,
  bcc_addresses: null,
  reply_to: null,
  subject: "Hello",
  snippet: "Hello",
  date: 1,
  is_read: 1,
  is_starred: 0,
  body_html: "<p>Hello</p>",
  body_text: "Hello",
  body_cached: 1,
  raw_size: 100,
  internal_date: 1,
  list_unsubscribe: null,
  list_unsubscribe_post: null,
  auth_results: null,
  message_id_header: "<sent@example.com>",
  references_header: null,
  in_reply_to_header: null,
  imap_uid: null,
  imap_folder: null,
  disposition_notification_to: "alias@example.com",
  read_receipt_status: null,
  read_receipt_count: 0,
  read_receipt_last_at: null,
  is_read_receipt: 0,
};

describe("ReadReceiptBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAccountStore.setState({
      accounts: [{
        id: "account-1",
        email: "primary@example.com",
        displayName: "Me",
        avatarUrl: null,
        isActive: true,
      }],
    });
    mockGetSetting.mockResolvedValue("ask");
  });

  it("never prompts for a Sent message authored through a send-as alias", async () => {
    mockCollectOwnAddresses.mockResolvedValue([
      "primary@example.com",
      "alias@example.com",
    ]);

    render(<ReadReceiptBanner message={message} />);

    await waitFor(() => expect(mockCollectOwnAddresses).toHaveBeenCalled());
    expect(screen.queryByText("Read receipt requested")).not.toBeInTheDocument();
    expect(mockGetSetting).not.toHaveBeenCalled();
  });

  it("still prompts for a genuine incoming request", async () => {
    mockCollectOwnAddresses.mockResolvedValue(["primary@example.com"]);

    render(<ReadReceiptBanner message={message} />);

    expect(await screen.findByText("Read receipt requested")).toBeInTheDocument();
  });
});
