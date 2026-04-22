import { cookies } from "next/headers";
import type { PushPayload, PushSubscriptionJSON } from "../../../core/types";
import { createPushHandler, sendPush } from "../../../server";

// The demo only sends push notifications back to the caller themselves, so
// we don't need a server-side database at all. We stash the caller's
// subscription in an HTTP-only cookie on subscribe and read it back on send.
//
// In a real app you would instead store subscriptions in a DB keyed by user
// ID (see docs/recipes/upstash-redis.md or docs/recipes/neon-postgres.md)
// and fetch the target user's subscription by that ID.
const SUBSCRIPTION_COOKIE = "next-push-demo-sub";
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: true,
  path: "/",
  // Match the typical Web Push subscription expiration horizon (~6 months).
  maxAge: 60 * 60 * 24 * 180,
};

export const { POST, DELETE } = createPushHandler({
  onSubscribe: async (sub) => {
    const jar = await cookies();
    jar.set(SUBSCRIPTION_COOKIE, JSON.stringify(sub), COOKIE_OPTIONS);
  },
  onUnsubscribe: async () => {
    const jar = await cookies();
    jar.delete(SUBSCRIPTION_COOKIE);
  },
});

// Demo send endpoint: reads the caller's subscription from the cookie and
// sends to that subscription only. No server-side state is kept.
// Guarded in production to prevent unauthorized use of the demo endpoint.
export async function PUT(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUSH_DEMO_ALLOW_PUT !== "1") {
    return new Response("Forbidden", { status: 403 });
  }
  const jar = await cookies();
  const cookie = jar.get(SUBSCRIPTION_COOKIE);
  if (!cookie) {
    return Response.json({ error: "not subscribed" }, { status: 404 });
  }
  let sub: PushSubscriptionJSON;
  try {
    sub = JSON.parse(cookie.value) as PushSubscriptionJSON;
  } catch {
    return Response.json({ error: "malformed subscription cookie" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<PushPayload>;
  const payload: PushPayload = {
    title: body.title?.trim() || "Demo",
    ...(body.body?.trim() && { body: body.body.trim() }),
    ...(body.icon?.trim() && { icon: body.icon.trim() }),
    ...(body.image?.trim() && { image: body.image.trim() }),
    ...(body.badge?.trim() && { badge: body.badge.trim() }),
    ...(body.tag?.trim() && { tag: body.tag.trim() }),
    ...(body.url?.trim() && { url: body.url.trim() }),
  };
  // urgency: "high" bypasses Android Doze / Adaptive Battery batching so the
  // demo notification arrives immediately instead of seconds later.
  const result = await sendPush(sub, payload, { urgency: "high" });
  // Normalize the SendResult to a JSON-serializable shape (Error objects
  // don't survive JSON.stringify, so we explicitly pick error.message).
  if (result.ok) {
    return Response.json({ ok: true, statusCode: result.statusCode });
  }
  if (result.gone) {
    return Response.json({ ok: false, gone: true, statusCode: result.statusCode });
  }
  return Response.json({
    ok: false,
    gone: false,
    statusCode: result.statusCode,
    message: result.error.message,
    retryable: result.retryable,
    retryAfter: result.retryAfter,
  });
}
