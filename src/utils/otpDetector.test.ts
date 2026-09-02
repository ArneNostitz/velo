import { describe, it, expect } from "vitest";
import { detectOtpCode, detectSignInLink } from "./otpDetector";

describe("detectOtpCode", () => {
  it("reads a code out of the subject", () => {
    expect(detectOtpCode("493028 is your verification code", null)?.code).toBe("493028");
  });

  it("reads the common body phrasing", () => {
    expect(detectOtpCode(null, "Your verification code is 728193. It expires in 10 minutes.")?.code)
      .toBe("728193");
  });

  it("handles a code the sender split for readability", () => {
    expect(detectOtpCode(null, "Security code: 123 456")?.code).toBe("123456");
  });

  it("handles German", () => {
    expect(detectOtpCode(null, "Ihr Bestätigungscode lautet 884201.")?.code).toBe("884201");
  });

  it("takes an alphanumeric code", () => {
    expect(detectOtpCode(null, "Your login code is A1B2C3")?.code).toBe("A1B2C3");
  });

  it("picks the code nearest the words that qualify it", () => {
    const body = "Order 55512345 shipped. Your security code is 664120. Ref 99887766.";
    expect(detectOtpCode(null, body)?.code).toBe("664120");
  });

  // Everything below would overwrite the user's clipboard if it matched
  it("ignores an order number with no code wording", () => {
    expect(detectOtpCode("Order 4851209 confirmed", "Your parcel is on the way.")).toBeNull();
  });

  it("ignores a year", () => {
    expect(detectOtpCode(null, "Your security code expires in 2026")).toBeNull();
  });

  it("ignores a password-changed notice", () => {
    expect(detectOtpCode("Your password was changed", "If this was not you, contact us on 8005551234."))
      .toBeNull();
  });

  it("ignores a repeated-digit placeholder", () => {
    expect(detectOtpCode(null, "Your verification code is 000000")).toBeNull();
  });

  it("ignores an invoice total near the word code", () => {
    expect(detectOtpCode(null, "Promo code applied. Total: 1899")).toBeNull();
  });

  it("returns null on an empty message", () => {
    expect(detectOtpCode(null, null)).toBeNull();
  });
});

describe("detectSignInLink", () => {
  it("finds the sign-in button", () => {
    const html = '<a href="https://app.example.com/magic?t=abc">Sign in to your account</a>';
    expect(detectSignInLink(html)).toEqual({
      url: "https://app.example.com/magic?t=abc",
      label: "Sign in to your account",
    });
  });

  it("qualifies on the URL when the label is generic", () => {
    const html = '<a href="https://example.com/auth/login?token=xyz">Click here</a>';
    expect(detectSignInLink(html)?.url).toBe("https://example.com/auth/login?token=xyz");
  });

  it("never picks the unsubscribe link", () => {
    const html = '<a href="https://example.com/unsubscribe?login=1">Unsubscribe</a>';
    expect(detectSignInLink(html)).toBeNull();
  });

  it("skips images that happen to sit in an anchor", () => {
    const html = '<a href="https://cdn.example.com/login-banner.png">Verify</a>';
    expect(detectSignInLink(html)).toBeNull();
  });

  it("ignores mailto and other schemes", () => {
    expect(detectSignInLink('<a href="mailto:a@b.com">Confirm</a>')).toBeNull();
  });

  it("returns null for an ordinary newsletter", () => {
    const html = '<a href="https://example.com/blog/post">Read our latest post</a>';
    expect(detectSignInLink(html)).toBeNull();
  });

  it("returns null with no body", () => {
    expect(detectSignInLink(null)).toBeNull();
  });
});
