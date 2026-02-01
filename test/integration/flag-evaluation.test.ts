import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { evaluate } from "@domain/logic/Evaluator.js"
import { createFeatureFlag } from "@domain/logic/FeatureFlag.js"
import { createInMemoryFlagRepository } from "@infrastructure/db/InMemoryFlagRepository.js"
import type { Rule, Context } from "@domain/schema/Rule.js"
import type { CreateFlagInput } from "@domain/schema/FeatureFlag.js"

/**
 * Integration Tests: Domain + Infrastructure
 *
 * These tests verify that domain logic correctly composes with infrastructure adapters.
 * They test the interaction between layers, not just individual functions.
 *
 * Focus areas:
 * - Effect composition across layers
 * - Service wiring (dependency injection)
 * - Data flow through hexagonal architecture
 * - Error propagation from infrastructure to domain
 */

describe("Feature Flag Evaluation Integration", () => {
  describe("Domain + Infrastructure Composition", () => {
    it("should create flag and evaluate rules in a single Effect pipeline", async () => {
      const repository = createInMemoryFlagRepository()

      const input: CreateFlagInput = {
        key: "user-is-admin",
        defaultValue: false,
        description: "Checks if user has admin role",
      }

      const rule: Rule = {
        op: "EQ",
        field: "role",
        value: "admin",
      }

      const adminContext: Context = { role: "admin" }
      const userContext: Context = { role: "user" }

      // Compose domain operations
      const program = Effect.gen(function* () {
        // Step 1: Create flag (domain + infrastructure)
        const flag = yield* createFeatureFlag(input, repository)
        expect(flag.key).toBe("user-is-admin")

        // Step 2: Evaluate rule for admin
        const adminResult = yield* evaluate(rule, adminContext)
        expect(adminResult).toBe(true)

        // Step 3: Evaluate rule for regular user
        const userResult = yield* evaluate(rule, userContext)
        expect(userResult).toBe(false)

        return { flag, adminResult, userResult }
      })

      const result = await Effect.runPromise(program)

      expect(result.flag.key).toBe("user-is-admin")
      expect(result.adminResult).toBe(true)
      expect(result.userResult).toBe(false)
    })

    it("should handle complex rule evaluation after flag creation", async () => {
      const repository = createInMemoryFlagRepository()

      const input: CreateFlagInput = {
        key: "premium-feature",
        defaultValue: false,
        description: "Access to premium features",
      }

      const complexRule: Rule = {
        op: "AND",
        rules: [
          { op: "EQ", field: "subscription", value: "premium" },
          {
            op: "OR",
            rules: [
              { op: "EQ", field: "country", value: "US" },
              { op: "EQ", field: "country", value: "CA" },
            ],
          },
        ],
      }

      const validContext: Context = {
        subscription: "premium",
        country: "US",
      }

      const program = Effect.gen(function* () {
        const flag = yield* createFeatureFlag(input, repository)
        const result = yield* evaluate(complexRule, validContext)
        return { flag, result }
      })

      const output = await Effect.runPromise(program)

      expect(output.flag.key).toBe("premium-feature")
      expect(output.result).toBe(true)
    })
  })

  describe("Error Propagation Across Layers", () => {
    it("should propagate repository errors through domain logic", async () => {
      const repository = createInMemoryFlagRepository()

      const input: CreateFlagInput = {
        key: "test-flag",
        defaultValue: true,
        description: "Test flag",
      }

      const program = Effect.gen(function* () {
        // Create flag once
        yield* createFeatureFlag(input, repository)

        // Try to create again (should fail with FlagAlreadyExistsError)
        return yield* createFeatureFlag(input, repository)
      })

      const result = await Effect.runPromise(program.pipe(Effect.either))

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left._tag).toBe("FlagAlreadyExistsError")
      }
    })

    it("should handle evaluation errors with missing context fields", async () => {
      const rule: Rule = { op: "EQ", field: "userId", value: 123 }
      const emptyContext: Context = {}

      const result = await Effect.runPromise(
        evaluate(rule, emptyContext).pipe(Effect.either)
      )

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result._tag).toBe("Left")
        expect(result.left._tag).toBe("FieldNotFoundError")
      }
    })
  })

  describe("Service Dependency Injection", () => {
    it("should work with repository passed as dependency", async () => {
      // This tests that domain logic doesn't create its own repository
      // Instead, it receives it as a dependency (hexagonal architecture)

      const repo1 = createInMemoryFlagRepository()
      const repo2 = createInMemoryFlagRepository()

      const input: CreateFlagInput = {
        key: "test-flag",
        defaultValue: true,
        description: "Test",
      }

      // Create in repo1
      await Effect.runPromise(createFeatureFlag(input, repo1))

      // Try to create same flag in repo2 (should succeed - different repo)
      const result = await Effect.runPromise(
        createFeatureFlag(input, repo2).pipe(Effect.either)
      )

      expect(result._tag).toBe("Right")

      // Verify repo1 has the flag
      const exists1 = await Effect.runPromise(repo1.exists("test-flag"))
      expect(exists1).toBe(true)

      // Verify repo2 also has the flag
      const exists2 = await Effect.runPromise(repo2.exists("test-flag"))
      expect(exists2).toBe(true)
    })
  })

  describe("Data Transformation Across Layers", () => {
    it("should preserve data integrity through domain → infrastructure → domain", async () => {
      const repository = createInMemoryFlagRepository()

      const input: CreateFlagInput = {
        key: "data-integrity-test",
        defaultValue: true,
        description: "  Trimmed description  ",
      }

      const program = Effect.gen(function* () {
        // Save flag (data goes through domain → infrastructure)
        const saved = yield* createFeatureFlag(input, repository)

        // Verify data transformations were applied
        expect(saved.description).toBe("Trimmed description") // Trimmed
        expect(saved.createdAt).toBeInstanceOf(Date)

        return saved
      })

      const result = await Effect.runPromise(program)

      expect(result.description).toBe("Trimmed description")
      expect(result.defaultValue).toBe(true)
    })
  })

  describe("Concurrent Operations", () => {
    it("should handle parallel flag creation with different keys", async () => {
      const repository = createInMemoryFlagRepository()

      const inputs: CreateFlagInput[] = [
        { key: "flag-1", defaultValue: true, description: "Flag 1" },
        { key: "flag-2", defaultValue: false, description: "Flag 2" },
        { key: "flag-3", defaultValue: true, description: "Flag 3" },
      ]

      const program = Effect.all(
        inputs.map((input) => createFeatureFlag(input, repository)),
        { concurrency: "unbounded" }
      )

      const results = await Effect.runPromise(program)

      expect(results).toHaveLength(3)
      expect(results[0]?.key).toBe("flag-1")
      expect(results[1]?.key).toBe("flag-2")
      expect(results[2]?.key).toBe("flag-3")
    })

    it("should handle parallel rule evaluations", async () => {
      const rules: Rule[] = [
        { op: "EQ", field: "a", value: 1 },
        { op: "EQ", field: "b", value: 2 },
        { op: "EQ", field: "c", value: 3 },
      ]

      const context: Context = { a: 1, b: 2, c: 3 }

      const program = Effect.all(
        rules.map((rule) => evaluate(rule, context)),
        { concurrency: "unbounded" }
      )

      const results = await Effect.runPromise(program)

      expect(results).toEqual([true, true, true])
    })
  })

  describe("Effect Composition Patterns", () => {
    it("should compose multiple domain operations sequentially", async () => {
      const repository = createInMemoryFlagRepository()

      const program = Effect.gen(function* () {
        // Sequential operations
        const flag1 = yield* createFeatureFlag(
          { key: "flag-1", defaultValue: true, description: "First" },
          repository
        )

        const flag2 = yield* createFeatureFlag(
          { key: "flag-2", defaultValue: false, description: "Second" },
          repository
        )

        const exists1 = yield* repository.exists("flag-1")
        const exists2 = yield* repository.exists("flag-2")

        return { flag1, flag2, exists1, exists2 }
      })

      const result = await Effect.runPromise(program)

      expect(result.flag1.key).toBe("flag-1")
      expect(result.flag2.key).toBe("flag-2")
      expect(result.exists1).toBe(true)
      expect(result.exists2).toBe(true)
    })

    it("should handle Effect.either for error handling across layers", async () => {
      const repository = createInMemoryFlagRepository()

      const program = Effect.gen(function* () {
        // Try invalid operation
        const result1 = yield* createFeatureFlag(
          { key: "INVALID_KEY", defaultValue: true, description: "Test" },
          repository
        ).pipe(Effect.either)

        // Try valid operation
        const result2 = yield* createFeatureFlag(
          { key: "valid-key", defaultValue: true, description: "Test" },
          repository
        ).pipe(Effect.either)

        return { result1, result2 }
      })

      const output = await Effect.runPromise(program)

      expect(output.result1._tag).toBe("Left")
      expect(output.result2._tag).toBe("Right")
    })
  })
})
