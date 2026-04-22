"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePush } from "../client";

const QUICK_START_STEPS = [
  {
    code: "pnpm add @piro0919/next-push\nnpx next-push init",
    description: "Installs the package and scaffolds a working demo in your Next.js app.",
    title: "1. Install",
  },
  {
    code: `'use client';
import { usePush } from "@piro0919/next-push";

const { subscribe, unsubscribe, subscription } = usePush();`,
    description:
      "SSR-safe hook: registers the SW, requests permission, and tracks subscription state.",
    title: "2. Use the hook",
  },
  {
    code: `import { sendPush } from "@piro0919/next-push/server";

await sendPush(subscription, {
  title: "Hello",
  body: "World",
  url: "/inbox",
});`,
    description: "Edge-runtime compatible sender with typed SendResult (ok / gone / retryable).",
    title: "3. Send a push",
  },
];

const DEFAULT_FORM = {
  title: "Test notification",
  body: "Hello from next-push!",
  icon: "/icon.svg",
  image: "",
  tag: "",
  url: "",
};

const ICON_PRESETS = [
  { label: "Brand", url: "/icon.svg" },
  { label: "Bell", url: "/demo/icon-bell.svg" },
  { label: "Chat", url: "/demo/icon-chat.svg" },
  { label: "Star", url: "/demo/icon-star.svg" },
];

const IMAGE_PRESETS = [
  { label: "None", url: "" },
  { label: "Sunset", url: "/demo/image-sunset.svg" },
  { label: "Ocean", url: "/demo/image-ocean.svg" },
  { label: "Forest", url: "/demo/image-forest.svg" },
];

function InfoTip({ text }: { text: string }): React.ReactNode {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent): void {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);
  return (
    <span className="group relative inline-flex" ref={wrapRef}>
      {/* biome-ignore lint/a11y/useSemanticElements: a <button> would be auto-disabled by the surrounding <fieldset disabled> wrapper, blocking tap-to-open on mobile before subscribe */}
      <span
        aria-expanded={open}
        aria-label={text}
        className="inline-flex h-4 w-4 cursor-help select-none items-center justify-center rounded-full border border-[color:var(--border)] text-[10px] leading-none text-[color:var(--muted)] hover:bg-[color:var(--surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        role="button"
        tabIndex={0}
      >
        i
      </span>
      <span
        className={`pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max max-w-[240px] -translate-x-1/2 rounded-md bg-[color:var(--foreground)] px-2 py-1 text-[11px] text-[color:var(--background)] leading-snug shadow-lg group-hover:block ${open ? "block" : "hidden"}`}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}

type SendApiResult =
  | { ok: true; statusCode: number }
  | { ok: false; gone: true; statusCode: 404 | 410 }
  | {
      ok: false;
      gone: false;
      statusCode?: number;
      message: string;
      retryable?: boolean;
      retryAfter?: number;
    }
  | { ok: false; httpStatus: number; error: string };

function SendResultBanner({ result }: { result: SendApiResult }): React.ReactNode {
  if (result.ok) {
    return (
      <p className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
        <strong>Accepted</strong> by the push service (HTTP {result.statusCode}). The notification
        should be on its way.
      </p>
    );
  }
  if ("gone" in result && result.gone) {
    return (
      <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 text-sm dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        <strong>Subscription expired</strong> (HTTP {result.statusCode}). Unsubscribe and subscribe
        again to get a fresh endpoint.
      </p>
    );
  }
  if ("httpStatus" in result) {
    const notSubscribed = result.httpStatus === 404;
    return (
      <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900 text-sm dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        <strong>
          {notSubscribed ? "Not subscribed" : `Request failed (HTTP ${result.httpStatus})`}
        </strong>
        : {result.error}
      </p>
    );
  }
  return (
    <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900 text-sm dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
      <strong>
        Send failed
        {result.statusCode ? ` (HTTP ${result.statusCode})` : ""}
      </strong>
      : {result.message}
      {result.retryable && (
        <span className="ml-1 text-xs opacity-80">
          — retryable{result.retryAfter ? ` in ${result.retryAfter}s` : ""}
        </span>
      )}
    </p>
  );
}

export default function HomePage() {
  // Demo uses Serwist on Turbopack, which serves the SW at /serwist/sw.js
  // instead of the default /sw.js. swScope: "/" is required for Firefox.
  const push = usePush({ swPath: "/serwist/sw.js", swScope: "/" });
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [lastResult, setLastResult] = useState<SendApiResult | null>(null);

  async function sendTest(): Promise<void> {
    if (!push.subscription) return;
    setSending(true);
    setLastResult(null);
    try {
      // The demo API reads the caller's subscription from the cookie set
      // during subscribe, so the body carries only the payload fields.
      const res = await fetch("/api/push", {
        body: JSON.stringify(form),
        method: "PUT",
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        const msg = (data && typeof data.error === "string" ? data.error : null) ?? res.statusText;
        setLastResult({ ok: false, httpStatus: res.status, error: msg });
      } else {
        setLastResult(data as SendApiResult);
      }
    } catch (e) {
      setLastResult({
        ok: false,
        httpStatus: 0,
        error: e instanceof Error ? e.message : "network error",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              alt="next-push icon"
              className="rounded-lg"
              height={36}
              src="/icon.svg"
              width={36}
            />
            <span className="font-semibold text-[color:var(--foreground)]">next-push</span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-[color:var(--muted)]">
            <a
              className="transition-colors hover:text-[color:var(--foreground)]"
              href="https://github.com/piro0919/next-push"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            <a
              className="transition-colors hover:text-[color:var(--foreground)]"
              href="https://www.npmjs.com/package/@piro0919/next-push"
              rel="noreferrer"
              target="_blank"
            >
              npm
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <section className="mb-12 text-center sm:mb-16">
          <div className="mb-6 inline-flex items-center justify-center">
            <Image
              alt="next-push icon"
              className="rounded-2xl shadow-lg"
              height={80}
              src="/icon.svg"
              width={80}
            />
          </div>
          <h1 className="mb-3 text-balance font-bold text-4xl tracking-tight sm:text-5xl">
            Web Push for Next.js
          </h1>
          <p className="mx-auto max-w-xl text-balance text-[color:var(--muted)] text-lg">
            React hooks, VAPID-signed sender, and Service Worker helpers — all from one
            TypeScript-first package.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 font-mono text-[color:var(--muted)]">
              @piro0919/next-push
            </span>
            <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1 text-[color:var(--muted)]">
              MIT
            </span>
          </div>
        </section>

        <section
          aria-labelledby="demo-heading"
          className="mb-16 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 sm:p-8"
        >
          <h2 className="mb-4 font-semibold text-xl" id="demo-heading">
            Live demo
          </h2>

          {!push.isSupported ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 text-sm dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              Web Push is not supported in this browser. On iOS, use the Share menu →{" "}
              <strong>Add to Home Screen</strong> and open this page from the home screen.
            </p>
          ) : push.permission === "denied" ? (
            <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900 text-sm dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              Notifications are blocked for this site. Enable them in your browser settings to try
              the demo.
            </p>
          ) : (
            <div>
              <div className="mb-5 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1">
                  Permission:{" "}
                  <strong className="font-mono text-[color:var(--foreground)]">
                    {push.permission}
                  </strong>
                </span>
                <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1">
                  Subscribed:{" "}
                  <strong
                    className={`font-mono ${push.subscription ? "text-emerald-600 dark:text-emerald-400" : "text-[color:var(--muted)]"}`}
                  >
                    {push.subscription ? "yes" : "no"}
                  </strong>
                </span>
              </div>

              <div className="mb-5 flex flex-wrap gap-3">
                {push.subscription ? (
                  <button
                    className="cursor-pointer rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2 font-medium text-sm transition-colors hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => push.unsubscribe()}
                    type="button"
                  >
                    Unsubscribe
                  </button>
                ) : (
                  <button
                    className="cursor-pointer rounded-lg bg-[color:var(--brand)] px-4 py-2 font-medium text-[color:var(--brand-foreground)] text-sm transition-colors hover:bg-[color:var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={push.isSubscribing}
                    onClick={() => push.subscribe()}
                    type="button"
                  >
                    {push.isSubscribing ? "Subscribing…" : "Subscribe"}
                  </button>
                )}
              </div>

              <fieldset
                className="mb-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4"
                disabled={!push.subscription}
              >
                <legend className="px-2 font-semibold text-sm">Notification payload</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="flex items-center gap-1.5 text-[color:var(--muted)]">
                      Title
                      <InfoTip text="Required. Main heading shown in bold at the top." />
                    </span>
                    <input
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm focus:border-[color:var(--brand)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Test notification"
                      type="text"
                      value={form.title}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="flex items-center gap-1.5 text-[color:var(--muted)]">
                      Body
                      <InfoTip text="Optional detail text shown under the title." />
                    </span>
                    <textarea
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm focus:border-[color:var(--brand)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                      placeholder="Hello from next-push!"
                      rows={2}
                      value={form.body}
                    />
                  </label>
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-1.5 text-[color:var(--muted)]">
                      Icon
                      <InfoTip text="Small square image next to the title. Same-origin or https URL." />
                    </span>
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {ICON_PRESETS.map((p) => (
                        <button
                          className={`cursor-pointer rounded-md border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            form.icon === p.url
                              ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-[color:var(--brand-foreground)]"
                              : "border-[color:var(--border)] bg-[color:var(--surface)] hover:bg-[color:var(--background)]"
                          }`}
                          key={p.url}
                          onClick={() => setForm((f) => ({ ...f, icon: p.url }))}
                          type="button"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <input
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm focus:border-[color:var(--brand)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                      placeholder="/icon.svg or https://…"
                      type="text"
                      value={form.icon}
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-1.5 text-[color:var(--muted)]">
                      Image
                      <InfoTip text="Large hero banner shown below the body. Chrome/Android only — ignored by Firefox and Safari." />
                    </span>
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {IMAGE_PRESETS.map((p) => (
                        <button
                          className={`cursor-pointer rounded-md border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            form.image === p.url
                              ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-[color:var(--brand-foreground)]"
                              : "border-[color:var(--border)] bg-[color:var(--surface)] hover:bg-[color:var(--background)]"
                          }`}
                          key={p.label}
                          onClick={() => setForm((f) => ({ ...f, image: p.url }))}
                          type="button"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <input
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm focus:border-[color:var(--brand)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                      placeholder="https://… or blank"
                      type="text"
                      value={form.image}
                    />
                  </div>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-1.5 text-[color:var(--muted)]">
                      Tag
                      <InfoTip text="Groups notifications. A new one with the same tag replaces the previous instead of stacking." />
                    </span>
                    <input
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm focus:border-[color:var(--brand)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                      placeholder="e.g. news"
                      type="text"
                      value={form.tag}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-1.5 text-[color:var(--muted)]">
                      Click URL
                      <InfoTip text="Where to navigate when the notification is clicked. Relative (/inbox) or absolute." />
                    </span>
                    <input
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm focus:border-[color:var(--brand)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                      placeholder="/inbox"
                      type="text"
                      value={form.url}
                    />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    className="cursor-pointer rounded-lg bg-[color:var(--brand)] px-4 py-2 font-medium text-[color:var(--brand-foreground)] text-sm transition-colors hover:bg-[color:var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!push.subscription || sending}
                    onClick={sendTest}
                    type="button"
                  >
                    {sending ? "Sending…" : "Send notification"}
                  </button>
                  <button
                    className="cursor-pointer rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2 font-medium text-sm transition-colors hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => setForm(DEFAULT_FORM)}
                    type="button"
                  >
                    Reset
                  </button>
                  {!push.subscription && (
                    <span className="text-[color:var(--muted)] text-xs">
                      Subscribe first to enable sending.
                    </span>
                  )}
                </div>
                {lastResult && <SendResultBanner result={lastResult} />}
              </fieldset>

              {push.error && (
                <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900 text-sm dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                  {push.error.message}
                </p>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="quickstart-heading" className="mb-16">
          <h2 className="mb-6 font-semibold text-2xl" id="quickstart-heading">
            Quick start
          </h2>
          <div className="space-y-4">
            {QUICK_START_STEPS.map((step) => (
              <div
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
                key={step.title}
              >
                <h3 className="mb-1 font-semibold">{step.title}</h3>
                <p className="mb-3 text-[color:var(--muted)] text-sm">{step.description}</p>
                <pre className="overflow-x-auto rounded-lg bg-[color:var(--background)] p-3 font-mono text-xs leading-relaxed">
                  <code>{step.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:var(--border)]">
        <div className="mx-auto max-w-3xl px-6 py-6 text-[color:var(--muted)] text-sm">
          MIT ©{" "}
          <a
            className="transition-colors hover:text-[color:var(--foreground)]"
            href="https://github.com/piro0919"
            rel="noreferrer"
            target="_blank"
          >
            piro0919
          </a>
          {" · "}
          <a
            className="transition-colors hover:text-[color:var(--foreground)]"
            href="https://github.com/piro0919/next-push"
            rel="noreferrer"
            target="_blank"
          >
            source
          </a>
        </div>
      </footer>
    </div>
  );
}
