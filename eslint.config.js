import eslint from "@eslint/js"
import tseslint from "@typescript-eslint/eslint-plugin"
import tsparser from "@typescript-eslint/parser"
import functional from "eslint-plugin-functional"

export default [
  {
    ignores: [
      "node_modules",
      "**/dist/**",
      "**/node_modules/**",
      "**/.nuxt/**",
      "**/.output/**",
      "coverage",
      "test/**/*",
      "*.config.ts",
      "**/*.d.ts",
      "apps/web/**/*", // Nuxt uses auto-imports and different conventions
    ],
  },
  eslint.configs.recommended,
  {
    files: ["packages/**/*.ts", "apps/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.base.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      functional,
    },
    rules: {
      // Functional programming rules (STRICT)
      "functional/no-let": "error",
      "functional/no-loop-statements": "error",
      "functional/no-throw-statements": "error",
      "functional/no-classes": "error",
      "functional/immutable-data": "error",
      "functional/prefer-immutable-types": "off", // Too strict, use TypeScript's readonly instead
      "functional/no-try-statements": "error",
      "functional/no-expression-statements": "off", // Allow Effect expressions
      "functional/functional-parameters": "off", // Effect.gen uses generators

      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "warn", // Warn instead of error for tests
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      // Relax some rules for tests
      "functional/immutable-data": "off",
      "functional/no-expression-statements": "off",
    },
  },
]
