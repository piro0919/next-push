# Persistence: Neon Postgres (Vercel Marketplace)

When you want subscriptions stored alongside other relational data — or
indexed by user, device, or timestamp with real SQL — Neon via the Vercel
Marketplace is the minimal-ops path. Neon's serverless driver supports
Fluid Compute without connection pooling surprises.

## Provision

1. **Integrations → Marketplace → Neon → Add Integration**
2. Pick the project, create a database, choose a region close to your
   function region
3. Vercel auto-injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`

Pull them down for local dev:

```bash
vercel env pull .env.local
```

## Schema

```sql
create table push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  user_id    text,
  created_at timestamptz not null default now()
);
create index on push_subscriptions (user_id);
```

Apply via `psql`, Drizzle, Prisma, or your migration tool of choice.

## Wire into `createPushHandler`

Using the Neon serverless driver (HTTP, works in Fluid Compute):

```ts
// app/api/push/route.ts
import { createPushHandler } from "@piro0919/next-push/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export const { POST, DELETE } = createPushHandler({
  onSubscribe: async (sub) => {
    await sql`
      insert into push_subscriptions (endpoint, p256dh, auth)
      values (${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
      on conflict (endpoint) do update
        set p256dh = excluded.p256dh, auth = excluded.auth
    `;
  },
  onUnsubscribe: async (endpoint) => {
    await sql`delete from push_subscriptions where endpoint = ${endpoint}`;
  },
});
```

## Read for a broadcast

```ts
import { sendPushBatch } from "@piro0919/next-push/server";
import { neon } from "@neondatabase/serverless";
import type { PushSubscriptionJSON } from "@piro0919/next-push";

const sql = neon(process.env.DATABASE_URL!);

export async function broadcast(payload: { title: string; body?: string }) {
  const rows = await sql<
    { endpoint: string; p256dh: string; auth: string }[]
  >`select endpoint, p256dh, auth from push_subscriptions`;

  const subs: PushSubscriptionJSON[] = rows.map((r) => ({
    endpoint: r.endpoint,
    keys: { p256dh: r.p256dh, auth: r.auth },
  }));

  const result = await sendPushBatch(subs, payload, { concurrency: 20 });
  if (result.goneEndpoints.length) {
    await sql`
      delete from push_subscriptions
      where endpoint = any(${result.goneEndpoints})
    `;
  }
  return result;
}
```

## Per-user notify

```ts
const rows = await sql<
  { endpoint: string; p256dh: string; auth: string }[]
>`select endpoint, p256dh, auth from push_subscriptions where user_id = ${userId}`;

const subs = rows.map((r) => ({
  endpoint: r.endpoint,
  keys: { p256dh: r.p256dh, auth: r.auth },
}));

await sendPushBatch(subs, payload);
```

## Notes

- Neon's HTTP driver (`@neondatabase/serverless`) avoids the connection
  pooling considerations of traditional Postgres clients; it is the
  recommended choice for Vercel Functions.
- For long-running processes (e.g. local scripts) where you want a single
  persistent TCP connection, use `pg` with `DATABASE_URL_UNPOOLED`.
- If you already use Drizzle or Prisma elsewhere in the app, reuse the
  client — the recipes above can be adapted directly.
