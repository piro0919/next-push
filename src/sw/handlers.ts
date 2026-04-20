import type { PushPayload } from "../core/types";

type PushHandler = (payload: unknown) => NotificationOptions & { title: string };

export function handlePush(event: PushEvent, handler?: PushHandler): void {
  let payload: unknown;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = { title: event.data?.text() ?? "Notification" };
  }

  const spec = handler ? handler(payload) : defaultNotificationSpec(payload as PushPayload | null);

  const { title, ...options } = spec;
  const reg = (self as unknown as { registration: ServiceWorkerRegistration }).registration;
  event.waitUntil(reg.showNotification(title, options));
}

function defaultNotificationSpec(p: PushPayload | null): NotificationOptions & { title: string } {
  return {
    title: p?.title ?? "Notification",
    body: p?.body,
    icon: p?.icon,
    badge: p?.badge,
    image: p?.image,
    tag: p?.tag,
    data: { url: p?.url ?? "/", raw: p?.data },
    actions: p?.actions,
  };
}

type ClickHandler = (data: unknown, notification: Notification) => string | null;

export async function handleClick(event: NotificationEvent, handler?: ClickHandler): Promise<void> {
  const notification = event.notification;
  notification.close();

  const url = handler
    ? handler(notification.data, notification)
    : ((notification.data as { url?: string } | null)?.url ?? "/");

  if (!url) return;

  event.waitUntil(focusOrOpen(url));
}

async function focusOrOpen(relativeUrl: string): Promise<void> {
  const swSelf = self as unknown as { location?: Location };
  const origin = swSelf.location?.origin ?? "";
  const absoluteUrl = new URL(relativeUrl, origin).toString();
  const cls = (globalThis as unknown as { clients: Clients }).clients;
  const windowClients = (await cls.matchAll({
    type: "window",
    includeUncontrolled: true,
  })) as WindowClient[];
  for (const client of windowClients) {
    if (client.url === absoluteUrl) {
      await client.focus();
      return;
    }
  }
  await cls.openWindow(relativeUrl);
}

export function handleClose(
  event: NotificationEvent,
  handler: (notification: Notification) => void | Promise<void>,
): void {
  event.waitUntil(Promise.resolve(handler(event.notification)));
}
