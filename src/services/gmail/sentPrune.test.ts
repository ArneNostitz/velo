import { describe, it, expect } from "vitest";
import { shouldKeepSentLabel } from "./sentPrune";

const own = new Set(["arne@noria.at", "arne@nostitz.at"]);

describe("shouldKeepSentLabel", () => {
  it("keeps Sent when the user wrote to someone else", () => {
    // The Mara exchange: Apple Mail send from the user's alias to Mara
    expect(shouldKeepSentLabel([
      { fromAddress: "mara.weinblatt@ai-at.eu", toAddresses: "arne@nostitz.at" },
      { fromAddress: "arne@nostitz.at", toAddresses: "Mara Weinblatt <mara.weinblatt@ai-at.eu>" },
    ], own)).toBe(true);
  });

  it("drops Sent for mail an app relayed through the account", () => {
    // matchMii: From a stranger, filed as Sent only because the account transmitted it
    expect(shouldKeepSentLabel([
      { fromAddress: "hello@matchmii.com", toAddresses: "undisclosed-recipients:;" },
    ], own)).toBe(false);
  });

  it("drops Sent for a relayed mail whose From was rewritten to the user", () => {
    // The earlier login mails: From the user's own address, addressed back to them
    expect(shouldKeepSentLabel([
      { fromAddress: "arne@noria.at", toAddresses: "arne@noria.at" },
    ], own)).toBe(false);
  });

  it("drops Sent for a note to oneself — it arrived, so it lives in the inbox", () => {
    expect(shouldKeepSentLabel([
      { fromAddress: "arne@noria.at", toAddresses: "Arne <arne@nostitz.at>" },
    ], own)).toBe(false);
  });

  it("counts a Cc to someone else as sending to them", () => {
    expect(shouldKeepSentLabel([
      { fromAddress: "arne@noria.at", toAddresses: "arne@noria.at", ccAddresses: "bob@x.tld" },
    ], own)).toBe(true);
  });

  it("is case-insensitive about the user's addresses", () => {
    expect(shouldKeepSentLabel([
      { fromAddress: "Arne@Noria.at", toAddresses: "kontakt@sparda-ostbayern.de" },
    ], own)).toBe(true);
  });

  it("handles an empty thread", () => {
    expect(shouldKeepSentLabel([], own)).toBe(false);
  });
});
