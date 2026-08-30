import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // JSX is transformed by vitest's built-in esbuild. @vitejs/plugin-react is
  // deliberately NOT introduced: Fast Refresh is useless in tests, and the
  // automatic runtime is all the component tests need (SPEC-STOREFRONT-001
  // plan.md §H).
  esbuild: { jsx: "automatic" },
  test: {
    // Stays "node" on purpose. Component tests opt into a DOM per file with
    // the `// @vitest-environment jsdom` directive, so the ~437 pre-existing
    // node tests keep running in the environment they were written for
    // (acceptance.md §4 invariant).
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.d.ts", "src/types/**"],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
