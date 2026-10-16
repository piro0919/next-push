# CLAUDE.md

## Project Overview

next-push is a Web Push notifications library for Next.js App Router apps. It provides client hooks, a server-side VAPID sender, and Service Worker helpers — all from a single package with subpath exports.

## Tech Stack

- TypeScript 5+ (`strict`)
- Next.js 16 App Router on Turbopack (demo site)
- React 19
- tsup (library build)
- Vitest (unit tests)
- Playwright (E2E tests)
- Biome (lint/format)
- lefthook (Git hooks)
- Serwist via `@serwist/turbopack` (demo-only Service Worker)

## Structure

```
src/
├── client/                      → '@piro0919/next-push' export (React hooks)
├── server/                      → '@piro0919/next-push/server' export (VAPID send, Route Handler)
├── sw/                          → '@piro0919/next-push/sw' export (SW helpers)
├── core/                        → internal shared types and utilities
├── cli/                         → next-push CLI (init, keys:generate)
└── app/                         → Next.js demo app
    ├── sw.ts                    → Serwist SW that also calls registerAll() from next-push/sw
    └── serwist/[...path]/       → Route Handler serving /serwist/sw.js at runtime
templates/
└── sw.js                        → standalone SW template copied by `next-push init`
e2e/
└── push-demo.spec.ts            → Playwright E2E (subscribe → FCM 201)
```

## Commands

```bash
pnpm dev            # Next.js demo on :3000
pnpm build          # demo build
pnpm build:lib      # library build via tsup → dist/
pnpm test           # Vitest (unit)
pnpm test:e2e       # Playwright E2E (starts pnpm dev automatically)
pnpm test:e2e:ui    # Playwright UI mode
pnpm lint           # Biome check
pnpm format         # Biome format --write
```

## Demo SW architecture (Turbopack + Serwist)

Unlike the webpack-based `@serwist/next`, `@serwist/turbopack` does **not** generate a static `public/sw.js` at build time. Instead, `src/app/serwist/[...path]/route.ts` serves the SW dynamically via `createSerwistRoute()`, which bundles `src/app/sw.ts` on demand with esbuild-wasm.

Because the SW is served at `/serwist/sw.js`, the demo page passes `usePush({ swPath: '/serwist/sw.js' })` to override the library default of `/sw.js`. End users of the library who use `npx next-push init` get a standalone `public/sw.js` from the CLI template and can omit `swPath`.

### Gotchas encountered during setup

- **`swSrc` is project-cwd-relative.** With a `src/` layout, write `swSrc: "src/app/sw.ts"` — not `"app/sw.ts"`.
- **Next.js 16 passes catch-all params as `string[]`, the library expects string.** The Route Handler joins the array with `/` before delegating to `serwistRoute.GET`.
- **`process.env.*` does not exist in the SW runtime.** Use `esbuildOptions.define` to inline `NEXT_PUBLIC_*` env vars at build time.
- **`esbuild-wasm` is a required peer** of `@serwist/turbopack`. Add it to devDependencies and list it in `next.config.ts` `serverExternalPackages`.

## Docs

- Design spec: [docs/superpowers/specs/2026-04-21-next-push-design.md](docs/superpowers/specs/2026-04-21-next-push-design.md)
- Implementation plan: [docs/superpowers/plans/2026-04-21-next-push-v0.1-implementation.md](docs/superpowers/plans/2026-04-21-next-push-v0.1-implementation.md)

## Push service endpoint check (v3.0.0)

Agreed on 2026-10-16 in a home-window session and implemented the same day: `src/server/pushEndpoint.ts`, the `extraPushHosts` option (name delegated to Claude), and a check in the demo PUT, which reads the subscription back from a cookie the caller controls. CHANGELOG has it under "3.0.0 - Unreleased". Remaining: bump the version and publish, then the "After publishing" steps below.

The "Why" and "What to build" sections below are the plan as agreed and describe the code before this change.

### Why

The same "accept only browser push services as subscription endpoints" check has been copied into koidamashii (`src/lib/push.ts`), jumps-lab (`src/lib/push-endpoint.ts`) and spatto (`packages/db/src/push-endpoint.ts`), and the copies have already drifted (koidamashii lacks `android.googleapis.com` and the subdomains of `push.apple.com`). When Chromium started returning `jmt17.google.com` endpoints (2026-10-14), each repo had to be fixed separately.

`createPushHandler` currently only checks that the endpoint starts with `https://`, so anyone can register an arbitrary host. The sender then POSTs to it (SSRF), and unresponsive hosts can stall a batch send.

### What to build

- Export `isPushServiceEndpoint(endpoint: string): boolean` and `isValidSubscription(value: unknown): value is PushSubscriptionJSON` from `@piro0919/next-push/server`.
- Port them from jumps-lab's `src/lib/push-endpoint.ts`, which is the most complete copy: host allowlist (FCM, `android.googleapis.com`, `jmt<n>.google.com`, Mozilla, `*.push.apple.com`, `*.notify.windows.com`), https only, no port / userinfo, max length 1000, base64url keys with exact lengths (p256dh 87 chars, auth 22 chars).
- `createPushHandler` POST rejects subscriptions that fail `isValidSubscription` with 400 **by default**. Decided: on by default, not opt-in, because opt-in leaves the SSRF hole open for every existing user. This is a breaking change → major version 3.0.0.
- DELETE keeps the current `https://` check only (it makes no outbound request, and stricter checks would block removing old rows).
- Provisional (decided by Claude when delegated, revisit if it feels wrong): an option on `createPushHandler` to add extra host patterns, so users are not stuck waiting for a release when a browser changes its push host again. `sendPush` / `sendPushBatch` stay unchanged in this release.
- Unit tests for each host, the rejections (unknown host, http, port, userinfo, long URL, bad key lengths), and the handler returning 400.
- Update README, CHANGELOG (breaking change and migration note), and the demo if it is affected.

### After publishing

- jumps-lab (on 2.0.0) and koidamashii (on ^1.0.1, so it also crosses the 2.0 changes) switch to the exported functions and delete their local copies.
- spatto does not depend on next-push; leave its copy alone unless decided otherwise.
