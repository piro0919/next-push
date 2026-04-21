import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { base64UrlEncode } from "../core/base64";
import { sendPush } from "./sendPush";
import { generateVAPIDKeys } from "./vapid/keys";

async function makeSubscriber(): Promise<{ p256dh: string; auth: string }> {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const pad = (s: string) =>
    s
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bytes = (s: string) => Uint8Array.from(atob(pad(s)), (c) => c.charCodeAt(0));
  const x = bytes(jwk.x as string);
  const y = bytes(jwk.y as string);
  const raw = new Uint8Array(65);
  raw[0] = 0x04;
  raw.set(x, 1);
  raw.set(y, 33);
  return {
    p256dh: base64UrlEncode(raw),
    auth: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))),
  };
}

describe("sendPush", () => {
  const originalFetch = globalThis.fetch;
  let vapidKeys: Awaited<ReturnType<typeof generateVAPIDKeys>>;
  let subscriberKeys: { p256dh: string; auth: string };

  beforeEach(async () => {
    vapidKeys = await generateVAPIDKeys();
    subscriberKeys = await makeSubscriber();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns ok:true on 201", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    const result = await sendPush(
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: subscriberKeys },
      { title: "hi" },
      { vapidKeys, subject: "mailto:a@b.c" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.statusCode).toBe(201);
  });

  it("returns gone:true on 410", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 410 }));
    const result = await sendPush(
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: subscriberKeys },
      { title: "hi" },
      { vapidKeys, subject: "mailto:a@b.c" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.gone).toBe(true);
  });

  it("returns gone:true on 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const result = await sendPush(
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: subscriberKeys },
      { title: "hi" },
      { vapidKeys, subject: "mailto:a@b.c" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.gone).toBe(true);
  });

  it("returns gone:false + error on 500", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));
    const result = await sendPush(
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: subscriberKeys },
      { title: "hi" },
      { vapidKeys, subject: "mailto:a@b.c" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.gone).toBe(false);
      expect(result.statusCode).toBe(500);
    }
  });

  it("sends correct headers including VAPID Authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    globalThis.fetch = fetchMock;
    await sendPush(
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: subscriberKeys },
      { title: "hi" },
      { vapidKeys, subject: "mailto:a@b.c", ttl: 120, urgency: "high", topic: "chat" },
    );
    const call = fetchMock.mock.calls[0];
    const url = call[0];
    const init = call[1];
    expect(url).toBe("https://fcm.googleapis.com/fcm/send/abc");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(init.headers["Content-Type"]).toBe("application/octet-stream");
    expect(init.headers.TTL).toBe("120");
    expect(init.headers.Urgency).toBe("high");
    expect(init.headers.Topic).toBe("chat");
    expect(init.headers.Authorization).toMatch(/^vapid t=ey.+, k=.+/);
  });

  it("returns error result when fetch throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await sendPush(
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: subscriberKeys },
      { title: "hi" },
      { vapidKeys, subject: "mailto:a@b.c" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.gone).toBe(false);
      expect(result.error.message).toBe("network down");
    }
  });

  describe("subscription shape validation", () => {
    it("returns ok:false, gone:false when endpoint is missing", async () => {
      const result = await sendPush(
        { endpoint: undefined as unknown as string, keys: subscriberKeys },
        { title: "hi" },
        { vapidKeys, subject: "mailto:a@b.c" },
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.gone).toBe(false);
        expect(result.error.message).toMatch(/Invalid subscription/);
      }
    });

    it("returns ok:false, gone:false when endpoint does not start with https://", async () => {
      const result = await sendPush(
        { endpoint: "http://fcm.googleapis.com/fcm/send/abc", keys: subscriberKeys },
        { title: "hi" },
        { vapidKeys, subject: "mailto:a@b.c" },
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.gone).toBe(false);
        expect(result.error.message).toMatch(/Invalid subscription/);
      }
    });

    it("returns ok:false, gone:false when keys.p256dh is missing", async () => {
      const result = await sendPush(
        {
          endpoint: "https://fcm.googleapis.com/fcm/send/abc",
          keys: { p256dh: undefined as unknown as string, auth: subscriberKeys.auth },
        },
        { title: "hi" },
        { vapidKeys, subject: "mailto:a@b.c" },
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.gone).toBe(false);
        expect(result.error.message).toMatch(/Invalid subscription/);
      }
    });
  });

  it("marks 429 as retryable with retryAfter from Retry-After header", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": "42" } }));
    const result = await sendPush(
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: subscriberKeys },
      { title: "hi" },
      { vapidKeys, subject: "mailto:a@b.c" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok && !result.gone) {
      expect(result.statusCode).toBe(429);
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBe(42);
    }
  });

  it("marks 5xx as retryable with no retryAfter", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("boom", { status: 503 }));
    const result = await sendPush(
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: subscriberKeys },
      { title: "hi" },
      { vapidKeys, subject: "mailto:a@b.c" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok && !result.gone) {
      expect(result.statusCode).toBe(503);
      expect(result.retryable).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    }
  });

  it("marks 4xx (non-gone) as not retryable", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    const result = await sendPush(
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: subscriberKeys },
      { title: "hi" },
      { vapidKeys, subject: "mailto:a@b.c" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok && !result.gone) {
      expect(result.statusCode).toBe(400);
      expect(result.retryable).toBe(false);
    }
  });

  it("marks network errors as retryable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    const result = await sendPush(
      { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: subscriberKeys },
      { title: "hi" },
      { vapidKeys, subject: "mailto:a@b.c" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok && !result.gone) {
      expect(result.retryable).toBe(true);
    }
  });

  it("returns error result when VAPID keys are missing", async () => {
    const prevPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const prevPriv = process.env.VAPID_PRIVATE_KEY;
    const prevSub = process.env.VAPID_SUBJECT;
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    try {
      const result = await sendPush(
        { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: subscriberKeys },
        { title: "hi" },
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.gone).toBe(false);
        expect(result.error.message).toMatch(/VAPID keys missing/);
      }
    } finally {
      if (prevPub) process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = prevPub;
      if (prevPriv) process.env.VAPID_PRIVATE_KEY = prevPriv;
      if (prevSub) process.env.VAPID_SUBJECT = prevSub;
    }
  });

  describe("observability hooks", () => {
    const sub = () => ({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: subscriberKeys,
    });

    it("fires onSuccess with subscription and statusCode on 2xx", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
      const onSuccess = vi.fn();
      const onGone = vi.fn();
      const onFailure = vi.fn();
      const s = sub();
      await sendPush(
        s,
        { title: "hi" },
        { vapidKeys, subject: "mailto:a@b.c", onSuccess, onGone, onFailure },
      );
      expect(onSuccess).toHaveBeenCalledWith(s, 201);
      expect(onGone).not.toHaveBeenCalled();
      expect(onFailure).not.toHaveBeenCalled();
    });

    it("fires onGone on 404/410 with the status code", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 410 }));
      const onGone = vi.fn();
      const onSuccess = vi.fn();
      const onFailure = vi.fn();
      const s = sub();
      await sendPush(
        s,
        { title: "hi" },
        { vapidKeys, subject: "mailto:a@b.c", onSuccess, onGone, onFailure },
      );
      expect(onGone).toHaveBeenCalledWith(s, 410);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onFailure).not.toHaveBeenCalled();
    });

    it("fires onFailure on 5xx with error, retryable=true, statusCode", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response("oops", { status: 503 }));
      const onFailure = vi.fn();
      const s = sub();
      await sendPush(s, { title: "hi" }, { vapidKeys, subject: "mailto:a@b.c", onFailure });
      expect(onFailure).toHaveBeenCalledTimes(1);
      const [subArg, errArg, metaArg] = onFailure.mock.calls[0];
      expect(subArg).toBe(s);
      expect(errArg).toBeInstanceOf(Error);
      expect(metaArg).toMatchObject({ retryable: true, statusCode: 503 });
    });

    it("fires onFailure with retryAfter when Retry-After header is present on 429", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": "30" } }));
      const onFailure = vi.fn();
      await sendPush(sub(), { title: "hi" }, { vapidKeys, subject: "mailto:a@b.c", onFailure });
      const [, , meta] = onFailure.mock.calls[0];
      expect(meta).toMatchObject({ retryable: true, retryAfter: 30, statusCode: 429 });
    });

    it("fires onFailure when fetch throws (network error)", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
      const onFailure = vi.fn();
      await sendPush(sub(), { title: "hi" }, { vapidKeys, subject: "mailto:a@b.c", onFailure });
      expect(onFailure).toHaveBeenCalledTimes(1);
      const [, err, meta] = onFailure.mock.calls[0];
      expect(err.message).toMatch(/ECONNRESET/);
      expect(meta.retryable).toBe(true);
    });

    it("swallows thrown hook errors without affecting the returned SendResult", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const onSuccess = vi.fn(() => {
        throw new Error("boom");
      });
      const result = await sendPush(
        sub(),
        { title: "hi" },
        { vapidKeys, subject: "mailto:a@b.c", onSuccess },
      );
      expect(result.ok).toBe(true);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("swallows rejected async hook without blocking return", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const onSuccess = vi.fn(async () => {
        throw new Error("async boom");
      });
      const result = await sendPush(
        sub(),
        { title: "hi" },
        { vapidKeys, subject: "mailto:a@b.c", onSuccess },
      );
      expect(result.ok).toBe(true);
      // allow the microtask queue to drain so the rejection is caught
      await new Promise((r) => setTimeout(r, 0));
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
