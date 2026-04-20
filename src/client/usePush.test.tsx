import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePush } from "./usePush";

describe("usePush", () => {
  const originalNav = globalThis.navigator;
  const originalWindow = globalThis.window;
  const originalNotification = (globalThis as unknown as { Notification: unknown }).Notification;

  beforeEach(() => {
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue({
          toJSON: () => ({
            endpoint: "https://ep",
            keys: { p256dh: "p", auth: "a" },
          }),
        }),
      },
    };
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        serviceWorker: {
          register: vi.fn().mockResolvedValue(registration),
          ready: Promise.resolve(registration),
        },
      },
    });
    (globalThis as unknown as { window: unknown }).window = globalThis;
    (globalThis as unknown as { PushManager: unknown }).PushManager = class {};
    (globalThis as unknown as { Notification: unknown }).Notification = {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    };
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNav,
    });
    (globalThis as unknown as { window: unknown }).window = originalWindow;
    (globalThis as unknown as { Notification: unknown }).Notification = originalNotification;
  });

  it("reports isSupported=true when SW and Notification are available", async () => {
    const { result } = renderHook(() =>
      usePush({
        vapidPublicKey: "BXYZ_dummy_public_key_base64url_abcdef0123456789",
      }),
    );
    await waitFor(() => expect(result.current.isSupported).toBe(true));
  });

  it("subscribe requests permission, subscribes, and POSTs subscription", async () => {
    const { result } = renderHook(() =>
      usePush({
        vapidPublicKey: "BXYZ_dummy_public_key_base64url_abcdef0123456789",
      }),
    );
    await waitFor(() => expect(result.current.isSupported).toBe(true));

    await act(async () => {
      await result.current.subscribe();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/push",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.subscription).toEqual({
      endpoint: "https://ep",
      keys: { p256dh: "p", auth: "a" },
    });
  });

  it("exposes error when vapidPublicKey is missing", async () => {
    const { result } = renderHook(() => usePush({}));
    await waitFor(() => expect(result.current.isSupported).toBe(true));
    await expect(
      act(async () => {
        await result.current.subscribe();
      }),
    ).rejects.toThrow(/vapidPublicKey/);
  });
});
