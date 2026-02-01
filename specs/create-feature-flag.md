# Feature Flag Creation Specification

## Goal

Enable creation of uniquely-keyed feature flags with a boolean default value and required description, returning the created flag with guaranteed uniqueness enforcement.

## User Stories

### Story 1: Successful Flag Creation
**Given:** No flag exists with key `"new-checkout"`
**When:** User creates flag with key `"new-checkout"`, defaultValue `true`, description `"Enable new checkout flow"`
**Then:** System returns created flag with all provided fields

### Story 2: Duplicate Key Rejection
**Given:** Flag exists with key `"dark-mode"`
**When:** User attempts to create flag with key `"dark-mode"`
**Then:** System fails with `FlagAlreadyExistsError`

### Story 3: Empty Description Rejection
**Given:** Any system state
**When:** User creates flag with key `"beta-feature"`, defaultValue `false`, empty description `""`
**Then:** System fails with `InvalidFlagDescriptionError`

### Story 4: Empty Key Rejection
**Given:** Any system state
**When:** User attempts to create flag with empty string key `""`
**Then:** System fails with `InvalidFlagKeyError`

### Story 5: Invalid Key Format Rejection
**Given:** Any system state
**When:** User attempts to create flag with uppercase key `"MyFlag"` or underscore `"my_flag"`
**Then:** System fails with `InvalidFlagKeyError`

### Story 6: Valid Kebab-Case Key
**Given:** No flag exists with key `"new-feature-2024"`
**When:** User creates flag with key `"new-feature-2024"`, defaultValue `true`, description `"New feature for 2024"`
**Then:** System returns created flag successfully

### Story 7: Description Too Long Rejection (Security)
**Given:** Any system state
**When:** User attempts to create flag with description exceeding 500 characters
**Then:** System fails with `InvalidFlagDescriptionError` (prevents DoS/storage exhaustion attacks)

## Domain Model

### Schema Definitions

```typescript
import { Schema } from "effect"

/**
 * Feature Flag Key - must be non-empty, lowercase alphanumeric with hyphens only (kebab-case)
 * Examples: "dark-mode", "enable-feature-x", "new-ui-2024"
 * Invalid: "DarkMode", "dark_mode", "dark mode", "dark.mode"
 */
export const FlagKey = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  Schema.nonEmptyString(),
)

/**
 * Feature Flag Description - required, non-empty, 1-500 characters after trimming
 * Length limit is a security constraint to prevent DoS attacks
 */
export const FlagDescription = Schema.String.pipe(
  Schema.trim,
  Schema.minLength(1),
  Schema.maxLength(500),
)

/**
 * Feature Flag Input - data required to create a flag
 */
export const CreateFlagInput = Schema.Struct({
  key: FlagKey,
  defaultValue: Schema.Boolean,
  description: FlagDescription,
})

export type CreateFlagInput = Schema.Schema.Type<typeof CreateFlagInput>

/**
 * Feature Flag - complete flag entity with metadata
 */
export const FeatureFlag = Schema.Struct({
  key: FlagKey,
  defaultValue: Schema.Boolean,
  description: FlagDescription,
  createdAt: Schema.Date,
})

export type FeatureFlag = Schema.Schema.Type<typeof FeatureFlag>
```

## Business Rules

### Pure Domain Logic

```typescript
import { Effect, Data } from "effect"

/**
 * Error Types
 */
export class InvalidFlagKeyError extends Data.TaggedError("InvalidFlagKeyError")<{
  readonly key: string
  readonly reason: string
}> {}

export class InvalidFlagDescriptionError extends Data.TaggedError("InvalidFlagDescriptionError")<{
  readonly description: string
  readonly reason: string
}> {}

export class FlagAlreadyExistsError extends Data.TaggedError("FlagAlreadyExistsError")<{
  readonly key: string
}> {}

export class FlagRepositoryError extends Data.TaggedError("FlagRepositoryError")<{
  readonly message: string
}> {}

/**
 * Port: Repository interface (implemented in infrastructure layer)
 */
export interface FlagRepository {
  readonly exists: (key: string) => Effect.Effect<boolean, FlagRepositoryError>
  readonly save: (flag: FeatureFlag) => Effect.Effect<FeatureFlag, FlagRepositoryError>
}

/**
 * Domain Service: Create Feature Flag
 *
 * Validates input, checks uniqueness, and persists flag with creation timestamp.
 * This is a pure function that composes Effects - no side effects in domain code.
 */
export const createFeatureFlag = (
  input: CreateFlagInput,
  repository: FlagRepository,
): Effect.Effect<
  FeatureFlag,
  InvalidFlagKeyError | InvalidFlagDescriptionError | FlagAlreadyExistsError | FlagRepositoryError
> =>
  Effect.gen(function* () {
    // Validate key format (kebab-case: lowercase alphanumeric with hyphens)
    const keyRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/
    if (!keyRegex.test(input.key)) {
      return yield* Effect.fail(
        new InvalidFlagKeyError({
          key: input.key,
          reason: "Key must be kebab-case: lowercase alphanumeric characters separated by hyphens",
        })
      )
    }

    // Validate description is non-empty after trimming
    const trimmedDescription = input.description.trim()
    if (trimmedDescription.length === 0) {
      return yield* Effect.fail(
        new InvalidFlagDescriptionError({
          description: input.description,
          reason: "Description cannot be empty",
        })
      )
    }

    // Security: Enforce length limit to prevent DoS attacks
    if (trimmedDescription.length > 500) {
      return yield* Effect.fail(
        new InvalidFlagDescriptionError({
          description: input.description,
          reason: "Description cannot exceed 500 characters",
        })
      )
    }

    // Check uniqueness constraint
    const flagExists = yield* repository.exists(input.key)
    if (flagExists) {
      return yield* Effect.fail(
        new FlagAlreadyExistsError({ key: input.key })
      )
    }

    // Construct flag with creation timestamp and trimmed description
    const flag: FeatureFlag = {
      key: input.key,
      defaultValue: input.defaultValue,
      description: trimmedDescription,
      createdAt: new Date(),
    }

    // Persist and return
    return yield* repository.save(flag)
  })
```

## Edge Cases

| Case | Input | Expected Behavior |
|------|-------|-------------------|
| Empty key | `{ key: "", defaultValue: true, description: "desc" }` | Fail with `InvalidFlagKeyError` |
| Whitespace-only key | `{ key: "   ", defaultValue: true, description: "desc" }` | Fail with `InvalidFlagKeyError` |
| Key with spaces | `{ key: "my flag", defaultValue: true, description: "desc" }` | Fail with `InvalidFlagKeyError` |
| Key with underscores | `{ key: "my_flag", defaultValue: true, description: "desc" }` | Fail with `InvalidFlagKeyError` |
| Key with uppercase | `{ key: "MyFlag", defaultValue: true, description: "desc" }` | Fail with `InvalidFlagKeyError` |
| Key starting with hyphen | `{ key: "-flag", defaultValue: true, description: "desc" }` | Fail with `InvalidFlagKeyError` |
| Key ending with hyphen | `{ key: "flag-", defaultValue: true, description: "desc" }` | Fail with `InvalidFlagKeyError` |
| Key with double hyphens | `{ key: "my--flag", defaultValue: true, description: "desc" }` | Fail with `InvalidFlagKeyError` |
| Valid single word key | `{ key: "flag", defaultValue: true, description: "desc" }` | Success |
| Valid kebab-case key | `{ key: "my-flag", defaultValue: true, description: "desc" }` | Success |
| Valid key with numbers | `{ key: "flag-123", defaultValue: true, description: "desc" }` | Success |
| Valid key all numbers | `{ key: "123", defaultValue: true, description: "desc" }` | Success |
| Duplicate key | Existing key `"x"` | Fail with `FlagAlreadyExistsError` |
| Empty description | `{ key: "flag", defaultValue: true, description: "" }` | Fail with `InvalidFlagDescriptionError` |
| Whitespace-only description | `{ key: "flag", defaultValue: true, description: "   " }` | Fail with `InvalidFlagDescriptionError` |
| Missing description | `{ key: "flag", defaultValue: true }` | Fail (schema validation - required field) |
| Description max length | `{ key: "flag", defaultValue: true, description: "x".repeat(501) }` | Fail with `InvalidFlagDescriptionError` (security) |
| Description with whitespace | `{ key: "flag", defaultValue: true, description: "  valid  " }` | Success (trimmed to "valid") |
| Valid minimal description | `{ key: "flag", defaultValue: true, description: "x" }` | Success |
| Repository failure | DB connection lost | Fail with `FlagRepositoryError` |
| Concurrent creation | Two requests for same key | One succeeds, one fails with `FlagAlreadyExistsError` |

## Error Types

```typescript
// All errors are typed and handled via Effect

export type CreateFlagError =
  | InvalidFlagKeyError           // Invalid key format (not kebab-case)
  | InvalidFlagDescriptionError   // Empty or too long description
  | FlagAlreadyExistsError        // Key already exists in repository
  | FlagRepositoryError           // Infrastructure failure (DB, network, etc.)
```

## Properties to Test (Property-Based with fast-check)

### Property 1: Kebab-Case Key Validation
```typescript
// For all valid kebab-case keys, createFeatureFlag accepts them
// For all invalid keys, createFeatureFlag rejects with InvalidFlagKeyError
fc.property(
  fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  fc.boolean(),
  fc.string({ minLength: 1, maxLength: 500 }),
  (validKey, defaultValue, description) => {
    // Should not fail with InvalidFlagKeyError for valid kebab-case keys
  }
)
```

### Property 2: Uppercase Keys Always Rejected
```typescript
// Any key containing uppercase letters is rejected
fc.property(
  fc.string().filter(s => /[A-Z]/.test(s)),
  fc.boolean(),
  fc.string({ minLength: 1, maxLength: 500 }),
  (invalidKey, defaultValue, description) => {
    // Should always fail with InvalidFlagKeyError
  }
)
```

### Property 3: Uniqueness Invariant
```typescript
// Creating same key twice always fails on second attempt
fc.property(
  fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  fc.boolean(),
  fc.string({ minLength: 1, maxLength: 500 }),
  (key, defaultValue, description) => {
    // First call succeeds, second call fails with FlagAlreadyExistsError
  }
)
```

### Property 4: Description Must Be Non-Empty
```typescript
// Empty or whitespace-only descriptions are always rejected
fc.property(
  fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  fc.boolean(),
  fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 10 }),
  (key, defaultValue, emptyDescription) => {
    // Should always fail with InvalidFlagDescriptionError
  }
)
```

### Property 5: Description Trimming
```typescript
// Description is always trimmed in output
fc.property(
  fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  fc.boolean(),
  fc.string({ minLength: 1, maxLength: 500 }),
  (key, defaultValue, desc) => {
    const paddedDesc = `  ${desc}  `
    // Created flag should have trimmed description
  }
)
```

### Property 6: Description Length Constraint (Security)
```typescript
// Descriptions over 500 chars are rejected to prevent DoS
fc.property(
  fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  fc.boolean(),
  fc.string({ minLength: 501 }),
  (key, defaultValue, longDescription) => {
    // Should fail with InvalidFlagDescriptionError
  }
)
```

### Property 7: Creation Timestamp
```typescript
// createdAt is always set and is a valid Date
fc.property(
  fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  fc.boolean(),
  fc.string({ minLength: 1, maxLength: 500 }),
  (key, defaultValue, description) => {
    // Created flag always has createdAt field
    // createdAt is approximately current time (within tolerance)
  }
)
```

### Property 8: Totality
```typescript
// Function never throws - all failures are typed Effect errors
fc.property(
  fc.anything(),
  fc.anything(),
  fc.anything(),
  (key, defaultValue, description) => {
    // Should never throw, only return Effect.fail or Effect.succeed
  }
)
```

## E2E Scenarios (Playwright)

### Scenario 1: Create Flag via HTTP API
```typescript
test("POST /flags creates new feature flag", async ({ request }) => {
  const response = await request.post("/api/flags", {
    data: {
      key: "test-flag-" + Date.now(),
      defaultValue: true,
      description: "Test flag for E2E testing",
    },
  })

  expect(response.status()).toBe(201)
  const body = await response.json()
  expect(body.key).toMatch(/^[a-z0-9-]+$/)
  expect(body.defaultValue).toBe(true)
  expect(body.description).toBe("Test flag for E2E testing")
  expect(body.createdAt).toBeTruthy()
})
```

### Scenario 2: Reject Duplicate Flag
```typescript
test("POST /flags rejects duplicate key", async ({ request }) => {
  const key = "duplicate-test-" + Date.now()

  // First creation succeeds
  await request.post("/api/flags", {
    data: {
      key,
      defaultValue: true,
      description: "First flag"
    },
  })

  // Second creation fails
  const response = await request.post("/api/flags", {
    data: {
      key,
      defaultValue: false,
      description: "Second flag"
    },
  })

  expect(response.status()).toBe(409) // Conflict
  const body = await response.json()
  expect(body.error).toBe("FlagAlreadyExistsError")
})
```

### Scenario 3: Reject Invalid Key Format
```typescript
test("POST /flags rejects non-kebab-case key", async ({ request }) => {
  const response = await request.post("/api/flags", {
    data: {
      key: "InvalidKey",
      defaultValue: true,
      description: "Test description",
    },
  })

  expect(response.status()).toBe(400) // Bad Request
  const body = await response.json()
  expect(body.error).toBe("InvalidFlagKeyError")
})
```

### Scenario 4: Reject Empty Description
```typescript
test("POST /flags rejects empty description", async ({ request }) => {
  const response = await request.post("/api/flags", {
    data: {
      key: "test-flag-" + Date.now(),
      defaultValue: false,
      description: "",
    },
  })

  expect(response.status()).toBe(400) // Bad Request
  const body = await response.json()
  expect(body.error).toBe("InvalidFlagDescriptionError")
})
```

### Scenario 5: Reject Missing Description
```typescript
test("POST /flags rejects missing description", async ({ request }) => {
  const response = await request.post("/api/flags", {
    data: {
      key: "test-flag-" + Date.now(),
      defaultValue: false,
    },
  })

  expect(response.status()).toBe(400) // Bad Request
  const body = await response.json()
  expect(body.error).toContain("description")
})
```

### Scenario 6: Trim Description Whitespace
```typescript
test("POST /flags trims description whitespace", async ({ request }) => {
  const response = await request.post("/api/flags", {
    data: {
      key: "test-flag-" + Date.now(),
      defaultValue: true,
      description: "  trimmed description  ",
    },
  })

  expect(response.status()).toBe(201)
  const body = await response.json()
  expect(body.description).toBe("trimmed description")
})
```

### Scenario 7: Reject Description Over 500 Characters (Security)
```typescript
test("POST /flags rejects description exceeding 500 characters", async ({ request }) => {
  const response = await request.post("/api/flags", {
    data: {
      key: "test-flag-" + Date.now(),
      defaultValue: true,
      description: "x".repeat(501),
    },
  })

  expect(response.status()).toBe(400) // Bad Request
  const body = await response.json()
  expect(body.error).toBe("InvalidFlagDescriptionError")
  expect(body.reason).toContain("500 characters")
})
```

## Security Implications

### 1. DoS Prevention via Length Limits
**Threat:** Unlimited description field enables DoS attacks
- Attacker creates 1000 flags with 1MB descriptions each = 1GB storage
- API responses become megabytes, exhausting bandwidth
- Database queries slow down with large text fields

**Mitigation:** 500 character hard limit
- Maximum single flag size: ~500 bytes
- 1000 flags = 500KB max (reasonable)
- Prevents memory/storage exhaustion attacks

### 2. Injection Attack Prevention via Kebab-Case
**Threat:** Unrestricted key format enables:
- SQL injection via special characters
- Command injection in automation scripts
- Path traversal if keys used in file systems
- XSS if keys rendered in HTML without escaping

**Mitigation:** Alphanumeric + hyphen only (kebab-case)
- No special characters: `' " ; $ \ / . <> () {} []`
- Safe for SQL, shell commands, URLs, HTML
- Predictable and parseable format

### 3. Key Uniqueness as Security Boundary
**Threat:** Duplicate keys could:
- Overwrite critical production flags
- Enable privilege escalation (overwrite admin flags)
- Cause configuration conflicts and system instability

**Mitigation:** Strict uniqueness constraint at database level
- Prevents accidental overwrites
- Prevents malicious flag hijacking
- Atomic check-and-create prevents race conditions

### 4. Required Description Prevents Shadow Flags
**Threat:** Flags without descriptions are:
- Hard to audit ("What does `flag-x` do?")
- Potential backdoors (undocumented behavior)
- Difficult to maintain (no context)

**Mitigation:** Non-empty description requirement
- Every flag must be documented
- Audit trail for compliance
- Prevents "stealth" configuration changes

### 5. Input Validation at Schema Level
**Threat:** Bypassing business logic validation via:
- Direct database writes
- API version mismatches
- Integration bugs

**Mitigation:** Effect Schema validation enforces constraints
- Validation happens before business logic
- Type-safe guarantees at compile time
- Cannot construct invalid `FeatureFlag` instances

## Performance Constraints

1. **Key Existence Check**: O(1) lookup in database (indexed by key)
2. **Save Operation**: O(1) insert operation
3. **Expected Latency**: < 100ms for typical database (excluding network)
4. **Concurrent Creation**: Must handle race conditions (database uniqueness constraint)
5. **Memory Usage**: 500 char limit keeps each flag under 1KB in memory

## Invariants (Must ALWAYS Hold)

1. **Uniqueness**: No two flags can have the same key
2. **Non-Empty Key**: Every flag has a non-empty, valid kebab-case key
3. **Non-Empty Description**: Every flag has a non-empty description (1-500 chars)
4. **Immutable Key**: Once created, flag key cannot be changed
5. **Creation Timestamp**: Every flag has a valid `createdAt` timestamp
6. **Boolean Default**: defaultValue is always `true` or `false`
7. **Totality**: Function never throws exceptions - all errors are typed
8. **Kebab-Case Keys**: All keys are lowercase alphanumeric with hyphens only
9. **Bounded Description**: All descriptions are ≤ 500 characters (security constraint)

## Implementation Checklist

- [ ] Define schemas in `src/domain/schema/FeatureFlag.ts`
- [ ] Implement error types in `src/domain/logic/FeatureFlag.ts`
- [ ] Implement `createFeatureFlag` function in `src/domain/logic/FeatureFlag.ts`
- [ ] Define `FlagRepository` port interface in `src/domain/logic/FeatureFlag.ts`
- [ ] Implement in-memory repository in `src/infrastructure/db/InMemoryFlagRepository.ts`
- [ ] Write property-based tests in `tests/domain/logic/FeatureFlag.test.ts`
- [ ] Implement HTTP route in `src/api/routes/flags.ts`
- [ ] Write E2E tests in `e2e/create-flag.spec.ts`
- [ ] Ensure 100% test coverage for domain logic
- [ ] Run `npm run check` to verify all quality gates pass
