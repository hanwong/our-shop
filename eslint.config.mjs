// @ts-check
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    // Restrict linting to this app's own TypeScript sources. The repo root
    // also carries the MoAI harness's own tooling (.claude/, .moai/,
    // .github/, .git_hooks/) which is out of this SPEC's domain whitelist
    // (backend/database) and must not be touched or linted by the app's
    // ESLint config.
    ignores: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "prisma/migrations/**",
      ".claude/**",
      ".moai/**",
      ".github/**",
      ".git_hooks/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
