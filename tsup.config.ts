import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

export default defineConfig({
  entry: {
    "client/index": "src/client/index.ts",
    "server/index": "src/server/index.ts",
    "sw/index": "src/sw/index.ts",
    "cli/index": "src/cli/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom", "next"],
  tsconfig: "tsconfig.build.json",
  define: {
    __NEXT_PUSH_VERSION__: JSON.stringify(pkg.version),
  },
  onSuccess: async () => {
    mkdirSync("dist/templates", { recursive: true });
    copyFileSync("templates/sw.js", "dist/templates/sw.js");
  },
});
