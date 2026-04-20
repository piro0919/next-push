import { describe, expect, it } from "vitest";
import { base64UrlEncode } from "../../core/base64";
import { encryptPayload } from "./encrypt";

async function genSubscriberKeys() {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  // base64url → bytes
  const b64url = (s: string) => {
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  };
  const x = b64url(jwk.x as string);
  const y = b64url(jwk.y as string);
  const raw = new Uint8Array(65);
  raw[0] = 0x04;
  raw.set(x, 1);
  raw.set(y, 33);
  return {
    p256dh: base64UrlEncode(raw),
    auth: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))),
  };
}

describe("encryptPayload (aes128gcm)", () => {
  it("produces a ciphertext with the RFC 8291 header structure", async () => {
    const { p256dh, auth } = await genSubscriberKeys();
    const payload = new TextEncoder().encode(JSON.stringify({ title: "Hello" }));
    const result = await encryptPayload({
      payload,
      subscriberPublicKey: p256dh,
      subscriberAuth: auth,
    });
    const body = result.ciphertext;
    // salt (16) + rs (4) + idlen (1) + keyid (65) = 86 bytes header
    expect(body.length).toBeGreaterThan(86);
    // First 16 bytes = salt
    expect(body.slice(0, 16)).toEqual(result.salt);
    // idlen byte at index 20 = 65
    expect(body[20]).toBe(65);
    // keyid starts at index 21 with 0x04 (uncompressed marker)
    expect(body[21]).toBe(0x04);
    // serverPublicKey matches bytes 21..86
    expect(body.slice(21, 86)).toEqual(result.serverPublicKey);
  });

  it("rs field is 4096 in big-endian", async () => {
    const { p256dh, auth } = await genSubscriberKeys();
    const payload = new TextEncoder().encode("test");
    const { ciphertext } = await encryptPayload({
      payload,
      subscriberPublicKey: p256dh,
      subscriberAuth: auth,
    });
    const rs =
      (ciphertext[16] << 24) | (ciphertext[17] << 16) | (ciphertext[18] << 8) | ciphertext[19];
    expect(rs).toBe(4096);
  });

  it("produces different ciphertext each call (random salt + ephemeral key)", async () => {
    const { p256dh, auth } = await genSubscriberKeys();
    const payload = new TextEncoder().encode("test");
    const a = await encryptPayload({ payload, subscriberPublicKey: p256dh, subscriberAuth: auth });
    const b = await encryptPayload({ payload, subscriberPublicKey: p256dh, subscriberAuth: auth });
    // Compare as arrays (Uint8Array equality in vitest is structural)
    expect(Array.from(a.ciphertext)).not.toEqual(Array.from(b.ciphertext));
  });

  it("rejects invalid subscriber public key", async () => {
    await expect(
      encryptPayload({
        payload: new Uint8Array([1, 2, 3]),
        subscriberPublicKey: base64UrlEncode(new Uint8Array(32)), // too short
        subscriberAuth: base64UrlEncode(new Uint8Array(16)),
      }),
    ).rejects.toThrow(/public key/i);
  });

  it("rejects invalid auth length", async () => {
    const { p256dh } = await genSubscriberKeys();
    await expect(
      encryptPayload({
        payload: new Uint8Array([1, 2, 3]),
        subscriberPublicKey: p256dh,
        subscriberAuth: base64UrlEncode(new Uint8Array(8)), // should be 16
      }),
    ).rejects.toThrow(/auth/i);
  });
});
