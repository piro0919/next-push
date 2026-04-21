export interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, unknown>;
  tag?: string;
  url?: string;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export type Urgency = "very-low" | "low" | "normal" | "high";

/**
 * Observability callbacks fired once per sendPush invocation based on the
 * outcome. Exactly one of onSuccess / onGone / onFailure fires per call.
 * Thrown errors and rejected promises from hooks are swallowed with a
 * console.warn so observability code never breaks the push flow.
 */
export interface SendHooks {
  /** Fires on 2xx — the push service accepted the notification. */
  onSuccess?: (subscription: PushSubscriptionJSON, statusCode: number) => void | Promise<void>;
  /** Fires on 404/410 — subscription is dead and should be deleted. */
  onGone?: (subscription: PushSubscriptionJSON, statusCode: 404 | 410) => void | Promise<void>;
  /** Fires on any other failure (validation, network, 4xx/5xx). */
  onFailure?: (
    subscription: PushSubscriptionJSON,
    error: Error,
    meta: { statusCode?: number; retryable?: boolean; retryAfter?: number },
  ) => void | Promise<void>;
}

export interface SendOptions extends SendHooks {
  ttl?: number;
  urgency?: Urgency;
  topic?: string;
}

export type SendResult =
  | { ok: true; statusCode: number }
  | { ok: false; gone: true; statusCode: 404 | 410 }
  | {
      ok: false;
      gone: false;
      statusCode?: number;
      error: Error;
      /** Retry-After header value in seconds (only for 429 responses with the header). */
      retryAfter?: number;
      /** Whether the failure is likely transient. True for 429 and 5xx and network errors. */
      retryable?: boolean;
    };

export interface VAPIDKeys {
  publicKey: string;
  privateKey: string;
}
