import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { base64UrlEncode } from "../core/base64";
import { sendPushBatch } from "./sendPushBatch";
import { generateVAPIDKeys } from "./vapid/keys";

async function makeSubscriber(endpoint: string) {
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
    endpoint,
    keys: {
      p256dh: base64UrlEncode(raw),
      auth: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))),
    },
  };
}

describe("sendPushBatch", () => {
  const originalFetch = globalThis.fetch;
  let vapidKeys: Awaited<ReturnType<typeof generateVAPIDKeys>>;

  beforeEach(async () => {
    vapidKeys = await generateVAPIDKeys();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns total/sent/gone/failed counts and results array", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    const subs = await Promise.all([
      makeSubscriber("https://fcm.googleapis.com/fcm/send/a"),
      makeSubscriber("https://fcm.googleapis.com/fcm/send/b"),
    ]);
    const result = await sendPushBatch(
      subs,
      { title: "hi" },
      {
        vapidKeys,
        subject: "mailto:a@b.c",
      },
    );
    expect(result.total).toBe(2);
    expect(result.sent).toBe(2);
    expect(result.gone).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results.length).toBe(2);
    expect(result.goneEndpoints).toEqual([]);
  });

  it("collects gone endpoints for DB cleanup", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 410 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    globalThis.fetch = fetchMock;
    const subs = await Promise.all([
      makeSubscriber("https://fcm.googleapis.com/fcm/send/ok"),
      makeSubscriber("https://fcm.googleapis.com/fcm/send/gone1"),
      makeSubscriber("https://fcm.googleapis.com/fcm/send/gone2"),
    ]);
    const result = await sendPushBatch(
      subs,
      { title: "hi" },
      {
        vapidKeys,
        subject: "mailto:a@b.c",
        concurrency: 1,
      },
    );
    expect(result.total).toBe(3);
    expect(result.sent).toBe(1);
    expect(result.gone).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.goneEndpoints.sort()).toEqual([
      "https://fcm.googleapis.com/fcm/send/gone1",
      "https://fcm.googleapis.com/fcm/send/gone2",
    ]);
  });

  it("continues after individual failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("boom", { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    globalThis.fetch = fetchMock;
    const subs = await Promise.all([
      makeSubscriber("https://fcm.googleapis.com/fcm/send/a"),
      makeSubscriber("https://fcm.googleapis.com/fcm/send/b"),
    ]);
    const result = await sendPushBatch(
      subs,
      { title: "hi" },
      {
        vapidKeys,
        subject: "mailto:a@b.c",
        concurrency: 1,
      },
    );
    expect(result.total).toBe(2);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("invokes onProgress once per subscription", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    const subs = await Promise.all([
      makeSubscriber("https://fcm.googleapis.com/fcm/send/a"),
      makeSubscriber("https://fcm.googleapis.com/fcm/send/b"),
      makeSubscriber("https://fcm.googleapis.com/fcm/send/c"),
    ]);
    const progress = vi.fn();
    await sendPushBatch(
      subs,
      { title: "hi" },
      {
        vapidKeys,
        subject: "mailto:a@b.c",
        onProgress: progress,
      },
    );
    expect(progress).toHaveBeenCalledTimes(3);
    const lastCall = progress.mock.calls[progress.mock.calls.length - 1];
    expect(lastCall).toEqual([3, 3]);
  });

  it("respects concurrency limit", async () => {
    let inflight = 0;
    let peak = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      inflight++;
      if (inflight > peak) peak = inflight;
      await new Promise((r) => setTimeout(r, 10));
      inflight--;
      return new Response(null, { status: 201 });
    });
    const subs = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        makeSubscriber(`https://fcm.googleapis.com/fcm/send/${i}`),
      ),
    );
    await sendPushBatch(
      subs,
      { title: "hi" },
      {
        vapidKeys,
        subject: "mailto:a@b.c",
        concurrency: 3,
      },
    );
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("returns empty result for empty subscriptions array", async () => {
    const result = await sendPushBatch(
      [],
      { title: "hi" },
      {
        vapidKeys,
        subject: "mailto:a@b.c",
      },
    );
    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
    expect(result.goneEndpoints).toEqual([]);
  });
});
