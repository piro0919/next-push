import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateVAPIDKeys } from "../../server/vapid/keys";
import { PAGE_TSX, ROUTE_TS, SEND_EXAMPLE_TS } from "../templates";

export interface InitOptions {
  cwd?: string;
  sendOnly?: boolean;
  receiveOnly?: boolean;
  force?: boolean;
  swAddon?: boolean;
  skipSw?: boolean;
}

export interface InitResult {
  generated: string[];
  skipped: string[];
  serwistDetected: boolean;
  swConflict: boolean;
}

export async function runInit(opts: InitOptions = {}): Promise<InitResult> {
  const cwd = opts.cwd ?? process.cwd();
  const mode = opts.sendOnly ? "send" : opts.receiveOnly ? "receive" : "full";
  const generated: string[] = [];
  const skipped: string[] = [];
  let serwistDetected = false;
  let swConflict = false;

  // 1. SW handling (skipped in send-only)
  if (mode !== "send" && !opts.skipSw) {
    const swTsPath = join(cwd, "src/app/sw.ts");
    const swJsPath = join(cwd, "public/sw.js");
    if (existsSync(swTsPath)) {
      serwistDetected = true;
      console.log("Warning: Serwist SW detected (src/app/sw.ts).");
      console.log("    Add this to your sw.ts:\n");
      console.log(`    import { registerAll } from "@piro0919/next-push/sw";`);
      console.log(
        `    registerAll({ vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY! });\n`,
      );
    } else if (existsSync(swJsPath) && !opts.force && !opts.swAddon) {
      swConflict = true;
      console.log("Warning: public/sw.js already exists. Choose one:");
      console.log("    --force           overwrite");
      console.log("    --sw-addon        create public/next-push-sw.js and importScripts it");
      console.log("    --skip-sw         skip SW generation");
    } else if (opts.swAddon && existsSync(swJsPath)) {
      writeFile(cwd, "public/next-push-sw.js", loadTemplateSwJs(), generated, skipped, opts.force);
      console.log("    Add this line to your public/sw.js:");
      console.log(`      importScripts("/next-push-sw.js");`);
    } else {
      writeFile(cwd, "public/sw.js", loadTemplateSwJs(), generated, skipped, opts.force);
    }
  }

  // 2. .env.local
  const { publicKey, privateKey } = await generateVAPIDKeys();
  const envPath = join(cwd, ".env.local");
  const envExisting = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const envLines: string[] = [];
  if (mode !== "send" && !envExisting.includes("NEXT_PUBLIC_VAPID_PUBLIC_KEY=")) {
    envLines.push(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
  }
  if (mode !== "receive" && !envExisting.includes("VAPID_PRIVATE_KEY=")) {
    envLines.push(`VAPID_PRIVATE_KEY=${privateKey}`);
  }
  if (mode !== "receive" && !envExisting.includes("VAPID_SUBJECT=")) {
    envLines.push(`VAPID_SUBJECT=mailto:you@example.com`);
  }
  if (envLines.length > 0) {
    const sep = envExisting && !envExisting.endsWith("\n") ? "\n" : "";
    writeFileSync(envPath, `${envExisting + sep + envLines.join("\n")}\n`);
    generated.push(".env.local");
  }

  // 3. Client-side scaffolding (skipped in send-only)
  if (mode !== "send") {
    writeFile(cwd, "app/api/push/route.ts", ROUTE_TS, generated, skipped, opts.force);
    writeFile(cwd, "app/push-demo/page.tsx", PAGE_TSX, generated, skipped, opts.force);
  }

  // 4. Server-side scaffolding (skipped in receive-only)
  if (mode !== "receive") {
    writeFile(cwd, "lib/send-push-example.ts", SEND_EXAMPLE_TS, generated, skipped, opts.force);
  }

  printSummary(generated, skipped, mode);
  return { generated, skipped, serwistDetected, swConflict };
}

function writeFile(
  cwd: string,
  rel: string,
  content: string,
  generated: string[],
  skipped: string[],
  force?: boolean,
): void {
  const full = join(cwd, rel);
  if (existsSync(full) && !force) {
    skipped.push(rel);
    return;
  }
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  generated.push(rel);
}

function loadTemplateSwJs(): string {
  // Search for templates/sw.js in a few likely locations:
  // 1. Alongside the built CLI (dist/templates/sw.js → dist/cli/index.js looks up ../templates)
  // 2. Repo root /templates/sw.js (dev mode)
  // 3. process.cwd()/templates/sw.js (fallback)
  const candidates: string[] = [];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(here, "../templates/sw.js"));
    candidates.push(resolve(here, "../../templates/sw.js"));
  } catch {
    // import.meta.url unavailable (e.g., CJS) — fall through
  }
  candidates.push(resolve(process.cwd(), "templates/sw.js"));

  for (const c of candidates) {
    if (existsSync(c)) return readFileSync(c, "utf8");
  }
  throw new Error(
    `next-push init: sw.js template not found. Looked in:\n  ${candidates.join("\n  ")}`,
  );
}

function printSummary(generated: string[], skipped: string[], mode: string): void {
  console.log("");
  for (const f of generated) console.log(`+ ${f}`);
  for (const f of skipped) console.log(`- skipped (exists) ${f}`);
  console.log("\nNext steps:");
  if (mode !== "send") {
    console.log("  - pnpm dev and visit /push-demo to try it out");
  }
  if (mode !== "receive") {
    console.log("  - See lib/send-push-example.ts for how to send a push");
  }
}
