import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import * as fc from "fast-check"
import { createFeatureFlag, InvalidFlagKeyError, InvalidFlagDescriptionError, FlagAlreadyExistsError } from "@domain/logic/FeatureFlag.js"
import { createInMemoryFlagRepository } from "@infrastructure/db/InMemoryFlagRepository.js"
import type { CreateFlagInput } from "@domain/schema/FeatureFlag.js"

describe("createFeatureFlag", () => {
  describe("Property 1: Kebab-Case Key Validation", () => {
    it("accepts all valid kebab-case keys", () => {
      fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
          fc.boolean(),
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          async (validKey, defaultValue, description) => {
            const repository = createInMemoryFlagRepository()
            const input: CreateFlagInput = {
              key: validKey,
              defaultValue,
              description,
            }

            const result = await Effect.runPromise(
              createFeatureFlag(input, repository).pipe(
                Effect.either
              )
            )

            // Should succeed without InvalidFlagKeyError
            if (result._tag === "Left") {
              expect(result.left._tag).not.toBe("InvalidFlagKeyError")
            } else {
              expect(result.right.key).toBe(validKey)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 2: Uppercase Keys Always Rejected", () => {
    it("rejects any key containing uppercase letters", () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }).filter(s => /[A-Z]/.test(s)),
          fc.boolean(),
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          async (invalidKey, defaultValue, description) => {
            const repository = createInMemoryFlagRepository()
            const input: CreateFlagInput = {
              key: invalidKey,
              defaultValue,
              description,
            }

            const result = await Effect.runPromise(
              createFeatureFlag(input, repository).pipe(
                Effect.either
              )
            )

            // Should fail with InvalidFlagKeyError
            expect(result._tag).toBe("Left")
            if (result._tag === "Left") {
              expect(result.left).toBeInstanceOf(InvalidFlagKeyError)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 3: Uniqueness Invariant", () => {
    it("fails on second attempt to create same key", () => {
      fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
          fc.boolean(),
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          async (key, defaultValue, description) => {
            const repository = createInMemoryFlagRepository()
            const input: CreateFlagInput = {
              key,
              defaultValue,
              description,
            }

            // First creation should succeed
            const firstResult = await Effect.runPromise(
              createFeatureFlag(input, repository).pipe(
                Effect.either
              )
            )
            expect(firstResult._tag).toBe("Right")

            // Second creation should fail with FlagAlreadyExistsError
            const secondResult = await Effect.runPromise(
              createFeatureFlag(input, repository).pipe(
                Effect.either
              )
            )
            expect(secondResult._tag).toBe("Left")
            if (secondResult._tag === "Left") {
              expect(secondResult.left).toBeInstanceOf(FlagAlreadyExistsError)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 4: Description Must Be Non-Empty", () => {
    it("rejects empty or whitespace-only descriptions", () => {
      fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
          fc.boolean(),
          fc.string({ unit: fc.constantFrom(" ", "\t", "\n"), minLength: 0, maxLength: 10 }),
          async (key, defaultValue, emptyDescription) => {
            const repository = createInMemoryFlagRepository()
            const input: CreateFlagInput = {
              key,
              defaultValue,
              description: emptyDescription,
            }

            const result = await Effect.runPromise(
              createFeatureFlag(input, repository).pipe(
                Effect.either
              )
            )

            // Should fail with InvalidFlagDescriptionError
            expect(result._tag).toBe("Left")
            if (result._tag === "Left") {
              expect(result.left).toBeInstanceOf(InvalidFlagDescriptionError)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 5: Description Trimming", () => {
    it("always trims description in output", () => {
      fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
          fc.boolean(),
          fc.string({ minLength: 1, maxLength: 490 }).filter(s => s.trim().length > 0),
          async (key, defaultValue, desc) => {
            const repository = createInMemoryFlagRepository()
            const paddedDesc = `  ${desc}  `
            const input: CreateFlagInput = {
              key,
              defaultValue,
              description: paddedDesc,
            }

            const result = await Effect.runPromise(
              createFeatureFlag(input, repository).pipe(
                Effect.either
              )
            )

            // Should succeed and description should be trimmed
            expect(result._tag).toBe("Right")
            if (result._tag === "Right") {
              expect(result.right.description).toBe(desc.trim())
              // Verify leading/trailing whitespace is removed
              expect(result.right.description).not.toMatch(/^\s/)
              expect(result.right.description).not.toMatch(/\s$/)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 6: Description Length Constraint (Security)", () => {
    it("rejects descriptions over 500 characters", () => {
      fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
          fc.boolean(),
          fc.string({ minLength: 501, maxLength: 1000 }),
          async (key, defaultValue, longDescription) => {
            const repository = createInMemoryFlagRepository()
            const input: CreateFlagInput = {
              key,
              defaultValue,
              description: longDescription,
            }

            const result = await Effect.runPromise(
              createFeatureFlag(input, repository).pipe(
                Effect.either
              )
            )

            // Should fail with InvalidFlagDescriptionError
            expect(result._tag).toBe("Left")
            if (result._tag === "Left") {
              expect(result.left).toBeInstanceOf(InvalidFlagDescriptionError)
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe("Property 7: Creation Timestamp", () => {
    it("always sets createdAt to approximately current time", () => {
      fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/),
          fc.boolean(),
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          async (key, defaultValue, description) => {
            const repository = createInMemoryFlagRepository()
            const before = new Date()

            const input: CreateFlagInput = {
              key,
              defaultValue,
              description,
            }

            const result = await Effect.runPromise(
              createFeatureFlag(input, repository).pipe(
                Effect.either
              )
            )

            const after = new Date()

            // Should succeed and have valid timestamp
            expect(result._tag).toBe("Right")
            if (result._tag === "Right") {
              expect(result.right.createdAt).toBeInstanceOf(Date)
              expect(result.right.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
              expect(result.right.createdAt.getTime()).toBeLessThanOrEqual(after.getTime())
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 8: Totality", () => {
    it("never throws, only returns Effect.fail or Effect.succeed", async () => {
      // Helper to safely convert any value to string
      const toSafeString = (value: unknown): string => {
        if (value === null || value === undefined) return ""
        try {
          return String(value)
        } catch {
          return "[object]"
        }
      }

      await fc.assert(
        fc.asyncProperty(
          fc.anything(),
          fc.anything(),
          fc.anything(),
          async (key, defaultValue, description) => {
            const repository = createInMemoryFlagRepository()

            // Safely attempt to create with arbitrary inputs
            const input: CreateFlagInput = {
              key: toSafeString(key),
              defaultValue: Boolean(defaultValue),
              description: toSafeString(description),
            }

            const result = await Effect.runPromise(
              createFeatureFlag(input, repository).pipe(
                Effect.either
              )
            )

            // Should always return Either (Left or Right), never throw
            expect(["Left", "Right"]).toContain(result._tag)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Edge Cases", () => {
    it("rejects empty key", async () => {
      const repository = createInMemoryFlagRepository()
      const input: CreateFlagInput = {
        key: "",
        defaultValue: true,
        description: "desc",
      }

      const result = await Effect.runPromise(
        createFeatureFlag(input, repository).pipe(Effect.either)
      )

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(InvalidFlagKeyError)
      }
    })

    it("rejects key with underscores", async () => {
      const repository = createInMemoryFlagRepository()
      const input: CreateFlagInput = {
        key: "my_flag",
        defaultValue: true,
        description: "desc",
      }

      const result = await Effect.runPromise(
        createFeatureFlag(input, repository).pipe(Effect.either)
      )

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(InvalidFlagKeyError)
      }
    })

    it("accepts valid single word key", async () => {
      const repository = createInMemoryFlagRepository()
      const input: CreateFlagInput = {
        key: "flag",
        defaultValue: true,
        description: "desc",
      }

      const result = await Effect.runPromise(
        createFeatureFlag(input, repository).pipe(Effect.either)
      )

      expect(result._tag).toBe("Right")
      if (result._tag === "Right") {
        expect(result.right.key).toBe("flag")
      }
    })

    it("accepts valid kebab-case key", async () => {
      const repository = createInMemoryFlagRepository()
      const input: CreateFlagInput = {
        key: "my-flag",
        defaultValue: true,
        description: "desc",
      }

      const result = await Effect.runPromise(
        createFeatureFlag(input, repository).pipe(Effect.either)
      )

      expect(result._tag).toBe("Right")
      if (result._tag === "Right") {
        expect(result.right.key).toBe("my-flag")
      }
    })

    it("trims description whitespace", async () => {
      const repository = createInMemoryFlagRepository()
      const input: CreateFlagInput = {
        key: "test-flag",
        defaultValue: true,
        description: "  valid description  ",
      }

      const result = await Effect.runPromise(
        createFeatureFlag(input, repository).pipe(Effect.either)
      )

      expect(result._tag).toBe("Right")
      if (result._tag === "Right") {
        expect(result.right.description).toBe("valid description")
      }
    })

    it("accepts minimal description", async () => {
      const repository = createInMemoryFlagRepository()
      const input: CreateFlagInput = {
        key: "test-flag",
        defaultValue: false,
        description: "x",
      }

      const result = await Effect.runPromise(
        createFeatureFlag(input, repository).pipe(Effect.either)
      )

      expect(result._tag).toBe("Right")
      if (result._tag === "Right") {
        expect(result.right.description).toBe("x")
      }
    })
  })
})
