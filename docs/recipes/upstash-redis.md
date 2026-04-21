# Persistence: Upstash Redis (Vercel Marketplace)

A minimal-ops storage target for push subscriptions. Provisioning is a single
click via the Vercel Marketplace, and Upstash's HTTP REST client works from
Node, Fluid Compute, and Routing Middleware without a persistent connection.

## Provision

In the Vercel dashboard:

1. **Integrations → Marketplace → Upstash Redis → Add Integration**
2. Pick the project, accept the free tier (or any paid plan)
3. Vercel auto-injects `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` into all environments

Pull them down for local dev:

```bash
vercel env pull .env.local
```

## Wire into `createPushHandler`

```ts
// app/api/push/route.ts
import { createPushHandler } from "@piro0919/next-push/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY = "push:subs"; // hash keyed by endpoint

export const { POST, DELETE } = createPushHandler({
  onSubscribe: async (sub) => {
    await redis.hset(KEY, { [sub.endpoint]: JSON.stringify(sub) });
  },
  onUnsubscribe: async (endpoint) => {
    await redis.hdel(KEY, endpoint);
  },
});
```

## Read subscriptions for a broadcast

```ts
import { sendPushBatch } from "@piro0919/next-push/server";
import { Redis } from "@upstash/redis";
import type { PushSubscriptionJSON } from "@piro0919/next-push";

const redis = Redis.fromEnv();

export async function broadcast(payload: { title: string; body?: string }) {
  const raw = await redis.hgetall<Record<string, string>>("push:subs");
  const subs: PushSubscriptionJSON[] = Object.values(raw ?? {}).map((v) =>
    typeof v === "string" ? JSON.parse(v) : v,
  );
  const result = await sendPushBatch(subs, payload, { concurrency: 20 });
  if (result.goneEndpoints.length) {
    await redis.hdel("push:subs", ...result.goneEndpoints);
  }
  return result;
}
```

## Per-user indexing

To push to a single user (or a user's devices), use a Redis set per user:

```ts
// on subscribe
await redis.sadd(`push:by-user:${userId}`, sub.endpoint);
await redis.hset("push:subs", { [sub.endpoint]: JSON.stringify(sub) });

// on unsubscribe
await redis.srem(`push:by-user:${userId}`, endpoint);
await redis.hdel("push:subs", endpoint);

// to notify one user
const endpoints = await redis.smembers(`push:by-user:${userId}`);
const raw = endpoints.length
  ? await redis.hmget<Record<string, string>>("push:subs", ...endpoints)
  : {};
const subs = Object.values(raw).filter(Boolean).map((v) =>
  typeof v === "string" ? JSON.parse(v) : v,
) as PushSubscriptionJSON[];
await sendPushBatch(subs, payload);
```

## Notes

- Upstash REST is request-scoped, so no connection pooling is needed in Fluid
  Compute functions. No warmup is required.
- Free tier offers enough daily commands to cover small-scale push for
  personal projects; monitor the Upstash dashboard for quota.
- Values are stored as JSON strings. Set a max size expectation per
  subscription (~400 bytes) to keep an eye on memory budgets.
