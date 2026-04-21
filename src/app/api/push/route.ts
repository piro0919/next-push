import type { PushPayload } from "../../../core/types";
import { createPushHandler, sendPush } from "../../../server";
import { add, get, remove } from "../../lib/subscriptions";

export const { POST, DELETE } = createPushHandler({
  onSubscribe: (sub) => add(sub),
  onUnsubscribe: (endpoint) => remove(endpoint),
});

// Demo-only trigger: sends a push to the caller's own subscription only.
// The caller must include their subscription endpoint in the request body;
// we never broadcast to other visitors' subscriptions.
// Guarded in production to prevent unauthorized use of the demo endpoint.
// Set NEXT_PUSH_DEMO_ALLOW_PUT=1 on Vercel to re-enable for the public demo.
export async function PUT(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUSH_DEMO_ALLOW_PUT !== "1") {
    return new Response("Forbidden", { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<PushPayload> & {
    endpoint?: string;
  };
  const endpoint = body.endpoint?.trim();
  if (!endpoint) {
    return Response.json({ error: "endpoint required" }, { status: 400 });
  }
  const sub = get(endpoint);
  if (!sub) {
    return Response.json({ error: "subscription not found" }, { status: 404 });
  }
  const payload: PushPayload = {
    title: body.title?.trim() || "Demo",
    ...(body.body?.trim() && { body: body.body.trim() }),
    ...(body.icon?.trim() && { icon: body.icon.trim() }),
    ...(body.image?.trim() && { image: body.image.trim() }),
    ...(body.badge?.trim() && { badge: body.badge.trim() }),
    ...(body.tag?.trim() && { tag: body.tag.trim() }),
    ...(body.url?.trim() && { url: body.url.trim() }),
  };
  const result = await sendPush(sub, payload);
  return Response.json({ sent: result.ok ? 1 : 0, results: [result] });
}
