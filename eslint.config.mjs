import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored Claude Code tooling (CommonJS scripts + hooks), not app code.
    ".claude/get-shit-done/**",
    ".claude/hooks/**",
  ]),
  {
    rules: {
      // React Compiler rules, shipped at "error" by eslint-config-next 16. They
      // fire on deliberate mount-sync / reset-on-open effects and on plain
      // accumulator loops inside async server components, where the only way to
      // silence them is a rewrite that changes runtime behaviour. Kept visible
      // as warnings rather than gating CI on behaviour-changing refactors.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
