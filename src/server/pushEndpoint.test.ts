import { describe, expect, it } from "vitest";
import { isPushServiceEndpoint, isValidSubscription } from "./pushEndpoint";

/** p256dh is 65 bytes → 87 base64url chars; auth is 16 bytes → 22 chars. */
const P256DH_LENGTH = 87;
const AUTH_LENGTH = 22;
const MAX_ENDPOINT_LENGTH = 1000;

const P256DH = `B${"A".repeat(P256DH_LENGTH - 1)}`;
const AUTH = "A".repeat(AUTH_LENGTH);

describe("isPushServiceEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com/wp/abc",
    "https://android.googleapis.com/gcm/send/abc",
    "https://jmt17.google.com/fcm/send/abc",
    "https://jmt1.google.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/abc",
    "https://api.push.apple.com/abc",
    "https://push.apple.com/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("accepts %s", (endpoint) => {
    expect(isPushServiceEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ["an unknown host", "https://evil.example.com/fcm/send/abc"],
    ["a lookalike suffix", "https://fcm.googleapis.com.evil.example/abc"],
    ["a lookalike prefix", "https://evilfcm.googleapis.com/abc"],
    ["jmt without a number", "https://jmt.google.com/abc"],
    ["a bare notify.windows.com", "https://notify.windows.com/abc"],
    ["a lookalike of push.apple.com", "https://evilpush.apple.com/abc"],
    ["http", "http://fcm.googleapis.com/fcm/send/abc"],
    ["a port", "https://fcm.googleapis.com:8443/fcm/send/abc"],
    ["a username", "https://user@fcm.googleapis.com/fcm/send/abc"],
    ["a username and password", "https://user:pass@fcm.googleapis.com/fcm/send/abc"],
    [
      "a URL over 1000 characters",
      `https://fcm.googleapis.com/fcm/send/${"a".repeat(MAX_ENDPOINT_LENGTH)}`,
    ],
    ["a non-URL string", "not a url"],
    ["an empty string", ""],
  ])("rejects %s", (_, endpoint) => {
    expect(isPushServiceEndpoint(endpoint)).toBe(false);
  });

  it("accepts a host matched by extraHosts", () => {
    const endpoint = "https://push.example.com/send/abc";
    expect(isPushServiceEndpoint(endpoint)).toBe(false);
    expect(isPushServiceEndpoint(endpoint, [/^push\.example\.com$/])).toBe(true);
  });

  it("still rejects http, ports and userinfo on an extraHosts host", () => {
    const extra = [/^push\.example\.com$/];
    expect(isPushServiceEndpoint("http://push.example.com/abc", extra)).toBe(false);
    expect(isPushServiceEndpoint("https://push.example.com:8443/abc", extra)).toBe(false);
    expect(isPushServiceEndpoint("https://u:p@push.example.com/abc", extra)).toBe(false);
  });

  it("accepts an endpoint of exactly 1000 characters", () => {
    const prefix = "https://fcm.googleapis.com/fcm/send/";
    const endpoint = prefix + "a".repeat(MAX_ENDPOINT_LENGTH - prefix.length);
    expect(endpoint.length).toBe(MAX_ENDPOINT_LENGTH);
    expect(isPushServiceEndpoint(endpoint)).toBe(true);
  });
});

describe("isValidSubscription", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    expirationTime: null,
    keys: { p256dh: P256DH, auth: AUTH },
  };

  it("accepts a well-formed subscription", () => {
    expect(isValidSubscription(valid)).toBe(true);
  });

  it("passes extraHosts on to the endpoint check", () => {
    const sub = { ...valid, endpoint: "https://push.example.com/send/abc" };
    expect(isValidSubscription(sub)).toBe(false);
    expect(isValidSubscription(sub, [/^push\.example\.com$/])).toBe(true);
  });

  it("accepts keys with base64 padding", () => {
    expect(
      isValidSubscription({ ...valid, keys: { p256dh: `${P256DH}=`, auth: `${AUTH}==` } }),
    ).toBe(true);
  });

  it.each([
    ["null", null],
    ["a string", "https://fcm.googleapis.com/fcm/send/abc"],
    ["a missing endpoint", { keys: valid.keys }],
    ["a non-string endpoint", { ...valid, endpoint: 1 }],
    ["an endpoint on an unknown host", { ...valid, endpoint: "https://evil.example.com/abc" }],
    ["missing keys", { endpoint: valid.endpoint }],
    ["null keys", { ...valid, keys: null }],
    ["a missing p256dh", { ...valid, keys: { auth: AUTH } }],
    ["a missing auth", { ...valid, keys: { p256dh: P256DH } }],
    ["a short p256dh", { ...valid, keys: { p256dh: P256DH.slice(1), auth: AUTH } }],
    ["a long p256dh", { ...valid, keys: { p256dh: `${P256DH}A`, auth: AUTH } }],
    ["a short auth", { ...valid, keys: { p256dh: P256DH, auth: AUTH.slice(1) } }],
    ["a long auth", { ...valid, keys: { p256dh: P256DH, auth: `${AUTH}A` } }],
    ["a standard-base64 key", { ...valid, keys: { p256dh: `+${P256DH.slice(1)}`, auth: AUTH } }],
    ["a non-string key", { ...valid, keys: { p256dh: P256DH, auth: 1 } }],
  ])("rejects %s", (_, value) => {
    expect(isValidSubscription(value)).toBe(false);
  });
});
