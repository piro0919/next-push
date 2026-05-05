"use client";
import { useCallback, useEffect, useState } from "react";
import { base64UrlDecode } from "../core/base64";
import type { PushSubscriptionJSON } from "../core/types";

export interface UsePushOptions {
  vapidPublicKey?: string;
  /** Same-origin path the hook POSTs / DELETEs subscription requests to.
   *  Defaults to `/api/push`. Use `apiBase` instead when targeting a different
   *  origin (e.g. a hosted SaaS endpoint). */
  apiPath?: string;
  /** Full URL (or absolute path) for subscription requests. When set, this
   *  takes precedence over `apiPath` and is used verbatim — no suffix is
   *  appended. Useful for pointing the hook at a hosted Push SaaS endpoint
   *  such as `https://nesh.example.com/api/v1/projects/<id>`. */
  apiBase?: string;
  swPath?: string;
  /** Override the Service Worker registration scope (e.g. "/" when the SW is
   *  served from a sub-path like /serwist/sw.js). Requires the server to send
   *  a `Service-Worker-Allowed: /` response header for the SW script. */
  swScope?: string;
  /** Optional external user identifier sent alongside the subscription.
   *  Lets the backend target notifications by your application's user id
   *  instead of by raw push endpoint. Sent as `userId` in the POST body. */
  userId?: string;
}

export interface UsePushReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  subscription: PushSubscriptionJSON | null;
  isSubscribing: boolean;
  error: Error | null;
  subscribe(): Promise<PushSubscriptionJSON>;
  unsubscribe(): Promise<void>;
}

const swRegistrations = new Map<string, Promise<ServiceWorkerRegistration>>();

/** @internal — resets the cached SW registration promise (for testing only) */
export function _resetSwRegistration(): void {
  swRegistrations.clear();
}

function getOrRegisterSW(swPath: string, swScope?: string): Promise<ServiceWorkerRegistration> {
  const cacheKey = swScope ? `${swPath}|${swScope}` : swPath;
  const cached = swRegistrations.get(cacheKey);
  if (cached) return cached;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.reject(new Error("Service Worker not supported"));
  }
  const registerOptions = swScope ? { scope: swScope } : undefined;
  const promise = navigator.serviceWorker
    .register(swPath, registerOptions)
    .then((reg) => {
      // Wait for the SW to become active before returning, because
      // PushManager.subscribe() requires an active Service Worker.
      if (reg.active) return reg;
      return new Promise<ServiceWorkerRegistration>((resolve, reject) => {
        const sw = reg.installing ?? reg.waiting;
        if (!sw) {
          // Already active via a different path — use navigator.serviceWorker.ready
          navigator.serviceWorker.ready.then(resolve).catch(reject);
          return;
        }
        sw.addEventListener("statechange", function handler() {
          if (sw.state === "activated") {
            sw.removeEventListener("statechange", handler);
            resolve(reg);
          } else if (sw.state === "redundant") {
            sw.removeEventListener("statechange", handler);
            reject(new Error("Service Worker became redundant"));
          }
        });
      });
    })
    .catch((e) => {
      swRegistrations.delete(cacheKey);
      throw e;
    });
  swRegistrations.set(cacheKey, promise);
  return promise;
}

export function usePush(options: UsePushOptions = {}): UsePushReturn {
  const vapidPublicKey =
    options.vapidPublicKey ??
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : undefined);
  const apiPath = options.apiPath ?? "/api/push";
  const apiUrl = options.apiBase ?? apiPath;
  const swPath = options.swPath ?? "/sw.js";
  const swScope = options.swScope;
  const userId = options.userId;

  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscriptionJSON | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (!supported) return;

    setPermission(Notification.permission);

    let ignore = false;
    void (async () => {
      try {
        const reg = await getOrRegisterSW(swPath, swScope);
        const sub = await reg.pushManager.getSubscription();
        if (!ignore && sub) setSubscription(sub.toJSON() as PushSubscriptionJSON);
      } catch (e) {
        if (!ignore) setError(e instanceof Error ? e : new Error(String(e)));
      }
    })();
    return () => {
      ignore = true;
    };
  }, [swPath, swScope]);

  const subscribe = useCallback(async (): Promise<PushSubscriptionJSON> => {
    if (!vapidPublicKey) {
      const err = new Error(
        "vapidPublicKey missing. Pass it to usePush or set NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      );
      setError(err);
      throw err;
    }
    setIsSubscribing(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") throw new Error(`Permission ${perm}`);
      const reg = await getOrRegisterSW(swPath, swScope);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlDecode(vapidPublicKey).buffer as ArrayBuffer,
      });
      const subJson = sub.toJSON() as PushSubscriptionJSON;
      try {
        const body = userId ? { ...subJson, userId } : subJson;
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Subscribe POST failed: ${res.status}`);
      } catch (e) {
        // Roll back the browser-side subscription so the user can retry cleanly
        await sub.unsubscribe().catch(() => {});
        throw e;
      }
      setSubscription(subJson);
      return subJson;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsSubscribing(false);
    }
  }, [vapidPublicKey, apiUrl, swPath, swScope, userId]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    try {
      const reg = await getOrRegisterSW(swPath, swScope);
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch(`${apiUrl}?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: "DELETE",
        });
      }
      setSubscription(null);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    }
  }, [apiUrl, swPath, swScope]);

  return {
    isSupported,
    permission,
    subscription,
    isSubscribing,
    error,
    subscribe,
    unsubscribe,
  };
}
