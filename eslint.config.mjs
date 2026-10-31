import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Mirrors the rules the old CRA "react-app" preset enforced.
const unusedVars = ["warn", { args: "none", ignoreRestSiblings: true }];

export default defineConfig([
  // admin/ is a separate Node app with its own package.json
  { ignores: ["build", "admin"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": unusedVars,
    },
  },
  {
    files: ["src/utils/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node, sourceType: "commonjs" },
    rules: { "no-unused-vars": unusedVars },
  },
]);
