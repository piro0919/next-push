import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { defineConfig, type Options } from "tsup";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

// The two builds below write into the same dist/ in parallel, so tsup's
// per-build `clean` would let one wipe the other's output. Clean once here.
rmSync("dist", { recursive: true, force: true });

const shared: Options = {
  format: ["cjs", "esm"],
  dts: true,
  clean: false,
  sourcemap: true,
  external: ["react", "react-dom", "next"],
  tsconfig: "tsconfig.build.json",
  define: {
    __NEXT_PUSH_VERSION__: JSON.stringify(pkg.version),
  },
};

export default defineConfig([
  // Client entry: esbuild drops module-level directives while bundling, so the
  // "use client" in src/client/usePush.ts never reaches dist. Re-add it as a
  // banner, only on this entry — server, sw and cli must not carry it.
  // Do not enable `treeshake` here: tsup's rollup pass discards banners.
  {
    ...shared,
    entry: { "client/index": "src/client/index.ts" },
    banner: { js: '"use client";' },
  },
  {
    ...shared,
    entry: {
      "server/index": "src/server/index.ts",
      "sw/index": "src/sw/index.ts",
      "cli/index": "src/cli/index.ts",
    },
    onSuccess: async () => {
      mkdirSync("dist/templates", { recursive: true });
      copyFileSync("templates/sw.js", "dist/templates/sw.js");
    },
  },
]);
