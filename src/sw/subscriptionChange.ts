import { base64UrlDecode } from "../core/base64";

export async function handleSubscriptionChange(
  event: Event,
  options: { vapidPublicKey: string; apiPath?: string },
): Promise<void> {
  const apiPath = options.apiPath ?? "/api/push";
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
  const work = fetch(apiPath, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(newSub.toJSON()),
  });
  const evt = event as unknown as { waitUntil?: (p: Promise<unknown>) => void };
  evt.waitUntil?.(work);
  await work;
}
