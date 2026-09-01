import { describe, it, expect } from "vitest";
import { validateClientId, validateClientSecret } from "./clientCredentials";

const VALID_ID = "1234567890-abcdefghijklmnop.apps.googleusercontent.com";
const VALID_SECRET = "GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz";

describe("validateClientId", () => {
  it("accepts a real client ID", () => {
    expect(validateClientId(VALID_ID)).toBeNull();
  });

  it("accepts a client ID with surrounding whitespace", () => {
    expect(validateClientId(`  ${VALID_ID}\n`)).toBeNull();
  });

  it("names the mistake when the client secret was pasted instead", () => {
    // The exact swap that produced "Error 401: invalid_client" on Google's page
    const message = validateClientId(VALID_SECRET);
    expect(message).toContain("Client Secret");
    expect(message).toContain(".apps.googleusercontent.com");
  });

  it("rejects a value that is not a client ID at all", () => {
    expect(validateClientId("not-a-client-id")).toContain(
      ".apps.googleusercontent.com",
    );
  });

  it("rejects an empty value", () => {
    expect(validateClientId("   ")).toContain("Client ID");
  });
});

describe("validateClientSecret", () => {
  it("accepts a modern GOCSPX- secret", () => {
    expect(validateClientSecret(VALID_SECRET)).toBeNull();
  });

  it("accepts a legacy secret without the GOCSPX- prefix", () => {
    expect(validateClientSecret("aBcDeF1234567890gHiJkLmN")).toBeNull();
  });

  it("names the mistake when the client ID was pasted instead", () => {
    const message = validateClientSecret(VALID_ID);
    expect(message).toContain("Client ID");
    expect(message).toContain("GOCSPX-");
  });

  it("rejects an empty value", () => {
    expect(validateClientSecret("")).toContain("Client Secret");
  });
});
