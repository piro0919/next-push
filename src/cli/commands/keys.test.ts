import { describe, expect, it } from "vitest";
import { generateKeysOutput } from "./keys";

describe("generateKeysOutput", () => {
  it("returns 3 env var lines", async () => {
    const lines = await generateKeysOutput();
    expect(lines.length).toBe(3);
    expect(lines[0].startsWith("NEXT_PUBLIC_VAPID_PUBLIC_KEY=")).toBe(true);
    expect(lines[1].startsWith("VAPID_PRIVATE_KEY=")).toBe(true);
    expect(lines[2].startsWith("VAPID_SUBJECT=")).toBe(true);
  });

  it("uses provided subject", async () => {
    const lines = await generateKeysOutput("mailto:foo@bar.com");
    expect(lines[2]).toBe("VAPID_SUBJECT=mailto:foo@bar.com");
  });

  it("uses default subject when none provided", async () => {
    const lines = await generateKeysOutput();
    expect(lines[2]).toBe("VAPID_SUBJECT=mailto:you@example.com");
  });
});
