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

export interface SendOptions {
  ttl?: number;
  urgency?: Urgency;
  topic?: string;
}

export type SendResult =
  | { ok: true; statusCode: number }
  | { ok: false; gone: true; statusCode: 404 | 410 }
  | { ok: false; gone: false; statusCode?: number; error: Error };

export interface VAPIDKeys {
  publicKey: string;
  privateKey: string;
}
