import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createPushHandler } from "./createPushHandler";

/** Base64url keys of the lengths a browser produces (16 and 65 bytes). */
const AUTH_LENGTH = 22;
const P256DH_LENGTH = 87;

const validSubscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { auth: "A".repeat(AUTH_LENGTH), p256dh: `B${"A".repeat(P256DH_LENGTH - 1)}` },
};

describe("createPushHandler framework-agnostic adapters", () => {
  it("mounts into a Hono app and handles POST/DELETE", async () => {
    const onSubscribe = vi.fn();
    const onUnsubscribe = vi.fn();
    const { DELETE, POST } = createPushHandler({ onSubscribe, onUnsubscribe });

    const app = new Hono();
    app.post("/api/push", (c) => POST(c.req.raw));
    app.delete("/api/push", (c) => DELETE(c.req.raw));

    const postRes = await app.request("/api/push", {
      body: JSON.stringify(validSubscription),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(postRes.status).toBe(201);
    expect(onSubscribe).toHaveBeenCalledOnce();
    expect(onSubscribe.mock.calls[0]?.[0]).toEqual(validSubscription);

    const deleteRes = await app.request(
      `/api/push?endpoint=${encodeURIComponent(validSubscription.endpoint)}`,
      { method: "DELETE" },
    );
    expect(deleteRes.status).toBe(204);
    expect(onUnsubscribe).toHaveBeenCalledWith(
      validSubscription.endpoint,
      expect.any(Request),
      undefined,
    );
  });

  it("works as a plain Fetch handler (Cloudflare Workers / Deno / Bun style)", async () => {
    const onSubscribe = vi.fn();
    const { POST } = createPushHandler({
      onSubscribe,
      onUnsubscribe: vi.fn(),
    });

    const fetchHandler = async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      if (url.pathname === "/api/push" && req.method === "POST") {
        return POST(req);
      }
      return new Response("Not found", { status: 404 });
    };

    const res = await fetchHandler(
      new Request("http://worker.local/api/push", {
        body: JSON.stringify(validSubscription),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(res.status).toBe(201);
    expect(onSubscribe).toHaveBeenCalledOnce();
  });
});
