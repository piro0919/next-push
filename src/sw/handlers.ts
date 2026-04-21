import type { PushPayload } from "../core/types";

// `image` and `actions` are valid browser fields but not in all TS lib versions of NotificationOptions
type NotificationSpec = NotificationOptions & {
  title: string;
  image?: string;
  actions?: Array<{ action: string; title: string; icon?: string }>;
};

type PushHandler = (payload: unknown) => NotificationSpec;

export interface DefaultNotification {
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
}

export function handlePush(
  event: PushEvent,
  handler?: PushHandler,
  defaults?: DefaultNotification,
): void {
  let payload: unknown;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = { title: event.data?.text() ?? "Notification" };
  }

  let spec: NotificationSpec;
  if (handler) {
    try {
      spec = handler(payload);
    } catch (e) {
      console.error("[next-push] handlePush: custom handler threw, falling back to default:", e);
      spec = defaultNotificationSpec(payload as PushPayload | null, defaults);
    }
  } else {
    spec = defaultNotificationSpec(payload as PushPayload | null, defaults);
  }

  const { title, ...options } = spec;
  const reg = (self as unknown as { registration: ServiceWorkerRegistration }).registration;
  event.waitUntil(reg.showNotification(title, options));
}

function defaultNotificationSpec(
  p: PushPayload | null,
  defaults?: DefaultNotification,
): NotificationSpec {
  return {
    title: p?.title ?? "Notification",
    body: p?.body,
    icon: p?.icon ?? defaults?.icon,
    badge: p?.badge ?? defaults?.badge,
    image: p?.image ?? defaults?.image,
    tag: p?.tag ?? defaults?.tag,
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
  await cls.openWindow(absoluteUrl);
}

export function handleClose(
  event: NotificationEvent,
  handler: (notification: Notification) => void | Promise<void>,
): void {
  event.waitUntil(Promise.resolve(handler(event.notification)));
}
