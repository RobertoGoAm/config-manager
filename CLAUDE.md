# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **high-assurance Configuration Management System** (similar to LaunchDarkly) built using the **Workspace Monorepo** architecture with strict hexagonal boundaries enforced at **build time**. Logic correctness is paramount. Every line of code must be pure, total, and verifiable.

## Repository Structure

```
config-manager/
├── packages/               # Shared business logic (functional monolith core)
│   ├── domain/            # Pure business logic (NO external deps except Effect)
│   ├── infrastructure/    # Adapters (depends on domain)
│   └── api/               # HTTP API layer (depends on domain + infrastructure)
│
├── apps/                   # Runnable applications (deployment targets)
│   ├── server/            # Standalone API server (Effect-based HTTP)
│   └── web/               # (Future) Nuxt frontend application
│
├── test/                   # Unified test directory
│   ├── unit/              # Property-based & unit tests
│   ├── integration/       # Cross-layer composition tests
│   ├── contract/          # API contract stability tests ⚠️ CRITICAL
│   ├── performance/       # Benchmarks
│   ├── concurrency/       # Parallel access tests
│   ├── fuzz/              # Malformed input tests
│   ├── metamorphic/       # Relationship testing (Boolean algebra laws)
│   ├── regression/        # Bug reproduction cases
│   ├── invariants/        # System invariant tests
│   ├── chaos/             # Fault injection
│   ├── snapshot/          # Golden outputs
│   ├── compliance/        # Audit & regulatory
│   ├── state-machine/     # Lifecycle transitions
│   ├── e2e/               # End-to-end user journeys (Playwright)
│   └── fixtures/          # Shared test data
│
├── specs/                  # Feature specifications & planning docs
└── ...config files
```

### Functional Monolith Philosophy

**Why separate `packages/` and `apps/`?**

1. **Packages** = Pure business logic that can be shared across multiple deployment targets
2. **Apps** = Specific deployment configurations (API server, web frontend, mobile, etc.)

**Benefits:**
- Nuxt can import `@domain`, `@infrastructure`, `@api` directly (type-safe SSR)
- Easy to migrate frontend (replace `apps/web` without touching packages)
- Can deploy as monolith OR split into microservices
- Shared types between frontend and backend

## Paradigm: STRICT Functional Programming

**Absolute Rules:**
- NO `class` keyword
- NO `let` or `var` (only `const`)
- NO `throw` statements (use `Effect.fail`)
- NO loops (`for`, `while`, `do-while`)
- NO imperative mutations
- ALL control flow uses the Effect library (`Effect.gen`, `pipe`, `Effect.all`, etc.)
- ALL errors are typed and handled via Effect

**Effect Library is Mandatory:**
- Use `Effect.gen` for sequential operations
- Use `pipe` for data transformations
- Use `Effect.all` for parallel operations
- All side effects must be wrapped in Effect types
- All failures must be typed with Error types from `@effect/schema`

## Type Safety Configuration

The TypeScript configuration enforces maximum strictness:
- `strict: true`
- `noUncheckedIndexedAccess: true` - Array/object access returns `T | undefined`
- `exactOptionalPropertyTypes: true` - Distinguishes between `undefined` and missing properties

**Never use type assertions (`as`) unless interfacing with untyped external libraries.**

## Architecture: Hexagonal (Ports & Adapters) - Build-Time Enforced

### Dependency Graph (TypeScript References)

```
packages/domain         # Level 0: No dependencies
      ↑
      │
packages/infrastructure # Level 1: Depends on domain
      ↑
      │
packages/api            # Level 2: Depends on domain + infrastructure
      ↑
      │
apps/server             # Level 3: Depends on all packages
```

### Import Paths (TypeScript Path Aliases)

Use these aliases in all code:

```typescript
import { evaluate } from "@domain/logic/Evaluator.js"
import { createInMemoryFlagRepository } from "@infrastructure/db/InMemoryFlagRepository.js"
import { createServer } from "@api/server.js"
```

**Enforcement: TypeScript will fail the build if you violate dependencies.**

For example:
```typescript
// In packages/domain/src/logic/FeatureFlag.ts
import { InMemoryRepo } from "@infrastructure/..." // ❌ BUILD FAILS!
// Error: Cannot find module '@infrastructure/...'
```

**Never import infrastructure code into domain code. The build will prevent it.**

## Testing Strategy

### Test Types (Organized by Purpose)

**1. Unit Tests** (`test/unit/`)
- Property-based testing with `fast-check` for domain logic
- Generate thousands of random inputs to prove correctness
- Focus on invariants that must always hold
- 100% coverage requirement for `packages/domain/`

**2. Integration Tests** (`test/integration/`)
- Test cross-layer composition (domain + infrastructure)
- Verify Effect composition across package boundaries
- Test error propagation through layers

**3. Contract Tests** (`test/contract/`)
**CRITICAL: These prevent breaking changes to the API**
- Lock down API field names (prevents `key` → `id` renames)
- Lock down HTTP status codes (prevents 201 → 200 changes)
- Lock down error response formats
- **If AI changes the API, these tests WILL fail**

**4. E2E Tests** (`test/e2e/`)
- Playwright tests for critical user journeys
- Run against live server

**Future Test Types** (directories created, tests pending):
- `test/performance/` - Benchmarks
- `test/concurrency/` - Race conditions & parallel access
- `test/fuzz/` - Malformed/adversarial inputs
- `test/metamorphic/` - Boolean algebra laws
- `test/regression/` - Bug reproduction cases
- `test/invariants/` - System-wide invariants
- `test/chaos/` - Fault injection
- `test/snapshot/` - Golden outputs
- `test/compliance/` - Audit trails
- `test/state-machine/` - Lifecycle transitions

## Common Commands

```bash
# Development
pnpm dev                 # Start Nuxt frontend (default)
pnpm dev:web             # Start Nuxt frontend (explicit)
pnpm dev:api             # Start standalone API server
pnpm build               # Build all packages + apps
pnpm build:web           # Build Nuxt only
pnpm build:api           # Build API server only

# Type Checking
pnpm typecheck           # Type-check all packages

# Testing (Vitest)
pnpm test                # Run all unit/integration/contract tests
pnpm test:watch          # Run tests in watch mode
pnpm test:unit           # Run only unit tests
pnpm test:integration    # Run only integration tests
pnpm test:contract       # Run only contract tests (includes OpenAPI)
pnpm test:coverage       # Run tests with coverage report
pnpm test:e2e            # Run Playwright E2E tests

# OpenAPI Workflow
pnpm openapi:lint        # Lint OpenAPI spec with Spectral
pnpm openapi:validate    # Validate OpenAPI spec (strict)
pnpm openapi:generate    # Generate TypeScript types from OpenAPI

# Linting
pnpm lint                # Run ESLint with functional rules
pnpm lint:fix            # Auto-fix linting issues

# Quality Gates (must pass before commit)
pnpm check               # typecheck + lint + openapi:validate + test

# Maintenance
pnpm clean               # Remove all node_modules, dist, .nuxt, .output
pnpm clean:install       # Clean + fresh install
```

## ESLint Configuration

The project uses `eslint-plugin-functional` with strict rules:
- `functional/no-let`: No mutable bindings
- `functional/no-class`: No classes
- `functional/no-loop-statements`: No loops
- `functional/no-throw-statements`: No throw
- `functional/immutable-data`: No mutations
- `functional/prefer-immutable-types`: Enforce readonly

**If ESLint flags your code, rewrite it functionally. Do not disable rules.**

## Development Workflow

1. **Feature Request** → Run `/plan` command to generate spec
2. **Implementation** → Run `/backend` command to implement with tests
3. **Validation** → Run `/qa` command to generate E2E tests
4. **Review** → Run `/review` command to verify functional purity

## Domain Modeling Patterns

### Use Schema from effect for all types

```typescript
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  age: Schema.Number,
})

// Derive types automatically
type User = typeof User.Type
```

### Handle errors with Effect

```typescript
import { Effect } from "effect"

const divideEffect = (a: number, b: number) =>
  b === 0
    ? Effect.fail(new Error("Division by zero"))
    : Effect.succeed(a / b)

// Compose effects
const program = Effect.gen(function* () {
  const result = yield* divideEffect(10, 2)
  return result * 2
})
```

### Model recursive structures with Schema.Recursive

```typescript
const Rule: Schema.Schema<Rule> = Schema.Recursive(
  (self) => Schema.Union(
    Schema.Struct({ op: Schema.Literal("EQ"), field: Schema.String, value: Schema.Unknown }),
    Schema.Struct({ op: Schema.Literal("AND"), rules: Schema.Array(self) }),
  ),
  { identifier: "Rule" }
)
```

## Critical Constraints

1. **No Runtime Exceptions**: All failures must be typed Effect errors
2. **Totality**: Every function must handle all possible inputs
3. **Referential Transparency**: Same input = same output, always
4. **No Side Effects in Domain**: Only pure computation in `src/domain/`

## When Adding New Features

1. Define schemas in `packages/domain/src/schema/`
2. Implement pure logic in `packages/domain/src/logic/` using Effect
3. Write property-based tests in `test/unit/domain/`
4. Write contract tests in `test/contract/` to lock down API
5. Add infrastructure adapters in `packages/infrastructure/src/`
6. Write integration tests in `test/integration/`
7. Wire everything in `packages/api/src/`

**The build will prevent you from violating hexagonal architecture.**

## Key Dependencies

- `effect` - Effect runtime, standard library, and Schema (includes former @effect/schema)
- `@effect/platform` - Platform-specific effects (HTTP, File I/O)
- `fast-check` - Property-based testing library
- `vitest` - Test runner
- `playwright` - E2E testing framework
