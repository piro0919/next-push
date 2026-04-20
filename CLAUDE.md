# CLAUDE.md

## Project Overview

next-push is a Web Push notifications library for Next.js App Router apps. It provides client hooks, a server-side VAPID sender, and Service Worker helpers — all from a single package with subpath exports.

## Tech Stack

- TypeScript 5+ (`strict`)
- Next.js 16 (App Router, for demo site)
- React 19
- tsup (library build)
- Vitest (tests)
- Biome (lint/format)
- lefthook (Git hooks)
- Serwist (demo-only Service Worker)

## Structure

```
src/
├── client/      → 'next-push' export (React hooks)
├── server/      → 'next-push/server' export (VAPID send, Route Handler)
├── sw/          → 'next-push/sw' export (SW helpers)
├── core/        → internal shared types and utilities
├── cli/         → next-push CLI (init, keys:generate)
└── app/         → Next.js demo app
templates/
└── sw.js        → standalone SW template copied by init
```

## Commands

```bash
pnpm dev          # Next.js demo on :3000
pnpm build        # demo build
pnpm build:lib    # library build via tsup → dist/
pnpm test         # Vitest
pnpm lint         # Biome check
```

## Docs

- Design spec: [docs/superpowers/specs/2026-04-21-next-push-design.md](docs/superpowers/specs/2026-04-21-next-push-design.md)
- Implementation plan: [docs/superpowers/plans/2026-04-21-next-push-v0.1-implementation.md](docs/superpowers/plans/2026-04-21-next-push-v0.1-implementation.md)
