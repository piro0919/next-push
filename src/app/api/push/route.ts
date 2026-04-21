import { createPushHandler, sendPush } from "../../../server";
import { add, all, remove } from "../../lib/subscriptions";

export const { POST, DELETE } = createPushHandler({
  onSubscribe: (sub) => add(sub),
  onUnsubscribe: (endpoint) => remove(endpoint),
});

// Dev-only endpoint to trigger a push to all stored subscriptions.
// Guarded in production to prevent unauthorized mass-push by visitors.
// Set NEXT_PUSH_DEMO_ALLOW_PUT=1 on Vercel to re-enable for the public demo.
export async function PUT(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUSH_DEMO_ALLOW_PUT !== "1") {
    return new Response("Forbidden", { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
  };
  const payload = {
    title: body.title ?? "Demo",
    body: body.body ?? "Hello from next-push",
  };
  const results = await Promise.all(all().map((s) => sendPush(s, payload)));
  return Response.json({ sent: results.length, results });
}
