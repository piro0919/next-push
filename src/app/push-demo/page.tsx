"use client";
import { useState } from "react";
import { usePush } from "../../client";

export default function PushDemoPage() {
  // Demo uses Serwist on Turbopack, which serves the SW at /serwist/sw.js
  // instead of the default /sw.js. End users of the library who use the
  // `next-push init` template will get public/sw.js and can omit swPath.
  const push = usePush({ swPath: "/serwist/sw.js" });
  const [sending, setSending] = useState(false);

  async function sendTest() {
    setSending(true);
    try {
      await fetch("/api/push", {
        method: "PUT",
        body: JSON.stringify({ title: "Test", body: "Hello!" }),
      });
    } finally {
      setSending(false);
    }
  }

  if (!push.isSupported) return <p>Web Push is not supported in this browser.</p>;
  if (push.permission === "denied") return <p>Notifications are blocked.</p>;

  return (
    <main style={{ padding: 24 }}>
      <h1>next-push demo</h1>
      <p>
        Permission: <strong>{push.permission}</strong>
      </p>
      <p>
        Subscribed: <strong>{push.subscription ? "yes" : "no"}</strong>
      </p>
      <div style={{ display: "flex", gap: 8 }}>
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
          Send test
        </button>
      </div>
      {push.error && <p style={{ color: "crimson" }}>{push.error.message}</p>}
    </main>
  );
}
