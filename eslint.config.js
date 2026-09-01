import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Deliberately narrow: only the Rules of Hooks.
 *
 * TypeScript already covers most of what a linter would catch here, but it
 * cannot see that a hook sits below an early return — which crashes the app at
 * runtime with React error #310, not at build time. Keeping the rule set small
 * means `npm run lint` stays a signal rather than a wall of style opinions.
 */
export default tseslint.config(
  {
    ignores: ["dist/**", "src-tauri/**", "landing/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended],
    // Both plugins are registered so existing eslint-disable comments in the
    // codebase resolve, even though only the hooks rule is turned on.
    plugins: { "react-hooks": reactHooks, "@typescript-eslint": tseslint.plugin },
    linterOptions: {
      // The codebase carries disable comments for rules this config leaves off
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // Everything from js.configs.recommended is off — TypeScript covers it
      // and the codebase was never written against these rules.
      ...Object.fromEntries(
        Object.keys(js.configs.recommended.rules).map((rule) => [rule, "off"]),
      ),
      "react-hooks/rules-of-hooks": "error",
      // Useful but noisy against existing code — left off deliberately
      "react-hooks/exhaustive-deps": "off",
    },
  },
);
