import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

const rootDir = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/test/e2e/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "packages/domain/src/**/*.ts",
        "packages/infrastructure/src/**/*.ts",
        "packages/api/src/**/*.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**", "**/dist/**"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: {
      "@domain": resolve(rootDir, "packages/domain/src"),
      "@infrastructure": resolve(rootDir, "packages/infrastructure/src"),
      "@api": resolve(rootDir, "packages/api/src"),
    },
  },
})
