"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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
  /** Optional user id sent as `userId` in the POST body.
   *
   *  SECURITY: this value is NOT trusted by `createPushHandler`. The server
   *  resolves the user itself through its `getUserId` option (e.g. from the
   *  session) and only uses the body value as a consistency check: a
   *  mismatch, or any `userId` when `getUserId` is not configured, is
   *  rejected with 403. You normally do not need to pass this at all. If you
   *  run your own backend, never store a subscription under a user id taken
   *  from the request body. */
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

interface SharedState {
  permission: NotificationPermission;
  subscription: PushSubscriptionJSON | null;
}

// Subscription state lives outside React so every usePush() instance that
// points at the same Service Worker sees the same value. Keyed like the SW
// registration cache, since a subscription belongs to a registration.
const SERVER_STATE: SharedState = { permission: "default", subscription: null };
const stores = new Map<string, { state: SharedState; listeners: Set<() => void> }>();

function getStore(key: string) {
  let store = stores.get(key);
  if (!store) {
    store = { state: SERVER_STATE, listeners: new Set() };
    stores.set(key, store);
  }
  return store;
}

function setShared(key: string, patch: Partial<SharedState>): void {
  const store = getStore(key);
  const next = { ...store.state, ...patch };
  if (
    next.permission === store.state.permission &&
    sameSubscription(next.subscription, store.state.subscription)
  ) {
    return;
  }
  store.state = next;
  for (const listener of store.listeners) listener();
}

function sameSubscription(a: PushSubscriptionJSON | null, b: PushSubscriptionJSON | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.endpoint === b.endpoint && a.keys.p256dh === b.keys.p256dh && a.keys.auth === b.keys.auth
  );
}

function cacheKeyFor(swPath: string, swScope?: string): string {
  return swScope ? `${swPath}|${swScope}` : swPath;
}

function detectSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

const subscribeNoop = () => () => {};
const getServerSupport = () => false;

/** @internal — resets the cached SW registration promise and shared state (for testing only) */
export function _resetSwRegistration(): void {
  swRegistrations.clear();
  stores.clear();
}

function getOrRegisterSW(swPath: string, swScope?: string): Promise<ServiceWorkerRegistration> {
  const cacheKey = cacheKeyFor(swPath, swScope);
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

  const key = cacheKeyFor(swPath, swScope);

  const isSupported = useSyncExternalStore(subscribeNoop, detectSupport, getServerSupport);
  const subscribeStore = useCallback(
    (listener: () => void) => {
      const store = getStore(key);
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    [key],
  );
  const getSnapshot = useCallback(() => getStore(key).state, [key]);
  const { permission, subscription } = useSyncExternalStore(
    subscribeStore,
    getSnapshot,
    () => SERVER_STATE,
  );
  // In-flight flag and last error are per instance: they describe the action
  // this component started, not the shared subscription.
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isSupported) return;

    setShared(key, { permission: Notification.permission });

    let ignore = false;
    void (async () => {
      try {
        const reg = await getOrRegisterSW(swPath, swScope);
        const sub = await reg.pushManager.getSubscription();
        if (!ignore) {
          setShared(key, {
            subscription: sub ? (sub.toJSON() as PushSubscriptionJSON) : null,
          });
        }
      } catch (e) {
        if (!ignore) setError(e instanceof Error ? e : new Error(String(e)));
      }
    })();
    return () => {
      ignore = true;
    };
  }, [isSupported, key, swPath, swScope]);

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
      setShared(key, { permission: perm });
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
      setShared(key, { subscription: subJson });
      return subJson;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsSubscribing(false);
    }
  }, [vapidPublicKey, apiUrl, key, swPath, swScope, userId]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    try {
      const reg = await getOrRegisterSW(swPath, swScope);
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        // The browser side is gone either way, so reflect that before
        // reporting a server failure: the user is not subscribed any more.
        setShared(key, { subscription: null });
        const res = await fetch(`${apiUrl}?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`Unsubscribe DELETE failed: ${res.status}`);
      }
      setShared(key, { subscription: null });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    }
  }, [apiUrl, key, swPath, swScope]);

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
