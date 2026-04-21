export const ROUTE_TS = `import { createPushHandler } from "@piro0919/next-push/server";

// TODO: replace with your DB of choice (Prisma, Drizzle, Redis, etc.)
const subs = new Map<string, { endpoint: string; keys: { p256dh: string; auth: string } }>();

export const { POST, DELETE } = createPushHandler({
  onSubscribe: async (sub) => {
    subs.set(sub.endpoint, sub);
  },
  onUnsubscribe: async (endpoint) => {
    subs.delete(endpoint);
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
// Replace \`getStoredSubscription\` with your actual DB fetch.
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
