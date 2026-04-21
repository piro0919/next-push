"use client";
import Image from "next/image";
import { useState } from "react";
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

export default function HomePage() {
  // Demo uses Serwist on Turbopack, which serves the SW at /serwist/sw.js
  // instead of the default /sw.js. swScope: "/" is required for Firefox.
  const push = usePush({ swPath: "/serwist/sw.js", swScope: "/" });
  const [sending, setSending] = useState(false);

  async function sendTest(): Promise<void> {
    setSending(true);
    try {
      await fetch("/api/push", {
        body: JSON.stringify({ body: "Hello from next-push!", title: "Test notification" }),
        method: "PUT",
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

              <div className="flex flex-wrap gap-3">
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
                <button
                  className="cursor-pointer rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2 font-medium text-sm transition-colors hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!push.subscription || sending}
                  onClick={sendTest}
                  type="button"
                >
                  {sending ? "Sending…" : "Send test notification"}
                </button>
              </div>

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
