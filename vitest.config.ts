import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@shared": path.resolve(import.meta.dirname, "./shared"),
    },
  },
  test: {
    // Pure-logic tests run in node; anything that renders opts into jsdom with
    // a `// @vitest-environment jsdom` header.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
