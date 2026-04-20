import { describe, expect, it } from "vitest";
import { base64UrlDecode, base64UrlEncode } from "./base64";

describe("base64UrlEncode", () => {
  it("encodes empty", () => {
    expect(base64UrlEncode(new Uint8Array([]))).toBe("");
  });

  it("encodes without padding", () => {
    expect(base64UrlEncode(new Uint8Array([72, 101, 108, 108, 111]))).toBe("SGVsbG8");
  });

  it("replaces + and / with - and _", () => {
    expect(base64UrlEncode(new Uint8Array([251, 239, 255]))).toBe("--__");
  });
});

describe("base64UrlDecode", () => {
  it("decodes", () => {
    expect(Array.from(base64UrlDecode("SGVsbG8"))).toEqual([72, 101, 108, 108, 111]);
  });

  it("handles - and _", () => {
    expect(Array.from(base64UrlDecode("--__"))).toEqual([251, 239, 255]);
  });

  it("round-trips", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 255]);
    expect(Array.from(base64UrlDecode(base64UrlEncode(bytes)))).toEqual(Array.from(bytes));
  });
});
