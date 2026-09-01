import { describe, it, expect } from "vitest";
import {
  buildMdnRaw,
  isReceiptAddressSuspicious,
  needsReadReceipt,
  parseMdnOriginalMessageId,
  parseReceiptAddress,
} from "./readReceipts";

function decodeBase64Url(encoded: string): string {
  let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

describe("parseReceiptAddress", () => {
  it("extracts the address from an angle-bracket form", () => {
    expect(parseReceiptAddress('"Alice" <alice@example.com>')).toBe(
      "alice@example.com",
    );
  });

  it("accepts a bare address", () => {
    expect(parseReceiptAddress("alice@example.com")).toBe("alice@example.com");
  });

  it("takes the first of multiple addresses", () => {
    expect(parseReceiptAddress("a@example.com, b@example.com")).toBe(
      "a@example.com",
    );
  });

  it("returns null for null or garbage input", () => {
    expect(parseReceiptAddress(null)).toBeNull();
    expect(parseReceiptAddress("not an address")).toBeNull();
  });
});

describe("isReceiptAddressSuspicious", () => {
  it("accepts a receipt address on the sender's domain", () => {
    expect(
      isReceiptAddressSuspicious("tracker@example.com", "alice@example.com"),
    ).toBe(false);
  });

  it("flags a receipt address on a foreign domain", () => {
    expect(
      isReceiptAddressSuspicious("tracker@spy.io", "alice@example.com"),
    ).toBe(true);
  });

  it("flags when the sender address is unknown", () => {
    expect(isReceiptAddressSuspicious("tracker@spy.io", null)).toBe(true);
  });

  it("compares domains case-insensitively", () => {
    expect(
      isReceiptAddressSuspicious("a@Example.COM", "alice@example.com"),
    ).toBe(false);
  });
});

describe("needsReadReceipt", () => {
  const base = {
    disposition_notification_to: "alice@example.com",
    read_receipt_status: null,
    from_address: "alice@example.com",
  };

  it("wants a receipt for an unanswered request", () => {
    expect(needsReadReceipt(base, "me@mymail.com")).toBe(true);
  });

  it("skips messages without a request header", () => {
    expect(
      needsReadReceipt(
        { ...base, disposition_notification_to: null },
        "me@mymail.com",
      ),
    ).toBe(false);
  });

  it("skips already-answered requests", () => {
    expect(
      needsReadReceipt({ ...base, read_receipt_status: "sent" }, "me@mymail.com"),
    ).toBe(false);
    expect(
      needsReadReceipt(
        { ...base, read_receipt_status: "dismissed" },
        "me@mymail.com",
      ),
    ).toBe(false);
  });

  it("skips messages sent by the account itself", () => {
    expect(
      needsReadReceipt({ ...base, from_address: "Me@MyMail.com" }, "me@mymail.com"),
    ).toBe(false);
  });

  it("skips requests whose header holds no parseable address", () => {
    expect(
      needsReadReceipt(
        { ...base, disposition_notification_to: "not an address" },
        "me@mymail.com",
      ),
    ).toBe(false);
  });
});

describe("parseMdnOriginalMessageId", () => {
  it("extracts the Original-Message-ID from a report part", () => {
    const report = [
      "Reporting-UA: Some Client",
      "Final-Recipient: rfc822;alice@example.com",
      "Original-Message-ID: <orig-42@mymail.com>",
      "Disposition: manual-action/MDN-sent-manually; displayed",
    ].join("\r\n");
    expect(parseMdnOriginalMessageId(report)).toBe("<orig-42@mymail.com>");
  });

  it("matches the header case-insensitively", () => {
    expect(
      parseMdnOriginalMessageId("original-message-id: <x@y.z>\r\n"),
    ).toBe("<x@y.z>");
  });

  it("returns null when the field is missing", () => {
    expect(
      parseMdnOriginalMessageId("Disposition: automatic-action/MDN-sent-automatically; displayed"),
    ).toBeNull();
  });

  it("round-trips the id from our own MDN builder", () => {
    const decoded = (() => {
      let base64 = buildMdnRaw({
        fromEmail: "me@mymail.com",
        toAddress: "alice@example.com",
        originalSubject: "Hi",
        originalMessageId: "<abc-123@mymail.com>",
        automatic: false,
      }).replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4 !== 0) base64 += "=";
      return atob(base64);
    })();
    expect(parseMdnOriginalMessageId(decoded)).toBe("<abc-123@mymail.com>");
  });
});

describe("buildMdnRaw", () => {
  const opts = {
    fromEmail: "me@mymail.com",
    toAddress: "alice@example.com",
    originalSubject: "Quarterly report",
    originalMessageId: "<orig-123@example.com>",
    automatic: false,
  };

  it("builds a multipart/report MDN", () => {
    const decoded = decodeBase64Url(buildMdnRaw(opts));

    expect(decoded).toContain("From: me@mymail.com");
    expect(decoded).toContain("To: alice@example.com");
    expect(decoded).toContain("Subject: Read: Quarterly report");
    expect(decoded).toContain(
      "Content-Type: multipart/report; report-type=disposition-notification;",
    );
    expect(decoded).toContain("Content-Type: message/disposition-notification");
    expect(decoded).toContain("Final-Recipient: rfc822;me@mymail.com");
    expect(decoded).toContain("Original-Message-ID: <orig-123@example.com>");
    expect(decoded).toContain("In-Reply-To: <orig-123@example.com>");
    expect(decoded).toContain(
      "Disposition: manual-action/MDN-sent-manually; displayed",
    );
  });

  it("marks automatic responses as such", () => {
    const decoded = decodeBase64Url(buildMdnRaw({ ...opts, automatic: true }));
    expect(decoded).toContain(
      "Disposition: automatic-action/MDN-sent-automatically; displayed",
    );
  });

  it("copes with a missing subject and Message-ID", () => {
    const decoded = decodeBase64Url(
      buildMdnRaw({ ...opts, originalSubject: null, originalMessageId: null }),
    );
    expect(decoded).toContain("Subject: Read: (no subject)");
    expect(decoded).not.toContain("Original-Message-ID");
    expect(decoded).not.toContain("In-Reply-To");
  });
});
