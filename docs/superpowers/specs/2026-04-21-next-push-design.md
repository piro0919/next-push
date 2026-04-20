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
- iOS の A2HS（Add to Home Screen）促進 UI — [use-pwa](https://github.com/piro0919/use-pwa) との併用を推奨
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
- `sendPush` が Edge Runtime（Route Handler / Middleware）で動く
- 購読失効（404/410）を型で判別でき、ユーザーが DB から削除判断できる
- 以下の環境で動作保証:
  - Chrome / Edge / Firefox（デスクトップ・モバイル）
  - **iOS 16.4+ の PWA インストール済み環境**（Safari タブ内は `isSupported: false` を正しく返す）

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

SW は「おまけ」ではなく第一級サポート対象。以下のイベントを型付きヘルパーで扱う。

```ts
export function handlePush(
  event: PushEvent,
  handler?: (payload: PushPayload) => NotificationOptions & { title: string },
): void;

/**
 * notificationclick のハンドラ。
 * - 同じ URL のタブが既に開いていれば focus する
 * - 無ければ新規 open
 * - handler が null を返したら何もしない
 */
export function handleClick(
  event: NotificationEvent,
  handler?: (data: unknown, notification: Notification) => string | null,
): void;

export function handleClose(
  event: NotificationEvent,
  handler: (notification: Notification) => void | Promise<void>,
): void;

/**
 * pushsubscriptionchange でエンドポイントが失効/変更されたとき、
 * 自動で再購読し、サーバーに通知する。
 */
export function handleSubscriptionChange(
  event: Event,
  options: {
    vapidPublicKey: string;
    apiPath?: string;  // default: '/api/push'
  },
): void;

/** 上記4つをまとめて登録するショートカット */
export function registerAll(options: {
  vapidPublicKey: string;
  apiPath?: string;
  onPush?: (payload: PushPayload) => NotificationOptions & { title: string };
  onClick?: (data: unknown, notification: Notification) => string | null;
  onClose?: (notification: Notification) => void | Promise<void>;
}): void;
```

**提供形態（v0.1）:**

- **デフォルトルート（推奨）**: `next-push init` が `public/sw.js` を生成。スタンドアロンで動き、主要機能全部入り。外部 import 不要
- **Serwist 併用**: Serwist の SW（例: `src/app/sw.ts`）に `import { registerAll } from 'next-push/sw'` を追記するだけで共存可能。README にレシピを掲載
- **カスタム SW**: `next-push/sw` の関数を import して自前で組み立て可能（バンドリングはユーザー責任）

**開発体験:**

- `NODE_ENV !== 'production'` では SW 登録をスキップ（use-pwa と同じ挙動、Turbopack/HMR 対策）
- `apiPath` は client / sw で揃える必要があるため、環境変数 `NEXT_PUBLIC_PUSH_API_PATH` で統一可能
- SW のパスは `/sw.js` をデフォルトとするが、`usePush({ swPath })` でカスタマイズ可能

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
npx next-push init                  # フル構成（送受信、デフォルト）
npx next-push init --send-only      # サーバーから送信するだけ
npx next-push init --receive-only   # クライアントで受信するだけ
```

インタラクティブプロンプトは使わない（スクリプト化しやすさを優先）。80% のユーザーはフル構成で十分、残りはフラグで切り替える。

### 8.1 フル構成 (`init`) が生成するもの

| 生成物 | フル | `--send-only` | `--receive-only` |
|---|:---:|:---:|:---:|
| `public/sw.js`（または追記レシピ）                 | ✅ | — | ✅ |
| `.env.local` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`     | ✅ | — | ✅ |
| `.env.local` → `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` | ✅ | ✅ | — |
| `app/api/push/route.ts`（Route Handler サンプル）  | ✅ | — | ✅ |
| `lib/send-push-example.ts`（`sendPush` 使用例）    | ✅ | ✅ | — |
| `app/push-demo/page.tsx`（動作確認用の画面）        | ✅ | — | ✅ |

### 8.2 既存 Service Worker の検出

`init` はまず既存 SW の状態を検出して分岐する（フル または `--receive-only` の場合のみ）:

1. **`src/app/sw.ts` を検出**（Serwist の手書き SW）
   → `public/sw.js` は生成しない。以下のレシピを表示:
   ```
   ⚠️  Serwist の SW を検出しました。src/app/sw.ts に以下を追加してください:

      import { registerAll } from 'next-push/sw';
      registerAll({ vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY! });
   ```

2. **`public/sw.js` を検出**
   → 以下のメッセージを表示して終了（自動選択しない、事故防止のため明示コマンドを要求）:
   ```
   ⚠️  public/sw.js が既に存在します。以下から選択してください:

      --force           既存を上書き
      --sw-addon        public/next-push-sw.js を生成し、既存 SW から importScripts する
      --skip-sw         SW 生成をスキップ（他のファイルだけ生成）
   ```

3. **どちらもなし**
   → `public/sw.js` をそのまま生成

### 8.3 完了サマリー

実行後、生成物と次のアクションを表示:

```
✓ public/sw.js を生成
✓ .env.local に VAPID 鍵 3 つを追加
✓ app/api/push/route.ts を生成
✓ app/push-demo/page.tsx を生成
✓ lib/send-push-example.ts を生成

次のステップ:
  - pnpm dev で起動し、/push-demo にアクセスして動作確認
  - 送信サンプルは lib/send-push-example.ts を参照
```

### 8.4 安全策

- 既存ファイルは原則上書きしない（SW 以外は `--force` で上書き）
- `.env.local` は追記のみ、同名キーが既にあれば **更新しない**（誤って運用中の鍵を壊さないため）

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

## 10. Runtime Agnostic（Node.js / Edge / Cloudflare Workers 対応）

2026 年現在、Vercel は Fluid Compute（Node.js）を推奨しており、純粋な Edge Functions の存在感は薄れている。ただし Cloudflare Workers / Deno Deploy / Next.js middleware では引き続き Edge 系ランタイムが使われる。

**方針:** 「Edge First」ではなく **Runtime agnostic** を掲げる。Web 標準 API のみ使えば Node / Edge 両方で動き、結果的に Cloudflare Workers などでもそのまま動く。

**実装ルール:**

- `server/` の全関数は `crypto.subtle`, `Uint8Array`, `fetch`, `TextEncoder`, `TextDecoder` のみ使用
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
