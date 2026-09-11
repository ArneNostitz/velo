import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = {
  select: vi.fn(),
  execute: vi.fn(),
};
const mockSetReadReceiptStatus = vi.fn();

vi.mock("@/services/db/connection", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("@/services/db/messages", () => ({
  setReadReceiptStatus: (...args: unknown[]) => mockSetReadReceiptStatus(...args),
}));

vi.mock("@/services/db/accounts", () => ({ getAccount: vi.fn() }));
vi.mock("@/services/emailActions", () => ({ sendEmail: vi.fn() }));

import { processReadReceiptReports } from "./readReceipts";

describe("processReadReceiptReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.execute.mockResolvedValue({ rowsAffected: 1 });
  });

  it("hides a machine-typed MDN and counts it via In-Reply-To when its body is unavailable", async () => {
    mockDb.select.mockResolvedValue([{ read_receipt_status: null }]);

    await processReadReceiptReports("account-1", [{
      id: "receipt-1",
      mdnReport: "",
      date: 1234,
      fromAddress: "reader@example.com",
      inReplyToHeader: "<original@example.com>",
      referencesHeader: null,
    }]);

    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining("SET is_read_receipt = 1"),
      ["account-1", "receipt-1"],
    );
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining("read_receipt_count = read_receipt_count + 1"),
      [1234, "account-1", "<original@example.com>"],
    );
    expect(mockSetReadReceiptStatus).toHaveBeenCalledWith(
      "account-1",
      "receipt-1",
      "processed",
    );
  });

  it("falls back to the responder when the provider exposes neither report body nor reference", async () => {
    mockDb.select.mockImplementation((sql: string) => {
      if (sql.includes("SELECT read_receipt_status")) {
        return Promise.resolve([{ read_receipt_status: null }]);
      }
      if (sql.includes("ORDER BY date DESC LIMIT 1")) {
        return Promise.resolve([{ id: "original-1" }]);
      }
      return Promise.resolve([]);
    });

    await processReadReceiptReports("account-1", [{
      id: "receipt-2",
      mdnReport: "",
      date: 5678,
      fromAddress: "reader@example.com",
      inReplyToHeader: null,
      referencesHeader: null,
    }]);

    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining("LOWER(COALESCE(to_addresses, '')) LIKE $2"),
      ["account-1", "%reader@example.com%", 5678],
    );
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE account_id = $2 AND id = $3"),
      [5678, "account-1", "original-1"],
    );
  });
});
