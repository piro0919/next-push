import type { PushSubscriptionJSON } from "../core/types";

/**
 * Hosts of the browser push services: Chrome and other Chromium browsers (FCM),
 * Firefox (Mozilla), Safari (Apple) and Edge (WNS).
 *
 * The subscribe endpoint accepts whatever the client POSTs, so without this
 * list anyone can register an arbitrary host and make the sender POST to it.
 * Chromium 153 started returning `jmt17.google.com` endpoints instead of
 * `fcm.googleapis.com` (2026-10-14).
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^jmt\d+\.google\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^(?:[a-z0-9-]+\.)*push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

/** Push service endpoints fit in a few hundred characters. */
const MAX_ENDPOINT_LENGTH = 1000;

/** Keys are base64url. p256dh is 65 bytes (87 chars), auth is 16 bytes (22 chars). */
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const P256DH_LENGTH = 87;
const AUTH_LENGTH = 22;

/**
 * Whether `endpoint` points at a known browser push service over https,
 * with no port and no userinfo.
 *
 * `extraHosts` are tested against the hostname in addition to the built-in
 * list. Anchor them (`/^push\.example\.com$/`), or a lookalike host matches.
 */
export function isPushServiceEndpoint(
  endpoint: string,
  extraHosts: readonly RegExp[] = [],
): boolean {
  if (endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    // `search` ignores `lastIndex`, so a `g` or `y` flag on a user pattern
    // cannot make the same host pass on one call and fail on the next.
    (PUSH_HOSTS.some((host) => host.test(url.hostname)) ||
      extraHosts.some((host) => url.hostname.search(host) !== -1))
  );
}

const isKey = (value: unknown, length: number): boolean =>
  typeof value === "string" && B64URL.test(value) && value.replace(/=+$/, "").length === length;

/**
 * Whether `value` is a subscription a browser could have produced: a push
 * service endpoint (see {@link isPushServiceEndpoint}) and base64url keys of
 * the exact lengths.
 */
export function isValidSubscription(
  value: unknown,
  extraHosts: readonly RegExp[] = [],
): value is PushSubscriptionJSON {
  if (typeof value !== "object" || value === null) return false;
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== "string" || !isPushServiceEndpoint(endpoint, extraHosts)) return false;
  if (typeof keys !== "object" || keys === null) return false;
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  return isKey(p256dh, P256DH_LENGTH) && isKey(auth, AUTH_LENGTH);
}
