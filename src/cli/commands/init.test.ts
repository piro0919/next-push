import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInit } from "./init";

describe("runInit", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "next-push-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("full mode creates all files", async () => {
    await runInit({ cwd: dir });
    expect(existsSync(join(dir, "public/sw.js"))).toBe(true);
    expect(existsSync(join(dir, "app/api/push/route.ts"))).toBe(true);
    expect(existsSync(join(dir, "app/push-demo/page.tsx"))).toBe(true);
    expect(existsSync(join(dir, "lib/send-push-example.ts"))).toBe(true);
    expect(readFileSync(join(dir, ".env.local"), "utf8")).toMatch(/VAPID_PRIVATE_KEY=/);
  });

  it("--send-only skips client/sw files", async () => {
    await runInit({ cwd: dir, sendOnly: true });
    expect(existsSync(join(dir, "public/sw.js"))).toBe(false);
    expect(existsSync(join(dir, "app/api/push/route.ts"))).toBe(false);
    expect(existsSync(join(dir, "app/push-demo/page.tsx"))).toBe(false);
    expect(existsSync(join(dir, "lib/send-push-example.ts"))).toBe(true);
    const env = readFileSync(join(dir, ".env.local"), "utf8");
    expect(env).toMatch(/VAPID_PRIVATE_KEY=/);
    expect(env).not.toMatch(/NEXT_PUBLIC_VAPID_PUBLIC_KEY=/);
  });

  it("--receive-only skips server-only files", async () => {
    await runInit({ cwd: dir, receiveOnly: true });
    expect(existsSync(join(dir, "public/sw.js"))).toBe(true);
    expect(existsSync(join(dir, "app/api/push/route.ts"))).toBe(true);
    expect(existsSync(join(dir, "lib/send-push-example.ts"))).toBe(false);
    const env = readFileSync(join(dir, ".env.local"), "utf8");
    expect(env).toMatch(/NEXT_PUBLIC_VAPID_PUBLIC_KEY=/);
    expect(env).not.toMatch(/VAPID_PRIVATE_KEY=/);
  });

  it("detects Serwist src/app/sw.ts and skips public/sw.js", async () => {
    mkdirSync(join(dir, "src/app"), { recursive: true });
    writeFileSync(join(dir, "src/app/sw.ts"), "// Serwist SW");
    const result = await runInit({ cwd: dir });
    expect(existsSync(join(dir, "public/sw.js"))).toBe(false);
    expect(result.serwistDetected).toBe(true);
  });

  it("existing public/sw.js without --force exits with guidance", async () => {
    mkdirSync(join(dir, "public"), { recursive: true });
    writeFileSync(join(dir, "public/sw.js"), "// existing");
    const result = await runInit({ cwd: dir });
    expect(result.swConflict).toBe(true);
    expect(readFileSync(join(dir, "public/sw.js"), "utf8")).toBe("// existing");
  });

  it("existing public/sw.js with --force overwrites", async () => {
    mkdirSync(join(dir, "public"), { recursive: true });
    writeFileSync(join(dir, "public/sw.js"), "// existing");
    await runInit({ cwd: dir, force: true });
    expect(readFileSync(join(dir, "public/sw.js"), "utf8")).not.toBe("// existing");
  });

  it("--sw-addon creates public/next-push-sw.js and leaves existing sw.js alone", async () => {
    mkdirSync(join(dir, "public"), { recursive: true });
    writeFileSync(join(dir, "public/sw.js"), "// existing");
    await runInit({ cwd: dir, swAddon: true });
    expect(readFileSync(join(dir, "public/sw.js"), "utf8")).toBe("// existing");
    expect(existsSync(join(dir, "public/next-push-sw.js"))).toBe(true);
  });

  it(".env.local existing keys are not overwritten", async () => {
    writeFileSync(join(dir, ".env.local"), "VAPID_PRIVATE_KEY=EXISTING\n");
    await runInit({ cwd: dir });
    const env = readFileSync(join(dir, ".env.local"), "utf8");
    expect(env).toMatch(/VAPID_PRIVATE_KEY=EXISTING/);
  });
});
