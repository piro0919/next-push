export const ROUTE_TS = `import { createPushHandler } from "@piro0919/next-push/server";
import { cookies } from "next/headers";

// Demo-quality storage: stash the caller's subscription in an HTTP-only
// cookie. Works out of the box on Vercel (no DB required) and lets you
// send pushes back to the same browser that subscribed — great for
// integration testing.
//
// For a real app — where you send to other users, broadcast, or trigger
// pushes from a cron/job — replace these callbacks with a DB write keyed
// by user ID. See the persistence recipes:
//   https://github.com/piro0919/next-push/tree/main/docs/recipes
//
// WHY NOT JUST new Map()? An in-memory Map lives inside one Vercel Function
// instance. Subscribing on instance A and sending on instance B returns
// "subscription not found" — subtle but real. Cookies ride with the client
// so it always works regardless of instance.
const SUBSCRIPTION_COOKIE = "next-push-sub";

export const { POST, DELETE } = createPushHandler({
  onSubscribe: async (sub) => {
    const jar = await cookies();
    jar.set(SUBSCRIPTION_COOKIE, JSON.stringify(sub), {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 180,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  },
  onUnsubscribe: async () => {
    const jar = await cookies();
    jar.delete(SUBSCRIPTION_COOKIE);
  },
});
`;

export const PAGE_TSX = `"use client";
import { usePush } from "@piro0919/next-push";

export default function PushDemoPage() {
  const { isSupported, permission, subscription, subscribe, unsubscribe, error } = usePush();

  if (!isSupported) return <p>This browser does not support Web Push.</p>;
  if (permission === "denied") return <p>Notifications are blocked.</p>;

  return (
    <main style={{ padding: 24 }}>
      <h1>Push Demo</h1>
      <p>Permission: {permission}</p>
      <p>Subscribed: {subscription ? "yes" : "no"}</p>
      {subscription ? (
        <button onClick={unsubscribe}>Unsubscribe</button>
      ) : (
        <button onClick={subscribe}>Subscribe</button>
      )}
      {error && <p style={{ color: "red" }}>{error.message}</p>}
    </main>
  );
}
`;

export const SEND_EXAMPLE_TS = `import { sendPush } from "@piro0919/next-push/server";

// Example: send a notification to a stored subscription.
//
// The scaffolded route.ts stores the subscription in an HTTP-only cookie, so
// for sends that happen inside a request handler for the same user, you can
// read the cookie via \`cookies().get("next-push-sub")\`.
//
// For sends that happen OUTSIDE a request (cron jobs, admin broadcast, user
// A notifying user B), you need a real database. Replace \`getStoredSubscription\`
// with your DB fetch — see the persistence recipes for Upstash Redis / Neon
// Postgres at https://github.com/piro0919/next-push/tree/main/docs/recipes
export async function sendExample() {
  const subscription = await getStoredSubscription();
  if (!subscription) return;

  const result = await sendPush(subscription, {
    title: "Hello from next-push",
    body: "This is a test notification.",
    url: "/",
  });

  if (!result.ok && result.gone) {
    // Delete from DB
  }
}

async function getStoredSubscription(): Promise<null | {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}> {
  return null; // stub
}
`;
