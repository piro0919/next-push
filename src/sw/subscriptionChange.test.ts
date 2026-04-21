import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleSubscriptionChange } from "./subscriptionChange";

describe("handleSubscriptionChange", () => {
  let subscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    subscribe = vi.fn().mockResolvedValue({
      toJSON: () => ({
        endpoint: "https://new/ep",
        keys: { p256dh: "p", auth: "a" },
      }),
    });
    (globalThis as unknown as { self: unknown }).self = {
      registration: { pushManager: { subscribe } },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
  });

  it("re-subscribes and POSTs new subscription to apiPath", async () => {
    await handleSubscriptionChange({ waitUntil: (p: Promise<unknown>) => p } as unknown as Event, {
      // simple valid base64url encoding of 65 bytes: use real VAPID-style key
      // here we pass a short placeholder; base64UrlDecode will produce whatever bytes
      vapidPublicKey:
        "q6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6s",
      apiPath: "/api/push",
    });
    expect(subscribe).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/push",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("defaults apiPath to /api/push", async () => {
    await handleSubscriptionChange({ waitUntil: (p: Promise<unknown>) => p } as unknown as Event, {
      vapidPublicKey:
        "q6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6s",
    });
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/push", expect.any(Object));
  });

  it("resolves without throwing when pushManager.subscribe throws, and does not call fetch", async () => {
    subscribe.mockRejectedValue(new Error("subscribe failed"));

    await expect(
      handleSubscriptionChange({ waitUntil: (p: Promise<unknown>) => p } as unknown as Event, {
        vapidPublicKey:
          "q6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6s",
        apiPath: "/api/push",
      }),
    ).resolves.toBeUndefined();

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
