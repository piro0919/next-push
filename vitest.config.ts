import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/client/**", "src/server/**", "src/sw/**", "src/cli/**", "src/core/**"],
      exclude: ["src/app/**", "**/*.test.ts", "**/*.test.tsx"],
    },
  },
});
