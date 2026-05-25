import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/form-builder/**/*.{test,spec}.ts", "tests/form-interpreter/**/*.{test,spec}.{ts,tsx}"],
    // Cold transform cache + parallel runs make the first dynamic import() of
    // @coltorapps/builder slow; 5s default times out on a cold run (Plan 13-01).
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
