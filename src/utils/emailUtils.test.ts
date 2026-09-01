import { normalizeEmail, extractEmailAddresses } from "./emailUtils";

describe("normalizeEmail", () => {
  it("lowercases an email address", () => {
    expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("handles both trim and lowercase", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeEmail("")).toBe("");
  });

  it("handles already normalized email", () => {
    expect(normalizeEmail("user@example.com")).toBe("user@example.com");
  });

  it("handles mixed-case local and domain parts", () => {
    expect(normalizeEmail("John.Doe@Gmail.Com")).toBe("john.doe@gmail.com");
  });
});

describe("extractEmailAddresses", () => {
  it("returns nothing for empty input", () => {
    expect(extractEmailAddresses(null)).toEqual([]);
    expect(extractEmailAddresses(undefined)).toEqual([]);
    expect(extractEmailAddresses("")).toEqual([]);
  });

  it("splits a plain address list", () => {
    expect(extractEmailAddresses("a@example.com, b@example.com")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("strips display names", () => {
    expect(extractEmailAddresses("Arne Nostitz-Rieneck <arne@diracting.com>")).toEqual([
      "arne@diracting.com",
    ]);
  });

  it("keeps a quoted display name containing a comma in one address", () => {
    expect(extractEmailAddresses('"Doe, John" <john@example.com>, b@example.com')).toEqual([
      "john@example.com",
      "b@example.com",
    ]);
  });

  it("lowercases addresses", () => {
    expect(extractEmailAddresses("Arne <Arne@Diracting.COM>")).toEqual(["arne@diracting.com"]);
  });

  it("skips entries without an address", () => {
    expect(extractEmailAddresses("undisclosed-recipients:;, b@example.com")).toEqual([
      "b@example.com",
    ]);
  });
});
