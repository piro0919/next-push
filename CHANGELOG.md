# Changelog

All notable changes to this project are documented here. This project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); breaking changes
before 1.0 may land in minor releases.

## [Unreleased]

## [0.3.3] — 2026-04-27

### Fixed

- `next-push --version` now reports the actual package version. It had
  been hard-coded to `0.1.0` since the CLI first shipped, so the value
  printed by the binary did not track releases. tsup inlines the version
  from `package.json` at build time via `define`, keeping it in sync
  without a runtime fs read.

## [0.3.2] — 2026-04-22

### Changed

- README and `package.json` now explicitly state that the server is
  framework-agnostic (runs on any runtime with `fetch` + `crypto.subtle` —
  Vercel, Cloudflare Workers, Netlify, AWS Lambda, Deno, Bun, plain Node).
  Added a **Non-Next.js usage** section with Hono / Cloudflare Workers /
  Express adapter examples and broadened the keywords. The CLI scaffold
  is still Next.js App Router only.

## [0.3.1] — 2026-04-22

### Changed

- `npx next-push init` now scaffolds a **cookie-backed** `app/api/push/route.ts`
  instead of an in-memory `Map`. The old default looked innocent but silently
  broke on Vercel / serverless hosts — subscribing on one Function instance
  and sending from another returned `subscription not found`. The cookie
  rides with the client and always works. Comments point users at the DB
  recipes (`docs/recipes/upstash-redis.md` / `neon-postgres.md`) for the
  real-app case where sends happen outside a request context.
- `send-example.ts` gains a short note explaining when to read the cookie vs.
  fetch from a DB.

### Added

- Demo wires in [`use-pwa`](https://github.com/piro0919/use-pwa) and shows an
  inline **Install** banner when the browser exposes `beforeinstallprompt`.
  Installing the demo as a PWA is especially relevant on mobile — iOS Safari
  only delivers Web Push to installed PWAs, and Android's installed PWAs get
  friendlier notification treatment.
- iOS install path covered by `react-ios-pwa-prompt` (loaded via dynamic
  client-only import). Auto-detects iOS Safari and walks the user through the
  Share → Add to Home Screen flow without any UA sniffing in our own code.
- Demo now surfaces the `SendResult` back to the UI — an inline status banner
  under the Send button reports Accepted / Subscription expired / Send failed
  (with HTTP status, message, and retryable hint) so testers can see when a
  push was actually accepted by the push service vs. silently rejected.

### Fixed

- Demo subscription state moved from an in-memory `Map` to an HTTP-only cookie
  set on subscribe. The old store was scoped to a single Vercel Function
  instance, so the second and subsequent Send presses could land on a cold
  instance and return `subscription not found` (404). The cookie travels with
  the client and works across instances.
- Demo **Send** now reads the caller's subscription from the cookie, so no
  server-side state is required. No change to the published library — the
  `createPushHandler` / `sendPush` APIs are unchanged.

## [0.3.0] — 2026-04-22

### Added

- `SendOptions` gains `onSuccess` / `onGone` / `onFailure` observability hooks
  for both `sendPush` and `sendPushBatch`. Exactly one fires per subscription
  based on the outcome; thrown errors and rejected promises from hooks are
  swallowed and logged via `console.warn` so observability never breaks the
  push flow. See the new Observability hooks recipe in the README.
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

- Demo sends now set `urgency: "high"` so Android Doze / Adaptive Battery no
  longer batches delivery for several seconds after pressing Send.
- `tsconfig.tsbuildinfo` is now gitignored; it was previously tracked and
  generated diff noise on every compile.

### Security

- Demo **Send notification** no longer broadcasts to every stored subscription.
  The caller must include their own subscription endpoint in the PUT body, and
  the server only sends to that single subscription. This prevents a visitor
  from spamming notifications to other visitors who subscribed on the same
  Vercel Function instance.

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
