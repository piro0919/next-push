import { describe, expect, it } from "vitest";
import { signVAPIDJWT } from "./jwt";
import { generateVAPIDKeys } from "./keys";

function b64urlDecodeToString(s: string): string {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

describe("signVAPIDJWT", () => {
  it("produces 3-part JWT", async () => {
    const { privateKey } = await generateVAPIDKeys();
    const jwt = await signVAPIDJWT({
      privateKey,
      audience: "https://fcm.googleapis.com",
      subject: "mailto:test@example.com",
      expiresIn: 3600,
    });
    expect(jwt.split(".").length).toBe(3);
  });

  it("header is { alg: 'ES256', typ: 'JWT' }", async () => {
    const { privateKey } = await generateVAPIDKeys();
    const jwt = await signVAPIDJWT({
      privateKey,
      audience: "https://fcm.googleapis.com",
      subject: "mailto:test@example.com",
    });
    const header = JSON.parse(b64urlDecodeToString(jwt.split(".")[0]));
    expect(header).toEqual({ alg: "ES256", typ: "JWT" });
  });

  it("payload contains aud, sub, exp", async () => {
    const { privateKey } = await generateVAPIDKeys();
    const now = Math.floor(Date.now() / 1000);
    const jwt = await signVAPIDJWT({
      privateKey,
      audience: "https://example.com",
      subject: "mailto:a@b.c",
      expiresIn: 1000,
    });
    const payload = JSON.parse(b64urlDecodeToString(jwt.split(".")[1]));
    expect(payload.aud).toBe("https://example.com");
    expect(payload.sub).toBe("mailto:a@b.c");
    expect(payload.exp).toBeGreaterThanOrEqual(now + 999);
    expect(payload.exp).toBeLessThanOrEqual(now + 1001);
  });

  it("signature is 64 bytes → 86 base64url chars", async () => {
    const { privateKey } = await generateVAPIDKeys();
    const jwt = await signVAPIDJWT({
      privateKey,
      audience: "https://example.com",
      subject: "mailto:a@b.c",
    });
    expect(jwt.split(".")[2].length).toBe(86);
  });
});
