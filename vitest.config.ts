import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/form-builder/**/*.{test,spec}.{ts,tsx}", "tests/form-interpreter/**/*.{test,spec}.{ts,tsx}", "tests/rls/**/*.{test,spec}.{ts,tsx}", "tests/scheduler/**/*.{test,spec}.{ts,tsx}", "tests/phase07/**/*.{test,spec}.{ts,tsx}", "tests/auth-helpers/**/*.{test,spec}.{ts,tsx}", "tests/signing/**/*.{test,spec}.{ts,tsx}", "tests/notifications/**/*.{test,spec}.{ts,tsx}", "tests/proposals/**/*.{test,spec}.{ts,tsx}", "tests/pdf/**/*.{test,spec}.{ts,tsx}", "tests/admin/**/*.{test,spec}.{ts,tsx}", "tests/api/**/*.{test,spec}.{ts,tsx}"],
    // Cold transform cache + parallel runs make the first dynamic import() of
    // @coltorapps/builder slow; 5s default times out on a cold run (Plan 13-01).
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` throws when imported outside an RSC build; stub it so
      // server modules (actions, supabase helpers) can be unit-tested in jsdom.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
