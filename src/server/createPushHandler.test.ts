import { describe, expect, it, vi } from "vitest";
import { createPushHandler } from "./createPushHandler";

describe("createPushHandler", () => {
  it("POST calls onSubscribe and returns 201", async () => {
    const onSubscribe = vi.fn();
    const onUnsubscribe = vi.fn();
    const { POST } = createPushHandler({ onSubscribe, onUnsubscribe });
    const body = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "p", auth: "a" },
    };
    const req = new Request("http://localhost/api/push", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(onSubscribe).toHaveBeenCalledWith(body, req, undefined);
  });

  describe("user identity", () => {
    const sub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "p", auth: "a" },
    };
    const post = (body: unknown) =>
      new Request("http://localhost/api/push", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      });

    it("rejects a body userId with 403 when no getUserId is configured", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const onSubscribe = vi.fn();
      const { POST } = createPushHandler({ onSubscribe, onUnsubscribe: vi.fn() });
      const res = await POST(post({ ...sub, userId: "user-42" }));
      expect(res.status).toBe(403);
      expect(onSubscribe).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it("uses the server-resolved userId even when the client sends none", async () => {
      const onSubscribe = vi.fn();
      const getUserId = vi.fn().mockResolvedValue("session-user");
      const { POST } = createPushHandler({ onSubscribe, onUnsubscribe: vi.fn(), getUserId });
      const req = post(sub);
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(getUserId).toHaveBeenCalledWith(req);
      expect(onSubscribe).toHaveBeenCalledWith(sub, req, { userId: "session-user" });
    });

    it("accepts a body userId that matches the resolved one", async () => {
      const onSubscribe = vi.fn();
      const { POST } = createPushHandler({
        onSubscribe,
        onUnsubscribe: vi.fn(),
        getUserId: () => "user-42",
      });
      const req = post({ ...sub, userId: "user-42" });
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(onSubscribe).toHaveBeenCalledWith(sub, req, { userId: "user-42" });
    });

    it("rejects a body userId that differs from the resolved one with 403", async () => {
      const onSubscribe = vi.fn();
      const { POST } = createPushHandler({
        onSubscribe,
        onUnsubscribe: vi.fn(),
        getUserId: () => "attacker",
      });
      const res = await POST(post({ ...sub, userId: "victim" }));
      expect(res.status).toBe(403);
      expect(onSubscribe).not.toHaveBeenCalled();
    });

    it("rejects a body userId with 403 when the visitor has no session", async () => {
      const onSubscribe = vi.fn();
      const { POST } = createPushHandler({
        onSubscribe,
        onUnsubscribe: vi.fn(),
        getUserId: async () => null,
      });
      const res = await POST(post({ ...sub, userId: "victim" }));
      expect(res.status).toBe(403);
      expect(onSubscribe).not.toHaveBeenCalled();
    });

    it("registers anonymously when getUserId returns null and no userId is sent", async () => {
      const onSubscribe = vi.fn();
      const { POST } = createPushHandler({
        onSubscribe,
        onUnsubscribe: vi.fn(),
        getUserId: () => null,
      });
      const req = post(sub);
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(onSubscribe).toHaveBeenCalledWith(sub, req, undefined);
    });

    it("returns 500 when getUserId throws", async () => {
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      const { POST } = createPushHandler({
        onSubscribe: vi.fn(),
        onUnsubscribe: vi.fn(),
        getUserId: () => {
          throw new Error("session store down");
        },
      });
      const res = await POST(post(sub));
      expect(res.status).toBe(500);
      err.mockRestore();
    });

    it("passes the resolved userId to onUnsubscribe", async () => {
      const onUnsubscribe = vi.fn();
      const { DELETE } = createPushHandler({
        onSubscribe: vi.fn(),
        onUnsubscribe,
        getUserId: () => "session-user",
      });
      const req = new Request(
        "http://localhost/api/push?endpoint=https%3A%2F%2Ffcm.googleapis.com%2Ffcm%2Fsend%2Fabc",
        { method: "DELETE" },
      );
      const res = await DELETE(req);
      expect(res.status).toBe(204);
      expect(onUnsubscribe).toHaveBeenCalledWith("https://fcm.googleapis.com/fcm/send/abc", req, {
        userId: "session-user",
      });
    });
  });

  it("POST returns 400 on malformed JSON", async () => {
    const onSubscribe = vi.fn();
    const { POST } = createPushHandler({ onSubscribe, onUnsubscribe: vi.fn() });
    for (const body of ["{not json", "null", "[]", '"str"']) {
      const req = new Request("http://localhost/api/push", {
        method: "POST",
        body,
        headers: { "content-type": "application/json" },
      });
      const res = await POST(req);
      expect(res.status, body).toBe(400);
    }
    expect(onSubscribe).not.toHaveBeenCalled();
  });

  it("POST returns 400 on invalid body", async () => {
    const { POST } = createPushHandler({
      onSubscribe: vi.fn(),
      onUnsubscribe: vi.fn(),
    });
    const req = new Request("http://localhost/api/push", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("DELETE with endpoint query param returns 204", async () => {
    const onUnsubscribe = vi.fn();
    const { DELETE } = createPushHandler({
      onSubscribe: vi.fn(),
      onUnsubscribe,
    });
    const req = new Request(
      "http://localhost/api/push?endpoint=https%3A%2F%2Ffcm.googleapis.com%2Ffcm%2Fsend%2Fabc",
      { method: "DELETE" },
    );
    const res = await DELETE(req);
    expect(res.status).toBe(204);
    expect(onUnsubscribe).toHaveBeenCalledWith(
      "https://fcm.googleapis.com/fcm/send/abc",
      req,
      undefined,
    );
  });

  it("DELETE with endpoint in JSON body returns 204", async () => {
    const onUnsubscribe = vi.fn();
    const { DELETE } = createPushHandler({
      onSubscribe: vi.fn(),
      onUnsubscribe,
    });
    const req = new Request("http://localhost/api/push", {
      method: "DELETE",
      body: JSON.stringify({ endpoint: "https://x/y" }),
      headers: { "content-type": "application/json" },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(204);
    expect(onUnsubscribe).toHaveBeenCalledWith("https://x/y", req, undefined);
  });

  it("DELETE returns 400 when endpoint missing", async () => {
    const { DELETE } = createPushHandler({
      onSubscribe: vi.fn(),
      onUnsubscribe: vi.fn(),
    });
    const req = new Request("http://localhost/api/push", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("POST returns 413 when body exceeds 8192 bytes", async () => {
    const { POST } = createPushHandler({
      onSubscribe: vi.fn(),
      onUnsubscribe: vi.fn(),
    });
    // Build a body that is genuinely > 8192 bytes
    const largeBody = JSON.stringify({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "p", auth: "a" },
      extra: "x".repeat(9000),
    });
    const req = new Request("http://localhost/api/push", {
      method: "POST",
      body: largeBody,
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it("POST returns 500 with generic 'Internal error' when onSubscribe throws", async () => {
    const { POST } = createPushHandler({
      onSubscribe: vi.fn().mockRejectedValue(new Error("DB connection failed: secret123")),
      onUnsubscribe: vi.fn(),
    });
    const body = JSON.stringify({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "p", auth: "a" },
    });
    const req = new Request("http://localhost/api/push", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe("Internal error");
    expect(text).not.toContain("DB connection failed");
    expect(text).not.toContain("secret123");
  });

  it("DELETE returns 400 when endpoint does not start with https://", async () => {
    const { DELETE } = createPushHandler({
      onSubscribe: vi.fn(),
      onUnsubscribe: vi.fn(),
    });
    const req = new Request(
      "http://localhost/api/push?endpoint=http%3A%2F%2Ffcm.googleapis.com%2Ffcm%2Fsend%2Fabc",
      { method: "DELETE" },
    );
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
