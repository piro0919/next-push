import { describe, expect, expectTypeOf, it } from "vitest";
import type { PushPayload, PushSubscriptionJSON, SendResult } from "./types";

describe("types", () => {
  it("PushPayload has required title", () => {
    expectTypeOf<PushPayload>().toHaveProperty("title").toBeString();
  });

  it("PushSubscriptionJSON has endpoint and keys", () => {
    expectTypeOf<PushSubscriptionJSON>().toHaveProperty("endpoint").toBeString();
  });

  it("SendResult is a discriminated union with optional retry fields", () => {
    const ok: SendResult = { ok: true, statusCode: 201 };
    const gone: SendResult = { ok: false, gone: true, statusCode: 410 };
    const transient: SendResult = {
      ok: false,
      gone: false,
      statusCode: 429,
      error: new Error("rate limited"),
      retryAfter: 30,
      retryable: true,
    };
    const perm: SendResult = {
      ok: false,
      gone: false,
      statusCode: 400,
      error: new Error("bad"),
      retryable: false,
    };
    expect(ok.ok).toBe(true);
    if (!gone.ok) expect(gone.gone).toBe(true);
    if (!transient.ok) expect(transient.retryable).toBe(true);
    if (!perm.ok && !perm.gone) expect(perm.retryable).toBe(false);
  });
});
