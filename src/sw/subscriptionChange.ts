import { base64UrlDecode } from "../core/base64";

export async function handleSubscriptionChange(
  event: Event,
  options: { vapidPublicKey: string; apiPath?: string },
): Promise<void> {
  const apiPath = options.apiPath ?? "/api/push";
  const work = (async () => {
    try {
      const applicationServerKey = base64UrlDecode(options.vapidPublicKey);
      const swSelf = self as unknown as {
        registration: {
          pushManager: {
            subscribe: (opts: {
              userVisibleOnly: boolean;
              applicationServerKey: Uint8Array;
            }) => Promise<PushSubscription>;
          };
        };
      };
      const newSub = await swSelf.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      await fetch(apiPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(newSub.toJSON()),
      });
    } catch (e) {
      console.error("[next-push] pushsubscriptionchange failed:", e);
    }
  })();
  const evt = event as unknown as { waitUntil?: (p: Promise<unknown>) => void };
  evt.waitUntil?.(work);
  // Keep the await so callers can await the handler; errors are swallowed inside
  await work;
}
