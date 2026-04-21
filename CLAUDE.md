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
