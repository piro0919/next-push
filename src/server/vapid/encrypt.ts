import { base64UrlDecode, base64UrlEncode } from "../../core/base64";

export interface EncryptInput {
  payload: Uint8Array;
  /** Subscriber public key (p256dh), 65 bytes uncompressed, base64url */
  subscriberPublicKey: string;
  /** Subscriber auth secret, 16 bytes, base64url */
  subscriberAuth: string;
}

export interface EncryptOutput {
  /** Full aes128gcm-encoded body (header + ciphertext) */
  ciphertext: Uint8Array;
  /** 16-byte random salt (also embedded in ciphertext[0..16]) */
  salt: Uint8Array;
  /** Ephemeral server public key, 65 bytes uncompressed (also embedded) */
  serverPublicKey: Uint8Array;
}

export async function encryptPayload(input: EncryptInput): Promise<EncryptOutput> {
  const subPub = base64UrlDecode(input.subscriberPublicKey);
  const auth = base64UrlDecode(input.subscriberAuth);
  if (subPub.length !== 65 || subPub[0] !== 0x04) {
    throw new Error("Invalid subscriber public key (expected 65-byte uncompressed P-256)");
  }
  if (auth.length !== 16) {
    throw new Error("Subscriber auth must be 16 bytes");
  }

  // 1. Ephemeral server ECDH keypair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPubJwk = await crypto.subtle.exportKey("jwk", serverKeyPair.publicKey);
  const serverPub = jwkToRawPublic(serverPubJwk);

  // 2. Import subscriber public key (raw → ECDH key)
  const subPubKey = await importRawPublicKey(subPub);

  // 3. ECDH → shared secret (32 bytes)
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subPubKey },
      serverKeyPair.privateKey,
      256,
    ),
  );

  // 4. PRK_key = HKDF(salt=auth, ikm=ecdh, info="WebPush: info\0" || ua_pub || as_pub, 32)
  const keyInfo = concat(new TextEncoder().encode("WebPush: info\0"), subPub, serverPub);
  const prkKey = await hkdfOne(auth, ecdhSecret, keyInfo, 32);

  // 5. Random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 6. CEK = HKDF(salt, prk=PRK_key, info="Content-Encoding: aes128gcm\0", 16)
  const cek = await hkdfOne(
    salt,
    prkKey,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  // 7. NONCE = HKDF(salt, prk=PRK_key, info="Content-Encoding: nonce\0", 12)
  const nonce = await hkdfOne(
    salt,
    prkKey,
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    12,
  );

  // 8. Plaintext + padding delimiter (0x02), no extra padding for v0.1
  const padded = new Uint8Array(input.payload.length + 1);
  padded.set(input.payload, 0);
  padded[input.payload.length] = 0x02;

  // 9. AES-128-GCM encrypt
  const cekKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekKey, padded);
  const cipher = new Uint8Array(cipherBuf);

  // 10. Prepend aes128gcm header: salt(16) || rs(4 BE) || idlen(1) || keyid(65)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  header[16] = (rs >>> 24) & 0xff;
  header[17] = (rs >>> 16) & 0xff;
  header[18] = (rs >>> 8) & 0xff;
  header[19] = rs & 0xff;
  header[20] = 65; // idlen
  header.set(serverPub, 21);

  return { ciphertext: concat(header, cipher), salt, serverPublicKey: serverPub };
}

/** HKDF single-block (T(1) only), sufficient when length <= 32 for SHA-256. */
async function hkdfOne(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  if (length > 32) throw new Error("hkdfOne supports length <= 32 (single HMAC-SHA256 block)");
  const saltKey = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));
  const prkKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const t1 = new Uint8Array(
    await crypto.subtle.sign("HMAC", prkKey, concat(info, Uint8Array.of(0x01))),
  );
  return t1.slice(0, length);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function jwkToRawPublic(jwk: JsonWebKey): Uint8Array {
  const x = base64UrlDecode(jwk.x as string);
  const y = base64UrlDecode(jwk.y as string);
  const raw = new Uint8Array(65);
  raw[0] = 0x04;
  raw.set(x, 1);
  raw.set(y, 33);
  return raw;
}

async function importRawPublicKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw[0] !== 0x04) throw new Error("Only uncompressed P-256 points are supported");
  const x = raw.slice(1, 33);
  const y = raw.slice(33, 65);
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: base64UrlEncode(x), y: base64UrlEncode(y), ext: true },
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
}
