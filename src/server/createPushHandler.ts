import type { PushSubscriptionJSON } from "../core/types";

export interface CreatePushHandlerConfig {
  onSubscribe: (subscription: PushSubscriptionJSON, req: Request) => Promise<void> | void;
  onUnsubscribe: (endpoint: string, req: Request) => Promise<void> | void;
}

export interface PushHandler {
  POST(req: Request): Promise<Response>;
  DELETE(req: Request): Promise<Response>;
}

export function createPushHandler(config: CreatePushHandlerConfig): PushHandler {
  return {
    async POST(req) {
      // Check Content-Length header first (fast path, present in real HTTP requests).
      // Also read raw body text to enforce the limit when the header is absent (e.g. in tests).
      const contentLengthHeader = Number(req.headers.get("content-length") ?? "-1");
      if (contentLengthHeader > 8192) {
        return new Response("Payload too large", { status: 413 });
      }
      try {
        const rawText = await req.text();
        if (rawText.length > 8192) {
          return new Response("Payload too large", { status: 413 });
        }
        const body = JSON.parse(rawText) as Partial<PushSubscriptionJSON>;
        if (
          !body.endpoint ||
          typeof body.endpoint !== "string" ||
          !body.endpoint.startsWith("https://") ||
          !body.keys?.p256dh ||
          !body.keys?.auth
        ) {
          return new Response("Invalid subscription", { status: 400 });
        }
        await config.onSubscribe(body as PushSubscriptionJSON, req);
        return new Response(null, { status: 201 });
      } catch (e) {
        console.error("[next-push] POST /api/push error:", e);
        return new Response("Internal error", { status: 500 });
      }
    },
    async DELETE(req) {
      try {
        let endpoint = new URL(req.url).searchParams.get("endpoint");
        if (!endpoint && req.headers.get("content-type")?.includes("application/json")) {
          const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
          endpoint = body?.endpoint ?? null;
        }
        if (!endpoint) {
          return new Response("Missing endpoint", { status: 400 });
        }
        if (!endpoint.startsWith("https://")) {
          return new Response("Invalid endpoint", { status: 400 });
        }
        await config.onUnsubscribe(endpoint, req);
        return new Response(null, { status: 204 });
      } catch (e) {
        console.error("[next-push] DELETE /api/push error:", e);
        return new Response("Internal error", { status: 500 });
      }
    },
  };
}
