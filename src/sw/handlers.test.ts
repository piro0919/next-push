import { describe, expect, it, vi } from "vitest";
import { handleClick, handlePush } from "./handlers";

describe("handlePush", () => {
  it("calls showNotification with parsed payload", () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    (globalThis as unknown as { self: unknown }).self = {
      registration: { showNotification },
    };
    const waitUntil = vi.fn();
    const event = {
      data: { json: () => ({ title: "hi", body: "there", url: "/chat" }) },
      waitUntil,
    } as unknown as PushEvent;

    handlePush(event);

    expect(waitUntil).toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith(
      "hi",
      expect.objectContaining({
        body: "there",
        data: expect.objectContaining({ url: "/chat" }),
      }),
    );
  });

  it("supports custom handler", () => {
    const showNotification = vi.fn();
    (globalThis as unknown as { self: unknown }).self = {
      registration: { showNotification },
    };
    const event = {
      data: { json: () => ({ type: "chat", who: "alice" }) },
      waitUntil: vi.fn(),
    } as unknown as PushEvent;

    handlePush(event, (p) => ({
      title: `Message from ${(p as { who: string }).who}`,
      body: "",
    }));

    expect(showNotification).toHaveBeenCalledWith(
      "Message from alice",
      expect.objectContaining({ body: "" }),
    );
  });

  it("falls back when data is missing", () => {
    const showNotification = vi.fn();
    (globalThis as unknown as { self: unknown }).self = {
      registration: { showNotification },
    };
    const event = { data: null, waitUntil: vi.fn() } as unknown as PushEvent;

    handlePush(event);

    expect(showNotification).toHaveBeenCalledWith("Notification", expect.any(Object));
  });

  it("uses defaultNotification fallback when payload is missing fields", () => {
    const showNotification = vi.fn();
    (globalThis as unknown as { self: unknown }).self = {
      registration: { showNotification },
    };
    const event = {
      data: { json: () => ({ title: "hi", body: "there" }) },
      waitUntil: vi.fn(),
    } as unknown as PushEvent;

    handlePush(event, undefined, {
      icon: "/default-icon.png",
      badge: "/default-badge.png",
    });

    expect(showNotification).toHaveBeenCalledWith(
      "hi",
      expect.objectContaining({
        body: "there",
        icon: "/default-icon.png",
        badge: "/default-badge.png",
      }),
    );
  });

  it("payload icon wins over defaultNotification", () => {
    const showNotification = vi.fn();
    (globalThis as unknown as { self: unknown }).self = {
      registration: { showNotification },
    };
    const event = {
      data: { json: () => ({ title: "hi", icon: "/payload-icon.png" }) },
      waitUntil: vi.fn(),
    } as unknown as PushEvent;

    handlePush(event, undefined, { icon: "/default-icon.png" });

    expect(showNotification).toHaveBeenCalledWith(
      "hi",
      expect.objectContaining({ icon: "/payload-icon.png" }),
    );
  });
});

describe("handlePush custom handler error fallback", () => {
  it("falls back to default notification spec when custom handler throws", () => {
    const showNotification = vi.fn();
    (globalThis as unknown as { self: unknown }).self = {
      registration: { showNotification },
    };
    const event = {
      data: { json: () => ({ title: "orig", body: "body", url: "/page" }) },
      waitUntil: vi.fn(),
    } as unknown as PushEvent;

    handlePush(event, () => {
      throw new Error("handler exploded");
    });

    // Should fall back to the default spec derived from the parsed payload
    expect(showNotification).toHaveBeenCalledWith(
      "orig",
      expect.objectContaining({ body: "body" }),
    );
  });
});

describe("handleClick", () => {
  it("opens a new window with absolute url from notification data", async () => {
    const openWindow = vi.fn().mockResolvedValue(null);
    const matchAll = vi.fn().mockResolvedValue([]);
    (globalThis as unknown as { clients: unknown; self: unknown }).clients = {
      openWindow,
      matchAll,
    };
    (globalThis as unknown as { self: unknown }).self = {
      location: { origin: "http://localhost" },
    };

    const close = vi.fn();
    const event = {
      notification: { close, data: { url: "/chat/1" } },
      waitUntil: (p: Promise<unknown>) => p,
    } as unknown as NotificationEvent;

    await handleClick(event);

    expect(close).toHaveBeenCalled();
    // focusOrOpen should pass the absolute URL to openWindow
    expect(openWindow).toHaveBeenCalledWith("http://localhost/chat/1");
  });

  it("focuses existing window if same url is open", async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const openWindow = vi.fn();
    const matchAll = vi.fn().mockResolvedValue([{ url: "http://localhost/chat/1", focus }]);
    (globalThis as unknown as { clients: unknown; self: unknown }).clients = {
      openWindow,
      matchAll,
    };
    (globalThis as unknown as { self: unknown }).self = {
      location: { origin: "http://localhost" },
    };

    const event = {
      notification: { close: vi.fn(), data: { url: "/chat/1" } },
      waitUntil: (p: Promise<unknown>) => p,
    } as unknown as NotificationEvent;

    await handleClick(event);

    expect(focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });
});
