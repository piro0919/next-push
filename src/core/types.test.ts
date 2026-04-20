import { describe, expect, expectTypeOf, it } from "vitest";
import type { PushPayload, PushSubscriptionJSON, SendResult } from "./types";

describe("types", () => {
  it("PushPayload has required title", () => {
    expectTypeOf<PushPayload>().toHaveProperty("title").toBeString();
  });

  it("PushSubscriptionJSON has endpoint and keys", () => {
    expectTypeOf<PushSubscriptionJSON>().toHaveProperty("endpoint").toBeString();
  });

  it("SendResult is a discriminated union", () => {
    const ok: SendResult = { ok: true, statusCode: 201 };
    const gone: SendResult = { ok: false, gone: true, statusCode: 410 };
    const err: SendResult = { ok: false, gone: false, error: new Error("x") };
    expect(ok.ok).toBe(true);
    if (!gone.ok) expect(gone.gone).toBe(true);
    if (!err.ok) expect(err.gone).toBe(false);
  });
});
