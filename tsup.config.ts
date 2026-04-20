import { defineConfig } from "tsup";

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
});
