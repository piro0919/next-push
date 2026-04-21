import { type DefaultNotification, handleClick, handleClose, handlePush } from "./handlers";
import { handleSubscriptionChange } from "./subscriptionChange";

export interface RegisterAllOptions {
  vapidPublicKey: string;
  apiPath?: string;
  onPush?: (payload: unknown) => NotificationOptions & { title: string };
  onClick?: (data: unknown, notification: Notification) => string | null;
  onClose?: (notification: Notification) => void | Promise<void>;
  defaultNotification?: DefaultNotification;
}

export function registerAll(options: RegisterAllOptions): void {
  const sw = self as unknown as ServiceWorkerGlobalScope;
  sw.addEventListener("push", (event) =>
    handlePush(event as PushEvent, options.onPush, options.defaultNotification),
  );
  sw.addEventListener("notificationclick", (event) =>
    handleClick(event as NotificationEvent, options.onClick),
  );
  if (options.onClose) {
    const onClose = options.onClose;
    sw.addEventListener("notificationclose", (event) =>
      handleClose(event as NotificationEvent, onClose),
    );
  }
  sw.addEventListener("pushsubscriptionchange", (event) =>
    handleSubscriptionChange(event as Event, {
      vapidPublicKey: options.vapidPublicKey,
      apiPath: options.apiPath,
    }),
  );
}
