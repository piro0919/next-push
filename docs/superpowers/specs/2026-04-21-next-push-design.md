# next-push v0.1 設計書

- 日付: 2026-04-21
- 作者: piro0919
- ステータス: ドラフト（未承認）

## 1. 目的

Next.js App Router 環境で Web Push 通知の **受信（クライアント）**・**送信（サーバー）**・**Service Worker** を一貫して扱える npm パッケージを提供する。

`web-push` が Node 専用・型が弱い・React との接続が手動という欠点を解消し、Next.js の流儀（Client Components / Route Handlers / Edge Runtime）に素直に乗る DX を目指す。

## 2. 非目標 (v0.1)

以下は v0.1 では扱わない。README に明示する:

- Pages Router 対応
- Vite / Remix / React Router など非 Next.js 環境のサポート
- DB 統合（購読情報の永続化はユーザーコールバックに委譲）
- トピック / チャンネル管理
- 送信バッチ最適化・レート制御
- 管理 UI・分析ダッシュボード
- iOS Safari 固有の細かい不具合の個別対応（best effort）
- React Native / Expo
- Electron 対応（v0.2 以降で検討）

## 3. 想定ユーザーと成功基準

**ユーザー像:**
- Next.js App Router でアプリを作っていて、自前で Web Push を実装したい
- OneSignal や FCM のようなマネージドサービスに依存したくない
- TypeScript ネイティブで、Edge Runtime でも動く送信コードを求めている

**v0.1 の成功基準:**
- `pnpm add next-push` と `npx next-push init` の 2 コマンドで動作する雛形が揃う
- README のクイックスタートで **15 分以内に購読→送信→通知表示** まで到達できる
- `sendPush` が Vercel の Edge Runtime（Route Handler / Middleware）で動く
- 購読失効（404/410）を型で判別でき、ユーザーが DB から削除判断できる

## 4. パッケージ構成

単一 npm パッケージ `next-push` に、サブパス export で 3 つのエントリーポイントを公開する。

```
next-push/
├── src/
│   ├── client/       → 'next-push'        (React hooks, Client Components 用)
│   ├── server/       → 'next-push/server' (VAPID 送信 + Route Handler factory)
│   ├── sw/           → 'next-push/sw'     (Service Worker 内で使うヘルパー)
│   ├── core/         → internal           (型と共通ロジック、非公開)
│   ├── cli/          → bin: next-push     (init, keys:generate)
│   └── app/          → Next.js デモ       (開発・動作確認・ドキュメント兼用)
├── templates/
│   └── sw.js                              (init で public/sw.js に配置)
├── docs/
│   └── superpowers/specs/                 (この設計書など)
├── dist/                                  (tsup 出力、公開対象)
├── package.json
├── tsconfig.json / tsconfig.build.json
├── tsup.config.ts
├── next.config.ts
└── biome.json
```

use-ear / use-pwa と同じく **単一リポジトリに Next.js デモとライブラリ本体が共存** する構成。ビルドは 2 種類:

- `npm run build` — `next build`（デモサイト、Vercel にデプロイ）
- `npm run build:lib` — `tsup`（npm 配布用 `dist/`）

### `exports` フィールド

```jsonc
{
  "exports": {
    ".":        { "import": "./dist/client/index.mjs", "require": "./dist/client/index.js", "types": "./dist/client/index.d.ts" },
    "./server": { "import": "./dist/server/index.mjs", "require": "./dist/server/index.js", "types": "./dist/server/index.d.ts" },
    "./sw":     { "import": "./dist/sw/index.mjs",     "require": "./dist/sw/index.js",     "types": "./dist/sw/index.d.ts" }
  },
  "bin": { "next-push": "./dist/cli/index.mjs" }
}
```

## 5. Public API

### 5.1 Client: `next-push`

```ts
'use client';

export function usePush(options?: {
  /** 省略時は NEXT_PUBLIC_VAPID_PUBLIC_KEY を参照 */
  vapidPublicKey?: string;
  /** 購読情報を POST / DELETE する API パス。default: '/api/push' */
  apiPath?: string;
}): {
  isSupported: boolean;
  permission: 'default' | 'granted' | 'denied';
  subscription: PushSubscriptionJSON | null;
  isSubscribing: boolean;
  error: Error | null;
  subscribe(): Promise<PushSubscriptionJSON>;
  unsubscribe(): Promise<void>;
};
```

**設計判断:**
- 単一フック `usePush()` に統合する。権限・購読・送信アクションが密結合しているため、分割すると毎回 3 つ並べて書く羽目になる
- SSR-safe: 初回レンダーでは `isSupported: false`, `permission: 'default'` を返し、マウント後に実値へ更新
- HMR / Turbopack 下でも SW 登録は一度だけになるよう、登録処理はシングルトン化

### 5.2 Server: `next-push/server`

```ts
export function createPushHandler(config: {
  onSubscribe: (sub: PushSubscriptionJSON, req: Request) => Promise<void> | void;
  onUnsubscribe: (endpoint: string, req: Request) => Promise<void> | void;
}): {
  POST(req: Request): Promise<Response>;
  DELETE(req: Request): Promise<Response>;
};

export function sendPush<T extends PushPayload = PushPayload>(
  subscription: PushSubscriptionJSON,
  payload: T,
  options?: {
    ttl?: number;                                             // default: 60
    urgency?: 'very-low' | 'low' | 'normal' | 'high';         // default: 'normal'
    topic?: string;                                            // 同topic で古いを上書き
  },
): Promise<SendResult>;

export type SendResult =
  | { ok: true;  statusCode: number }
  | { ok: false; gone: true;  statusCode: 404 | 410 }              // 購読を DB から削除推奨
  | { ok: false; gone: false; statusCode?: number; error: Error }; // 一時的エラー等

export function generateVAPIDKeys(): { publicKey: string; privateKey: string };

export type PushPayload = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, unknown>;
  tag?: string;
  url?: string;  // 通知クリック時のデフォルト遷移先
  actions?: Array<{ action: string; title: string; icon?: string }>;
};
```

**設計判断:**
- `sendPush` は `crypto.subtle` / `fetch` のみ使用し Edge Runtime 対応
- 購読失効（404/410）は例外ではなく **結果型で表現** する。呼び出し側が `result.gone` で分岐して DB から削除する責務を持つ
- VAPID 鍵は環境変数から自動取得（`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`）。明示的に渡す API も用意
- `createPushHandler` は `POST`（購読登録）と `DELETE`（解除）の Route Handler を生成。ユーザーはコールバックで DB に保存するだけ

### 5.3 Service Worker: `next-push/sw`

```ts
export function handlePush(
  event: PushEvent,
  handler?: (payload: PushPayload) => NotificationOptions & { title: string },
): void;

export function handleClick(
  event: NotificationEvent,
  handler?: (data: unknown, notification: Notification) => string | null,
): void;
```

**提供形態（v0.1）:**
- `next-push init` が `templates/sw.js` を `public/sw.js` にコピーする
- `public/sw.js` はスタンドアロンで動く最小実装（外部 import に依存しない）
- 高度なカスタマイズをしたいユーザーは、自前 SW から `next-push/sw` の関数を import して使う（ただしバンドリングは各自の責任）

## 6. データフロー

```
[ブラウザ / Client Component]
  usePush() 
    → Notification.requestPermission()
    → navigator.serviceWorker.register('/sw.js')
    → registration.pushManager.subscribe({ applicationServerKey })
    → POST {apiPath}  (subscription JSON)
           │
           ▼
[サーバー / Route Handler]
  createPushHandler({ onSubscribe }).POST
    → ユーザーが onSubscribe 内で DB に保存
           │
           ▼
[任意のタイミング / Server Action / Cron / 別 Route]
  DB から subscription を取得
  sendPush(sub, { title, body, data, url })
    → VAPID 署名 + fetch(subscription.endpoint)
    → SendResult を返す
       ├─ ok:true        → 送信成功
       ├─ gone:true      → 購読失効。呼び出し側で DB から削除
       └─ error          → 一時的エラー等。必要ならリトライ
           │
           ▼
[ブラウザ / Service Worker (public/sw.js)]
  'push' イベント          → showNotification(title, opts)
  'notificationclick'     → clients.openWindow(data.url ?? '/')
```

## 7. 環境変数

| 変数 | 用途 | 公開範囲 |
|------|------|----------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | クライアントの subscribe で使用 | public |
| `VAPID_PRIVATE_KEY` | サーバー側 sendPush で署名に使用 | server only |
| `VAPID_SUBJECT` | VAPID JWT の `sub` クレーム（`mailto:…` or URL） | server only |

`npx next-push keys:generate` で生成し、`.env.local` に追記するヘルパーを提供する。

## 8. セットアップ体験

```bash
pnpm add next-push
npx next-push init
```

`init` の動作:
1. `public/sw.js` を配置（既存がある場合は `--force` なしでは上書きしない）
2. `.env.local` に VAPID 鍵 3 件を追記（既存値があればスキップ）
3. `app/api/push/route.ts` のサンプルを生成
4. `usePush()` を使った最小サンプル `app/push-demo/page.tsx` をオプションで生成

既存ファイルは触らない方針（`--force` で上書き許可）。

## 9. テスト戦略

| 対象 | ツール | 内容 |
|------|--------|------|
| `server/sendPush` の VAPID 署名 | Vitest + MSW or fetch mock | JWT 生成、ECDH 鍵合意、ペイロード暗号化の検証 |
| `server/createPushHandler` | Vitest | `Request`/`Response` を直接渡して POST/DELETE の挙動確認 |
| `client/usePush` | Vitest + @testing-library/react + `vi.stubGlobal` | 権限・購読状態の遷移、エラー時の状態 |
| `sw/` ヘルパー | Vitest | `PushEvent` / `NotificationEvent` モックで単体テスト |
| SW テンプレ本体 | v0.1 ではユニットテスト省略（E2E で担保予定） | |
| E2E | v0.2 以降で Playwright を予定 | |

`peerDependencies`: `react >=18`, `next >=15`。

## 10. Edge Runtime 対応

- `server/` の全関数は `crypto.subtle`, `Uint8Array`, `fetch`, `TextEncoder` のみ使用
- `node:crypto`, `Buffer`, `process.nextTick` 等を **禁止リスト** として依存しない
- ECDH（P-256）と HKDF は Web Crypto API で実装。外部依存（`@peculiar/*` 等）は最小化
- `createPushHandler` は Runtime agnostic（Node / Edge どちらの Route Handler でも動く）

## 11. リポジトリ構成・ツーリング

use-pwa の構成を踏襲:

- **ビルド:** `tsup`（ESM + CJS 両対応）、`tsconfig.build.json` 別建て
- **リンター/フォーマッタ:** Biome
- **Git hooks:** lefthook（コミット時 `biome check`）
- **デモサイト:** Next.js 16 App Router、Vercel にデプロイ（`next-push.kkweb.io` を想定）
- **Service Worker（デモ）:** Serwist を利用、開発モードでは無効化
- **Renovate:** 依存更新の自動化

## 12. バージョニング方針

- v0.x 系は **破壊的変更を許容**（セマンティックバージョニング厳密適用は v1 から）
- 目標: 2〜3 ヶ月の実運用を経て v1.0 に到達
- v0.2 以降で検討: iOS の PWA installed 検出の改善、SW ビルド時注入、Electron 対応、E2E テスト (Playwright)、バッチ送信ヘルパー

## 13. 主要な設計判断とその根拠

| 判断 | 採用案 | 根拠 |
|------|--------|------|
| フレームワーク対象 | Next.js 専用（v0.1） | スコープ明確化、Server Actions/Edge Runtime を前提にした API が書ける |
| パッケージ分割 | 単一パッケージ + サブパス | 監視・リリース・依存の整合性管理コストを抑える |
| 購読永続化 | ユーザー側コールバック（DB 抽象化しない） | DB 選定はアプリ固有。ライブラリが抱えると保守が重い |
| 送信失敗の表現 | 結果型（SendResult） | try/catch より分岐が明示的、`gone` の扱いを強制しやすい |
| SW 提供方法 | テンプレコピー（CLI） | ビルド時注入は Turbopack/Webpack 二重対応が重い。v0.1 は最小で |
| Client API | 単一 `usePush()` | 分離案は実利用で冗長。複雑化したら v1 で分割検討 |

## 14. 想定されるリスク

- **市場規模が限定的** — Web Push 自体の採用率が低く、Next.js 限定でさらに狭まる。`stars 500〜2000` 級が現実ライン
- **SW 保守コスト** — ブラウザ差異、iOS 特有の挙動、HMR/Turbopack 相性で終わりなきバグ修正が発生しうる
- **Vercel 純正品リスク** — Vercel が公式 push ヘルパーを出した場合、差別化が難しくなる
- **VAPID 実装の難易度** — Web Crypto のみでの ECDH/HKDF 実装は既存ライブラリ非依存で書く場合にバグが入りやすい。テストを厚くする

## 15. 次のステップ

1. この設計書をユーザーレビュー
2. 承認後、`superpowers:writing-plans` スキルで実装プランを作成
3. プラン承認後、実装開始
