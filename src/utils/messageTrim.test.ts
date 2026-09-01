import { trimHtmlBody, trimTextBody, trimMessageBody } from "./messageTrim";

describe("trimHtmlBody", () => {
  it("removes a Gmail quote block", () => {
    const html =
      '<div>Hi Sam, bekommst dus jetzt?</div><div class="gmail_quote"><blockquote>old mail</blockquote></div>';
    const result = trimHtmlBody(html);
    expect(result.trimmed).toBe(true);
    expect(result.html).toContain("Hi Sam");
    expect(result.html).not.toContain("old mail");
  });

  it("removes a bare blockquote", () => {
    const result = trimHtmlBody("<p>Sure thing</p><blockquote>quoted</blockquote>");
    expect(result.trimmed).toBe(true);
    expect(result.html).not.toContain("quoted");
  });

  it("removes an attribution line and everything after it", () => {
    const html =
      "<div>Thanks!</div><div>On Tue, Sep 1, 2026 at 23:27, Arne wrote:</div><div>previous body</div>";
    const result = trimHtmlBody(html);
    expect(result.trimmed).toBe(true);
    expect(result.html).toContain("Thanks!");
    expect(result.html).not.toContain("previous body");
    expect(result.html).not.toContain("wrote:");
  });

  it("removes a trailing signature block", () => {
    const html = "<div>See you</div><div>--</div><div>Arne Nostitz-Rieneck</div>";
    const result = trimHtmlBody(html);
    expect(result.trimmed).toBe(true);
    expect(result.html).not.toContain("Nostitz");
  });

  it("removes a Gmail signature container", () => {
    const html = '<div>Body text</div><div class="gmail_signature">Best, Arne</div>';
    const result = trimHtmlBody(html);
    expect(result.trimmed).toBe(true);
    expect(result.html).not.toContain("Best, Arne");
  });

  it("leaves an unquoted body untouched", () => {
    const html = "<p>Just a normal message</p>";
    expect(trimHtmlBody(html)).toEqual({ html, trimmed: false });
  });

  it("keeps the original when trimming would empty the body", () => {
    const html = "<blockquote>everything is a quote</blockquote>";
    const result = trimHtmlBody(html);
    expect(result.trimmed).toBe(false);
    expect(result.html).toBe(html);
  });

  it("does not cut on an attribution line that is the whole body", () => {
    const html = "<div>On Tue, Sep 1, 2026 at 23:27, Arne wrote:</div>";
    expect(trimHtmlBody(html).trimmed).toBe(false);
  });
});

describe("trimTextBody", () => {
  it("drops a trailing run of quoted lines", () => {
    const text = "My reply\n\n> old line\n> another old line";
    const result = trimTextBody(text);
    expect(result.trimmed).toBe(true);
    expect(result.text).toBe("My reply");
  });

  it("drops everything from the signature separator", () => {
    const result = trimTextBody("Body\n\n-- \nArne\nCEO");
    expect(result.trimmed).toBe(true);
    expect(result.text).toBe("Body");
  });

  it("drops an attribution line and the quote under it", () => {
    const result = trimTextBody("Sure\nOn Tue, Sep 1, 2026 at 23:27, Arne wrote:\nold");
    expect(result.trimmed).toBe(true);
    expect(result.text).toBe("Sure");
  });

  it("leaves a plain body untouched", () => {
    const text = "Nothing to trim here";
    expect(trimTextBody(text)).toEqual({ text, trimmed: false });
  });

  it("keeps the original when the trim would empty it", () => {
    const text = "> only a quote";
    expect(trimTextBody(text).trimmed).toBe(false);
  });
});

describe("trimMessageBody", () => {
  it("prefers the HTML body", () => {
    const result = trimMessageBody("<p>hi</p><blockquote>q</blockquote>", "hi\n> q");
    expect(result.trimmed).toBe(true);
    expect(result.html).not.toContain("<blockquote>");
  });

  it("falls back to text when there is no HTML", () => {
    const result = trimMessageBody(null, "hi\n> q");
    expect(result.trimmed).toBe(true);
    expect(result.text).toBe("hi");
  });

  it("handles an empty message", () => {
    expect(trimMessageBody(null, null)).toEqual({ html: null, text: null, trimmed: false });
  });
});
