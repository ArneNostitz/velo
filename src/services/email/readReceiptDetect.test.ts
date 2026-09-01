import { describe, it, expect } from "vitest";
import { looksLikeReadReceipt } from "./readReceipts";

// Verbatim from a real Thunderbird receipt that reached the inbox as mail
const REAL_GERMAN = {
  subject: "Empfangsbestätigung (angezeigt) -bekomme ich ein read receipt?",
  body_text:
    "Dies ist eine Empfangsbestätigung für die Nachricht, die Sie an julian@petermaier.at gesendet haben.\n\n"
    + "Beachten Sie: Diese Empfangsbestätigung sagt nur aus, dass die Nachricht am Computer des Empfängers angezeigt wurde.",
};

describe("looksLikeReadReceipt", () => {
  it("recognises the German receipt that was showing up as mail", () => {
    expect(looksLikeReadReceipt(REAL_GERMAN)).toBe(true);
  });

  it("recognises the English form", () => {
    expect(looksLikeReadReceipt({
      subject: "Read Receipt (display) - quarterly numbers",
      body_text: "This is a Return Receipt for the mail that you sent. Note: it only shows the message was displayed.",
    })).toBe(true);
  });

  it("trusts the stored flag without re-checking the text", () => {
    expect(looksLikeReadReceipt({ subject: null, body_text: null, is_read_receipt: 1 })).toBe(true);
  });

  it("leaves a person's mail about read receipts alone", () => {
    // The subject alone must never be enough — this is the false positive
    // that would hide real mail from the inbox
    expect(looksLikeReadReceipt({
      subject: "bekomme ich ein read receipt?",
      body_text: "mal sehen … schau mal rein … und dann nochmal",
    })).toBe(false);
  });

  it("leaves a delivery notice alone — delivered is not displayed", () => {
    expect(looksLikeReadReceipt({
      subject: "Delivery Status Notification",
      body_text: "Your message was delivered to the following recipients.",
    })).toBe(false);
  });

  it("handles a message with no subject", () => {
    expect(looksLikeReadReceipt({ subject: null, body_text: "anything" })).toBe(false);
  });
});
