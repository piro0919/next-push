import type { PushSubscriptionJSON } from "../core/types";

export interface SubscribeContext {
  /** The user this subscription belongs to, as resolved on the server by
   *  `getUserId`. It never comes from the request body: a client-supplied
   *  `userId` is only compared against this value. Undefined when no
   *  `getUserId` is configured or it returned null (anonymous). */
  userId?: string;
}

export type UnsubscribeContext = SubscribeContext;

export type UserIdResolver = (
  req: Request,
) => string | null | undefined | Promise<string | null | undefined>;

export interface CreatePushHandlerConfig {
  onSubscribe: (
    subscription: PushSubscriptionJSON,
    req: Request,
    ctx?: SubscribeContext,
  ) => Promise<void> | void;
  onUnsubscribe: (endpoint: string, req: Request, ctx?: UnsubscribeContext) => Promise<void> | void;
  /**
   * Resolves the current user from the request on the server — typically by
   * reading your session cookie or auth header. Return null/undefined for an
   * anonymous visitor.
   *
   * This is the only source of `ctx.userId`. A `userId` sent by the client is
   * never trusted: if it is present and does not match the value returned
   * here, the request is rejected with 403. Without `getUserId`, any request
   * whose body carries a `userId` is rejected with 403, because the handler
   * has no way to verify it.
   */
  getUserId?: UserIdResolver;
}

export interface PushHandler {
  POST(req: Request): Promise<Response>;
  DELETE(req: Request): Promise<Response>;
}

const MAX_BODY = 8192;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function resolveUserId(
  getUserId: UserIdResolver | undefined,
  req: Request,
): Promise<string | undefined> {
  if (!getUserId) return undefined;
  const id = await getUserId(req);
  return typeof id === "string" && id ? id : undefined;
}

export function createPushHandler(config: CreatePushHandlerConfig): PushHandler {
  return {
    async POST(req) {
      // Check Content-Length header first (fast path, present in real HTTP requests).
      // Also read raw body text to enforce the limit when the header is absent (e.g. in tests).
      const contentLengthHeader = Number(req.headers.get("content-length") ?? "-1");
      if (contentLengthHeader > MAX_BODY) {
        return new Response("Payload too large", { status: 413 });
      }
      try {
        const rawText = await req.text();
        if (rawText.length > MAX_BODY) {
          return new Response("Payload too large", { status: 413 });
        }
        let body: unknown;
        try {
          body = JSON.parse(rawText);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!isObject(body)) {
          return new Response("Invalid subscription", { status: 400 });
        }
        const keys = body.keys;
        if (
          typeof body.endpoint !== "string" ||
          !body.endpoint.startsWith("https://") ||
          !isObject(keys) ||
          !keys.p256dh ||
          !keys.auth
        ) {
          return new Response("Invalid subscription", { status: 400 });
        }

        const { userId: claimedUserId, ...sub } = body;
        const claimed =
          typeof claimedUserId === "string" && claimedUserId ? claimedUserId : undefined;
        const userId = await resolveUserId(config.getUserId, req);
        if (claimed !== undefined && claimed !== userId) {
          if (!config.getUserId) {
            console.warn(
              "[next-push] Rejected a subscription that carried a client-supplied userId. " +
                "Pass `getUserId` to createPushHandler so the user is resolved on the server.",
            );
          }
          return new Response("Forbidden", { status: 403 });
        }

        await config.onSubscribe(
          sub as unknown as PushSubscriptionJSON,
          req,
          userId ? { userId } : undefined,
        );
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
          const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
          endpoint = isObject(body) && typeof body.endpoint === "string" ? body.endpoint : null;
        }
        if (!endpoint) {
          return new Response("Missing endpoint", { status: 400 });
        }
        if (!endpoint.startsWith("https://")) {
          return new Response("Invalid endpoint", { status: 400 });
        }
        const userId = await resolveUserId(config.getUserId, req);
        await config.onUnsubscribe(endpoint, req, userId ? { userId } : undefined);
        return new Response(null, { status: 204 });
      } catch (e) {
        console.error("[next-push] DELETE /api/push error:", e);
        return new Response("Internal error", { status: 500 });
      }
    },
  };
}
