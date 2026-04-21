"use client";
import { useState } from "react";
import { usePush } from "../client";

export default function HomePage() {
  // Demo uses Serwist on Turbopack, which serves the SW at /serwist/sw.js
  // instead of the default /sw.js. End users of the library who use the
  // `next-push init` template will get public/sw.js and can omit swPath.
  // swScope: "/" is required for Firefox — without it, Firefox restricts the SW
  // to the /serwist/ scope and rejects pushManager calls from the root.
  const push = usePush({ swPath: "/serwist/sw.js", swScope: "/" });
  const [sending, setSending] = useState(false);

  async function sendTest() {
    setSending(true);
    try {
      await fetch("/api/push", {
        method: "PUT",
        body: JSON.stringify({ title: "Test", body: "Hello from next-push!" }),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        margin: "0 auto",
        maxWidth: 640,
        padding: 24,
      }}
    >
      <h1 style={{ marginBottom: 0 }}>next-push</h1>
      <p style={{ color: "#6b7280", marginTop: 4 }}>
        Web Push notifications for Next.js — live demo.{" "}
        <a href="https://github.com/piro0919/next-push">GitHub</a> ·{" "}
        <a href="https://www.npmjs.com/package/@piro0919/next-push">npm</a>
      </p>

      {!push.isSupported ? (
        <p style={{ background: "#fef3c7", borderRadius: 8, padding: 16 }}>
          Web Push is not supported in this browser. On iOS, install this page as a PWA (Share → Add
          to Home Screen) and open it from the home screen.
        </p>
      ) : push.permission === "denied" ? (
        <p style={{ background: "#fee2e2", borderRadius: 8, padding: 16 }}>
          Notifications are blocked for this site. Enable them in your browser settings to try the
          demo.
        </p>
      ) : (
        <section
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            marginTop: 24,
            padding: 24,
          }}
        >
          <p style={{ display: "flex", flexWrap: "wrap", gap: 16, margin: 0 }}>
            <span>
              Permission: <strong>{push.permission}</strong>
            </span>
            <span>
              Subscribed: <strong>{push.subscription ? "yes" : "no"}</strong>
            </span>
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            {push.subscription ? (
              <button type="button" onClick={() => push.unsubscribe()}>
                Unsubscribe
              </button>
            ) : (
              <button type="button" onClick={() => push.subscribe()} disabled={push.isSubscribing}>
                Subscribe
              </button>
            )}
            <button type="button" onClick={sendTest} disabled={!push.subscription || sending}>
              Send test notification
            </button>
          </div>
          {push.error && <p style={{ color: "#dc2626", marginTop: 16 }}>{push.error.message}</p>}
        </section>
      )}
    </main>
  );
}
