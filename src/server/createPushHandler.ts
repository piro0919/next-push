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
      try {
        const body = (await req.json()) as Partial<PushSubscriptionJSON>;
        if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
          return new Response("Invalid subscription", { status: 400 });
        }
        await config.onSubscribe(body as PushSubscriptionJSON, req);
        return new Response(null, { status: 201 });
      } catch (e) {
        return new Response(e instanceof Error ? e.message : "Error", {
          status: 500,
        });
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
        await config.onUnsubscribe(endpoint, req);
        return new Response(null, { status: 204 });
      } catch (e) {
        return new Response(e instanceof Error ? e.message : "Error", {
          status: 500,
        });
      }
    },
  };
}
