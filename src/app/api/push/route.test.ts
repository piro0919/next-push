import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));
const sendPush = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookieValue.current === undefined ? undefined : { value: cookieValue.current }),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock("../../../server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../server")>()),
  sendPush,
}));

const { PUT } = await import("./route");

/** Base64url keys of the lengths a browser produces (65 and 16 bytes). */
const P256DH_LENGTH = 87;
const AUTH_LENGTH = 22;
const keys = { p256dh: `B${"A".repeat(P256DH_LENGTH - 1)}`, auth: "A".repeat(AUTH_LENGTH) };

const put = () =>
  PUT(new Request("http://localhost/api/push", { method: "PUT", body: JSON.stringify({}) }));

describe("demo PUT /api/push", () => {
  beforeEach(() => {
    sendPush.mockReset();
    sendPush.mockResolvedValue({ ok: true, statusCode: 201 });
  });

  it("sends to a push service subscription from the cookie", async () => {
    cookieValue.current = JSON.stringify({
      endpoint: "https://fcm.googleapis.com/fcm/send/a",
      keys,
    });
    const res = await put();
    expect(res.status).toBe(200);
    expect(sendPush).toHaveBeenCalledOnce();
  });

  it("does not send when the cookie points at another host", async () => {
    cookieValue.current = JSON.stringify({ endpoint: "https://internal.example/x", keys });
    const res = await put();
    expect(res.status).toBe(400);
    expect(sendPush).not.toHaveBeenCalled();
  });
});
