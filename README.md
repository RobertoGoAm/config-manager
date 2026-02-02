# Config Manager

A **high-assurance Configuration Management System** built with strict functional programming and **build-time architectural enforcement**.

## Philosophy

This project enforces **Hexagonal Architecture** at the **TypeScript compiler level**:

- **NO** classes, `let`, `throw`, or loops
- **ALL** control flow uses the Effect library
- **100%** test coverage for domain logic
- **Property-based testing** to prove correctness
- **Build fails** if you violate architecture boundaries

## Quick Start

```bash
# Install dependencies (requires Node 22.20+)
pnpm install

# Install git hooks (runs quality checks before push)
cp .githooks/pre-push .git/hooks/pre-push && chmod +x .git/hooks/pre-push

# Run tests
pnpm test

# Type check all packages
pnpm typecheck

# Lint code
pnpm lint

# Run all quality checks
pnpm check

# Start dev server
pnpm dev
```

### Git Hooks

This project uses a **pre-push hook** to ensure all quality checks pass before pushing:

- Runs `pnpm check` (typecheck + lint + format + tests) before every push
- Prevents pushing broken code to remote
- Can be skipped with `git push --no-verify` (not recommended)

**Installation:**

```bash
# Option 1: Use the npm script (recommended)
pnpm install-hooks

# Option 2: Run the script directly
bash scripts/install-hooks.sh

# Option 3: Manual installation
cp .githooks/pre-push .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

**What gets checked:**

- TypeScript type checking
- ESLint (functional programming rules)
- Prettier formatting
- OpenAPI validation
- All tests (unit, integration, contract)

## Project Structure

```
config-manager/
├── packages/               # Shared business logic & API
│   ├── domain/            # Pure business logic (Level 0)
│   ├── infrastructure/    # Adapters (Level 1)
│   └── api/               # HTTP API layer (Level 2)
│
├── apps/                   # Runnable applications
│   ├── server/            # Standalone API server
│   └── web/               # (Future) Nuxt frontend
│
├── test/                   # Unified test directory
│   ├── unit/              # Property-based tests
│   ├── integration/       # Cross-layer tests
│   ├── contract/          # API stability tests ⚠️ CRITICAL
│   ├── e2e/               # Playwright tests
│   └── .../               # 11 more test type directories
│
├── specs/                  # Feature specifications
└── ...config files
```

### Functional Monolith Architecture

**Packages** = Shared domain logic (can be used by multiple apps)
**Apps** = Deployment targets (server, web, mobile, etc.)

**Why this structure?**

1. **Nuxt integration**: Future `apps/web/` can import `@domain`, `@infrastructure`, `@api`
2. **Flexible deployment**: Run as monolith OR split into microservices
3. **Easy migration**: Replace frontend without touching business logic

## Development Workflow

This project uses **agent swarm commands** for development:

- `/plan` - The Architect: Generates detailed specifications
- `/backend` - The Core Engineer: Implements features with 100% test coverage
- `/qa` - The Validator: Creates E2E tests and fuzzing
- `/review` - The Gatekeeper: Verifies functional purity

See `CLAUDE.md` for full development guidelines.

## Architecture Enforcement

**TypeScript prevents architectural violations at build time:**

```typescript
// In packages/domain/src/logic/FeatureFlag.ts
import { InMemoryRepo } from "@infrastructure/..." // ❌ BUILD FAILS!

// Error: Cannot find module '@infrastructure/...'
// Domain package cannot import infrastructure!
```

**This means:**

- AI cannot accidentally violate hexagonal architecture
- Refactoring is safe - TypeScript enforces boundaries
- No runtime surprises from circular dependencies

## Contract Tests - Your Safety Net

`test/contract/` contains tests that **lock down the API contract**:

```typescript
// If AI renames this field, tests WILL fail:
it("must NOT rename 'key' field", () => {
  const fieldName = "key"
  expect(fieldName).toBe("key") // Prevents key → id rename
})

// If AI changes status codes, tests WILL fail:
it("status code must be 201 Created (not 200 OK)", () => {
  expect(201).toBe(201) // Prevents 201 → 200 change
})
```

## Example: Rule Evaluator

```typescript
import { evaluate } from "@domain/logic/Evaluator.js"
import type { Rule, Context } from "@domain/schema/Rule.js"

const rule: Rule = {
  op: "AND",
  rules: [
    { op: "EQ", field: "user.role", value: "admin" },
    { op: "EQ", field: "feature.enabled", value: true },
  ],
}

const context: Context = {
  "user.role": "admin",
  "feature.enabled": true,
}

// Returns Effect<boolean, FieldNotFoundError | EmptyRulesError>
const result = evaluate(rule, context)
```

## Testing

**58 tests across 4 test types:**

- **24 contract tests** - API stability
- **10 integration tests** - Cross-layer composition
- **24 unit tests** - Property-based with `fast-check`

```bash
pnpm test              # Run all tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests only
pnpm test:contract     # Contract tests only (critical!)
pnpm test:e2e          # Playwright E2E tests
```

## License

MIT
