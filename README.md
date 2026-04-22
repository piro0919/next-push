# next-push

Web Push notifications library with VAPID support — framework-agnostic server, React client hooks, and Service Worker helpers. Ships a Next.js App Router scaffold out of the box.

[![npm](https://img.shields.io/npm/v/@piro0919/next-push.svg)](https://www.npmjs.com/package/@piro0919/next-push)
[![license](https://img.shields.io/npm/l/@piro0919/next-push.svg)](./LICENSE)

**🔗 [Live Demo](https://next-push.kkweb.io/)** — subscribe in Chrome/Edge, tweak the payload (title, body, icon, image, tag, click URL), hit **Send notification**, and get a real push.

## Runs anywhere

The server (`@piro0919/next-push/server`) is pure Fetch API — only `fetch` + `crypto.subtle` — so it runs on any modern runtime:

- ✅ Vercel Functions / Next.js / Remix / SvelteKit
- ✅ Cloudflare Workers & Pages
- ✅ Netlify Functions, AWS Lambda (Node 18+)
- ✅ Deno Deploy, Bun
- ✅ Plain Node.js with Express / Hono / Fastify / etc.

The CLI (`npx next-push init`) scaffolds a Next.js App Router setup. If you use another framework, skip the CLI and wire `createPushHandler` / `sendPush` yourself — see [Non-Next.js usage](#non-nextjs-usage).

## Why

- `web-push` is Node-only, weakly typed, and requires manual wiring into client / React / Service Worker
- OneSignal and FCM are overkill for many apps and lock you into a vendor
- This package does all three sides (client / server / SW) with a framework-agnostic core and a TypeScript-first API — the Next.js App Router integration is a convenience layer on top, not a requirement

## Install

```bash
pnpm add @piro0919/next-push
npx next-push init
```

That's it — a working push demo is scaffolded at `/push-demo`.

## Quick Start

```tsx
// app/push-toggle/page.tsx
"use client";
import { usePush } from "@piro0919/next-push";

export default function PushToggle() {
  const { subscription, subscribe, unsubscribe, permission } = usePush();
  if (permission === "denied") return <p>Blocked</p>;
  return subscription
    ? <button onClick={unsubscribe}>Turn off</button>
    : <button onClick={subscribe}>Turn on</button>;
}
```

```ts
// app/api/push/route.ts
import { createPushHandler } from "@piro0919/next-push/server";
import { saveSubscription, deleteSubscription } from "@/lib/db";

export const { POST, DELETE } = createPushHandler({
  onSubscribe: saveSubscription,
  onUnsubscribe: deleteSubscription,
});
```

```ts
// wherever you want to send a push
import { sendPush } from "@piro0919/next-push/server";
const result = await sendPush(subscription, { title: "Hello", body: "World" });
if (!result.ok && result.gone) await deleteSubscription(subscription.endpoint);
```

## Non-Next.js usage

`createPushHandler` accepts a Fetch `Request` and returns a `Response`, so any runtime with the Fetch API can use it with a thin adapter.

### Hono

```ts
import { Hono } from "hono";
import { createPushHandler, sendPush } from "@piro0919/next-push/server";

const push = createPushHandler({
  onSubscribe: async (sub) => { /* save to DB */ },
  onUnsubscribe: async (endpoint) => { /* delete from DB */ },
});

const app = new Hono();
app.post("/api/push", (c) => push.POST(c.req.raw));
app.delete("/api/push", (c) => push.DELETE(c.req.raw));
```

### Cloudflare Workers

```ts
import { createPushHandler, sendPush } from "@piro0919/next-push/server";

const push = createPushHandler({
  onSubscribe: async (sub) => { /* KV / D1 write */ },
  onUnsubscribe: async (endpoint) => { /* KV / D1 delete */ },
});

export default {
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === "/api/push") {
      if (req.method === "POST") return push.POST(req);
      if (req.method === "DELETE") return push.DELETE(req);
    }
    return new Response("Not found", { status: 404 });
  },
};
```

### Express (Node 18+)

```ts
import express from "express";
import { createPushHandler, sendPush } from "@piro0919/next-push/server";

const push = createPushHandler({ onSubscribe: ..., onUnsubscribe: ... });
const app = express();

// Bridge Express req → Fetch Request via the Web Fetch API.
async function toFetchRequest(req: express.Request): Promise<Request> {
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body);
  return new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body,
  });
}

app.post("/api/push", express.json(), async (req, res) => {
  const response = await push.POST(await toFetchRequest(req));
  res.status(response.status).send(await response.text());
});
```

The client (`usePush`) and Service Worker (`registerAll`) helpers are runtime-agnostic — they only touch browser APIs. React 18+ is the only hard requirement there.

## Partial Install

```bash
npx next-push init --send-only     # server-side only
npx next-push init --receive-only  # client + SW only
```

## API

### `usePush(options?)`

| Return | Type | Notes |
|---|---|---|
| `isSupported` | `boolean` | `false` during SSR and on unsupported browsers |
| `permission` | `'default' \| 'granted' \| 'denied'` | |
| `subscription` | `PushSubscriptionJSON \| null` | |
| `subscribe()` | `() => Promise<PushSubscriptionJSON>` | Requests permission and subscribes |
| `unsubscribe()` | `() => Promise<void>` | |
| `isSubscribing` | `boolean` | |
| `error` | `Error \| null` | |

### `sendPush(subscription, payload, options?)`

Returns a discriminated `SendResult`:
- `{ ok: true, statusCode }` — delivered
- `{ ok: false, gone: true, statusCode: 404 | 410 }` — subscription is dead, delete it
- `{ ok: false, gone: false, error, statusCode? }` — other failure (transient or misconfig)

### `createPushHandler({ onSubscribe, onUnsubscribe })`

Returns `{ POST, DELETE }` ready to re-export from `app/api/push/route.ts`.

### Service Worker helpers

See `@piro0919/next-push/sw`. `registerAll({ vapidPublicKey })` wires up `push`, `notificationclick`, `notificationclose`, and `pushsubscriptionchange`.

## Recipes

Deeper guides for Vercel Marketplace-provisioned storage:

- [Upstash Redis](./docs/recipes/upstash-redis.md) — minimal-ops hash-based store, per-user indexing via sets
- [Neon Postgres](./docs/recipes/neon-postgres.md) — relational store with Neon's serverless HTTP driver

### Prisma

```prisma
model PushSubscription {
  endpoint  String   @id @unique
  p256dh    String
  auth      String
  userId    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

```ts
// app/api/push/route.ts
import { createPushHandler } from "@piro0919/next-push/server";
import { prisma } from "@/lib/prisma";

export const { POST, DELETE } = createPushHandler({
  onSubscribe: async (sub) => {
    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
  },
  onUnsubscribe: async (endpoint) => {
    await prisma.pushSubscription.delete({ where: { endpoint } }).catch(() => {});
  },
});
```

### Drizzle

```ts
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userId: text("user_id"),
});
```

### iOS: combine with use-pwa

iOS Safari only delivers push notifications when the site is installed as a PWA. Use [use-pwa](https://github.com/piro0919/use-pwa) to detect and prompt installation:

```tsx
"use client";
import { usePwa } from "use-pwa";
import { usePush } from "@piro0919/next-push";

export function NotifyButton() {
  const { isPwa } = usePwa();
  const { subscribe, isSupported } = usePush();
  if (!isPwa) return <p>Install this app to enable notifications on iOS.</p>;
  if (!isSupported) return null;
  return <button onClick={subscribe}>Enable notifications</button>;
}
```

### Rich notification UI (icons, badges, actions)

Send payloads can carry full `Notification` options:

```ts
await sendPush(subscription, {
  title: "New message from Alice",
  body: "Hi! When are you free?",
  icon: "/icons/icon-192.png",        // Main notification icon (shown next to the title)
  badge: "/icons/badge-72.png",       // Monochrome icon for Android status bar
  image: "/preview/message.jpg",      // Large preview image (Chrome Android only)
  tag: "chat-123",                    // Replaces any notification with the same tag
  url: "/chat/123",                   // Where to go when the notification is clicked
  actions: [
    { action: "reply", title: "Reply", icon: "/icons/reply.png" },
    { action: "mark-read", title: "Mark as read" },
  ],
  data: { messageId: 456, userId: "alice" },
});
```

### Default icon / badge at the SW level

If you don't want every sender to repeat the same icon, set defaults at SW registration:

```ts
// src/app/sw.ts (or public/sw.js — use --default-icon with the CLI)
import { registerAll } from "@piro0919/next-push/sw";

registerAll({
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  defaultNotification: {
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
  },
});
```

The CLI can inline defaults into the generated `public/sw.js`:

```bash
npx next-push init --default-icon /icons/icon-192.png --default-badge /icons/badge-72.png
```

### Batch sending

Send the same payload to many subscriptions with bounded concurrency:

```ts
import { sendPushBatch } from "@piro0919/next-push/server";
import { prisma } from "@/lib/prisma";

const subs = await prisma.pushSubscription.findMany();
const result = await sendPushBatch(subs, {
  title: "Daily digest",
  body: "You have 3 new messages.",
}, {
  concurrency: 20,
  onProgress: (done, total) => console.log(`${done}/${total}`),
});

// Prune dead subscriptions
await prisma.pushSubscription.deleteMany({
  where: { endpoint: { in: result.goneEndpoints } },
});

console.log(`${result.sent}/${result.total} delivered, ${result.failed} failures`);
```

### Observability hooks

Plug metrics, logging, and DB cleanup into every `sendPush` / `sendPushBatch`
call without wrapping the call site. Exactly one of the three fires per
subscription; thrown errors and rejected promises from hooks are swallowed
(and logged to `console.warn`) so observability never breaks the push flow.

```ts
import { sendPushBatch } from "@piro0919/next-push/server";
import { metrics, logger } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

await sendPushBatch(subs, payload, {
  concurrency: 20,
  onSuccess: (sub, statusCode) => {
    metrics.increment("push.success", { statusCode });
  },
  onGone: async (sub) => {
    // Subscription is dead — clean up immediately.
    await prisma.pushSubscription.delete({
      where: { endpoint: sub.endpoint },
    }).catch(() => {});
  },
  onFailure: (sub, error, { statusCode, retryable, retryAfter }) => {
    logger.error("push failed", { endpoint: sub.endpoint, statusCode, retryable, retryAfter, error });
    metrics.increment("push.failure", { statusCode, retryable });
  },
});
```

Hooks work identically on the single-call `sendPush`. For long-running
bookkeeping you can return a Promise; it will be awaited in the background
without blocking the return.

### Handling retryable failures

`sendPush` flags transient failures so you can retry with backoff:

```ts
const result = await sendPush(subscription, payload);

if (result.ok) return; // delivered
if (result.gone) {
  await db.subscription.delete({ where: { endpoint: subscription.endpoint } });
  return;
}
if (result.retryable) {
  const delay = (result.retryAfter ?? 60) * 1000;
  setTimeout(() => sendPush(subscription, payload), delay);
  return;
}
// Permanent failure — log and investigate
console.error("Push failed permanently", result.statusCode, result.error);
```

## Supported environments

### Server / runtime

| | |
|---|---|
| Any runtime with `fetch` + `crypto.subtle` | ✓ (see [Runs anywhere](#runs-anywhere)) |
| Node.js | 18+ |
| Next.js (for the CLI scaffold) | 15+, App Router |
| React (for `usePush`) | 18+ |

### Browsers (client / SW)

| | |
|---|---|
| Chrome / Edge / Firefox (desktop + Android) | Latest 2 versions |
| Safari macOS | 16+ |
| **Safari iOS** | **16.4+ and installed as a PWA only** |
| iOS Chrome / Firefox / Edge | ❌ Not supported (all use WebKit + PWA restriction) |
| In-app browsers (LINE, Twitter, etc.) | ❌ Not supported |

## Roadmap

- **v0.2** (current) — batched sending, Playwright E2E (Chromium + Firefox), WebKit smoke, customizable demo, GitHub Actions CI
- **v0.3** — persistence adapter recipes (Upstash Redis, Neon Postgres), observability hooks, verified iOS PWA / Android Chrome E2E
- **v1.0** — stable API with semver

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## License

MIT © piro0919
