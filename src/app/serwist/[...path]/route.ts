import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";
import type { NextRequest } from "next/server";

const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

const serwistRoute = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/", revision }],
  swSrc: "src/app/sw.ts",
  nextConfig: {},
  esbuildOptions: {
    // Replace process.env.NEXT_PUBLIC_* in the SW bundle at build time
    // (the SW runtime has no `process` global).
    define: {
      "process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY": JSON.stringify(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
      ),
    },
  },
});

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

export const GET = async (
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) => {
  const { path } = await context.params;
  // Serwist's route handler expects `path` as a string; Next.js catch-all
  // gives it as string[]. Join with OS separator since the handler uses path.join().
  const joined = Array.isArray(path) ? path.join("/") : path;
  return serwistRoute.GET(request, {
    params: Promise.resolve({ path: joined }),
  } as never);
};
