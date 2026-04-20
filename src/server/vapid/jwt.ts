import { base64UrlDecode, base64UrlEncode } from "../../core/base64";

export interface SignVAPIDJWTOptions {
  /** base64url-encoded JWK JSON (from generateVAPIDKeys) */
  privateKey: string;
  audience: string;
  subject: string;
  /** seconds; default 12 hours; max 24 hours per RFC 8292 */
  expiresIn?: number;
}

export async function signVAPIDJWT(opts: SignVAPIDJWTOptions): Promise<string> {
  const expiresIn = Math.min(opts.expiresIn ?? 12 * 60 * 60, 24 * 60 * 60);

  const header = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: opts.audience,
    sub: opts.subject,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importECPrivateKey(opts.privateKey);
  const sigBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    enc.encode(signingInput),
  );
  const sig = base64UrlEncode(new Uint8Array(sigBuffer));
  return `${signingInput}.${sig}`;
}

async function importECPrivateKey(base64UrlPriv: string): Promise<CryptoKey> {
  const privJson = new TextDecoder().decode(base64UrlDecode(base64UrlPriv));
  const jwk = JSON.parse(privJson) as JsonWebKey;
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d || !jwk.x || !jwk.y) {
    throw new Error("Invalid VAPID private key (expected P-256 JWK with d, x, y)");
  }
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
}
