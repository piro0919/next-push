import { describe, expect, it } from "vitest";
import { base64UrlDecode } from "../../core/base64";
import { generateVAPIDKeys } from "./keys";

describe("generateVAPIDKeys", () => {
  it("returns publicKey as 65-byte uncompressed P-256 point", async () => {
    const { publicKey } = await generateVAPIDKeys();
    const pub = base64UrlDecode(publicKey);
    expect(pub.length).toBe(65);
    expect(pub[0]).toBe(0x04); // uncompressed marker
  });

  it("returns privateKey that decodes to a JWK with d, x, y", async () => {
    const { privateKey } = await generateVAPIDKeys();
    const json = new TextDecoder().decode(base64UrlDecode(privateKey));
    const jwk = JSON.parse(json);
    expect(jwk.kty).toBe("EC");
    expect(jwk.crv).toBe("P-256");
    expect(typeof jwk.d).toBe("string");
    expect(typeof jwk.x).toBe("string");
    expect(typeof jwk.y).toBe("string");
  });

  it("generates different keys each call", async () => {
    const a = await generateVAPIDKeys();
    const b = await generateVAPIDKeys();
    expect(a.publicKey).not.toBe(b.publicKey);
  });
});
