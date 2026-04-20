import { base64UrlDecode, base64UrlEncode } from "../../core/base64";
import type { VAPIDKeys } from "../../core/types";

export async function generateVAPIDKeys(): Promise<VAPIDKeys> {
  const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  // Public: 0x04 || x(32) || y(32) → base64url
  const x = base64UrlDecode(publicJwk.x as string);
  const y = base64UrlDecode(publicJwk.y as string);
  const pub = new Uint8Array(65);
  pub[0] = 0x04;
  pub.set(x, 1);
  pub.set(y, 33);

  // Private: JWK JSON (d + x + y) → base64url
  const privJson = JSON.stringify({
    kty: "EC",
    crv: "P-256",
    d: privateJwk.d,
    x: privateJwk.x,
    y: privateJwk.y,
  });

  return {
    publicKey: base64UrlEncode(pub),
    privateKey: base64UrlEncode(new TextEncoder().encode(privJson)),
  };
}
