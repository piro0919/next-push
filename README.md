# next-push

Web Push notifications for Next.js — client hooks, server sender, and Service Worker helpers with full VAPID support.

## Why

- `web-push` is Node-only, weakly typed, and requires manual wiring into React and Next.js
- OneSignal and FCM are overkill for many apps and lock you into a vendor
- This package does all three sides (client / server / SW) for Next.js App Router with TypeScript-first APIs

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

## Supported environments

| | |
|---|---|
| Next.js | 15+ (App Router only) |
| React   | 18+ |
| Node.js | 20+ |
| Chrome / Edge / Firefox (desktop + Android) | Latest 2 versions |
| Safari macOS | 16+ |
| **Safari iOS** | **16.4+ and installed as a PWA only** |
| iOS Chrome / Firefox / Edge | ❌ Not supported (all use WebKit + PWA restriction) |
| In-app browsers (LINE, Twitter, etc.) | ❌ Not supported |

## Roadmap

- v0.2: batched sending, Playwright E2E, richer A2HS recipes, Electron
- v1.0: stable API, semver

## License

MIT © piro0919
