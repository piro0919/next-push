# Changelog

All notable changes to this project are documented here. This project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); breaking changes
before 1.0 may land in minor releases.

## [Unreleased]

### Security

- Demo **Send notification** no longer broadcasts to every stored subscription.
  The caller must include their own subscription endpoint in the PUT body, and
  the server only sends to that single subscription. This prevents a visitor
  from spamming notifications to other visitors who subscribed on the same
  Vercel Function instance.

### Added

- Persistence recipes in `docs/recipes/` — Upstash Redis and Neon Postgres,
  both via the Vercel Marketplace, with broadcast, per-user indexing, and
  gone-subscription pruning patterns.
- Demo site gains a customizable notification payload form — title, body, icon,
  image, tag, and click URL — with six bundled SVG presets (3 icons, 3 banner
  images) so the flow works offline. `PUT /api/push` accepts the full
  `PushPayload` shape in the demo.
- Inline info tooltips on each form field with hover (desktop) and tap (mobile)
  support.
- Playwright gains a third `webkit` project that runs a smoke spec — bundled
  WebKit lacks APNs (no `PushManager`), so we only verify graceful degradation.
- GitHub Actions workflows:
  - `ci.yml` runs lint + Vitest + `build:lib` on push/PR.
  - `e2e.yml` runs the full Playwright suite on `workflow_dispatch`, scoped to
    a single project or `all`.

### Changed

- Demo **Send test notification** button renamed to **Send notification** now
  that payloads are user-configured.

### Fixed

- `tsconfig.tsbuildinfo` is now gitignored; it was previously tracked and
  generated diff noise on every compile.

## [0.2.0] — 2026-04

### Added

- `sendPushBatch` with bounded concurrency and a grouped `{ sent, failed,
  goneEndpoints }` result.
- `SendResult` gains `retryable` and `retryAfter` for 429 / 5xx responses.
- `registerAll({ defaultNotification })` at the SW layer, letting senders omit
  icon/badge per payload.
- `next-push init --default-icon` / `--default-badge` to inline defaults into
  the generated `public/sw.js` template.
- Demo site redesigned with Tailwind 4 + Geist and published at
  <https://next-push.kkweb.io>.
- Playwright E2E adds a Firefox project that exercises Mozilla autopush in
  addition to FCM.

### Fixed

- `getOrRegisterSW` is now keyed by `swPath` so multiple SW paths don't collide
  when several hooks coexist.
- Vercel production build pinned with `--webpack` and `shamefully-hoist` for
  pnpm + Turbopack compatibility.

## [0.1.1] — 2026-04

### Fixed

- Minor CLI ergonomics and packaging fixes; see git history for details.

## [0.1.0] — 2026-04

### Added

- Initial release: `usePush` React hook, `sendPush` / `createPushHandler`
  server helpers, `registerAll` SW helpers, and the `next-push` CLI
  (`init`, `keys:generate`).
