import { describe, it, expect } from "vitest";
import { linkifyPlainText } from "./linkify";

describe("linkifyPlainText", () => {
  it("links a bare https URL", () => {
    expect(linkifyPlainText("See https://example.com/x for more"))
      .toBe('See <a href="https://example.com/x">https://example.com/x</a> for more');
  });

  it("gives a www. address a scheme so it can actually open", () => {
    expect(linkifyPlainText("www.example.com"))
      .toBe('<a href="https://www.example.com">www.example.com</a>');
  });

  it("leaves sentence punctuation out of the link", () => {
    const out = linkifyPlainText("Go to https://example.com/page.");
    expect(out).toContain('href="https://example.com/page"');
    expect(out).toMatch(/<\/a>\.$/);
  });

  it("keeps a bracket the URL opened itself", () => {
    const out = linkifyPlainText("https://en.wikipedia.org/wiki/Foo_(bar)");
    expect(out).toContain('href="https://en.wikipedia.org/wiki/Foo_(bar)"');
  });

  it("drops a bracket that closes the sentence", () => {
    const out = linkifyPlainText("(see https://example.com/x)");
    expect(out).toContain('href="https://example.com/x"');
    expect(out).toMatch(/<\/a>\)$/);
  });

  it("links an email address as mailto", () => {
    expect(linkifyPlainText("write to a.b@example.com please"))
      .toContain('<a href="mailto:a.b@example.com">a.b@example.com</a>');
  });

  it("escapes the surrounding text", () => {
    expect(linkifyPlainText("<script>alert(1)</script>"))
      .toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes a URL that carries markup characters", () => {
    const out = linkifyPlainText('https://example.com/?a="><img src=x>');
    expect(out).not.toContain('"><img');
    expect(out).toContain("&quot;");
  });

  it("handles several links in one line", () => {
    const out = linkifyPlainText("https://a.com and https://b.com");
    expect((out.match(/<a /g) ?? []).length).toBe(2);
  });

  it("leaves text with no links untouched", () => {
    expect(linkifyPlainText("just words here")).toBe("just words here");
  });

  it("handles an empty body", () => {
    expect(linkifyPlainText("")).toBe("");
  });
});
