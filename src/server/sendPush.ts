import type {
  PushPayload,
  PushSubscriptionJSON,
  SendOptions,
  SendResult,
  VAPIDKeys,
} from "../core/types";
import { encryptPayload } from "./vapid/encrypt";
import { signVAPIDJWT } from "./vapid/jwt";

export interface SendPushConfig {
  /** Override VAPID keys (defaults to env vars) */
  vapidKeys?: VAPIDKeys;
  /** VAPID subject — mailto: or URL (defaults to VAPID_SUBJECT env) */
  subject?: string;
}

export async function sendPush<T extends PushPayload = PushPayload>(
  subscription: PushSubscriptionJSON,
  payload: T,
  config: SendOptions & SendPushConfig = {},
): Promise<SendResult> {
  const publicKey = config.vapidKeys?.publicKey ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = config.vapidKeys?.privateKey ?? process.env.VAPID_PRIVATE_KEY;
  const subject = config.subject ?? process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return {
      ok: false,
      gone: false,
      error: new Error(
        "VAPID keys missing. Provide vapidKeys+subject or set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT",
      ),
    };
  }

  try {
    const audience = new URL(subscription.endpoint).origin;
    const jwt = await signVAPIDJWT({ privateKey, audience, subject });

    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    const { ciphertext } = await encryptPayload({
      payload: encoded,
      subscriberPublicKey: subscription.keys.p256dh,
      subscriberAuth: subscription.keys.auth,
    });

    const ttl = config.ttl ?? 60;
    const headers: Record<string, string> = {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "Content-Length": String(ciphertext.length),
      TTL: String(ttl),
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
    };
    if (config.urgency) headers["Urgency"] = config.urgency;
    if (config.topic) headers["Topic"] = config.topic;

    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers,
      body: ciphertext,
    });

    if (res.status >= 200 && res.status < 300) {
      return { ok: true, statusCode: res.status };
    }
    if (res.status === 404 || res.status === 410) {
      return { ok: false, gone: true, statusCode: res.status };
    }
    return {
      ok: false,
      gone: false,
      statusCode: res.status,
      error: new Error(`Push service returned ${res.status}: ${await res.text().catch(() => "")}`),
    };
  } catch (e) {
    return {
      ok: false,
      gone: false,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}
