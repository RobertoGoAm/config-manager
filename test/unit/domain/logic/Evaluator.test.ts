import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import * as fc from "fast-check"
import { evaluate } from "@domain/logic/Evaluator.js"
import type { Rule, Context } from "@domain/schema/Rule.js"

/**
 * Fast-check arbitraries for generating random Rules and Contexts
 */

const arbitraryContext = (): fc.Arbitrary<Context> => fc.dictionary(fc.string(), fc.anything())

const arbitraryRule = (depth = 0): fc.Arbitrary<Rule> => {
  const eqRule = fc.record({
    op: fc.constant("EQ" as const),
    field: fc.string(),
    value: fc.anything(),
  })

  if (depth > 3) {
    return eqRule
  }

  const andRule = fc.record({
    op: fc.constant("AND" as const),
    rules: fc.array(arbitraryRule(depth + 1), { minLength: 1, maxLength: 3 }),
  })

  const orRule = fc.record({
    op: fc.constant("OR" as const),
    rules: fc.array(arbitraryRule(depth + 1), { minLength: 1, maxLength: 3 }),
  })

  return fc.oneof(eqRule, andRule, orRule)
}

/**
 * Helper to run an Effect and extract the result
 */
const runEffect = <A, E>(
  effect: Effect.Effect<A, E>,
): { success: true; value: A } | { success: false; error: E } => {
  const exit = Effect.runSyncExit(effect)

  if (exit._tag === "Success") {
    return { success: true, value: exit.value }
  } else {
    // Recursively extract the first error from any cause structure
    const extractError = (cause: any): E | null => {
      if (cause.error !== undefined) {
        return cause.error
      }
      if (cause.left !== undefined) {
        const leftError = extractError(cause.left)
        if (leftError !== null) return leftError
      }
      if (cause.right !== undefined) {
        const rightError = extractError(cause.right)
        if (rightError !== null) return rightError
      }
      return null
    }

    const error = extractError(exit.cause)
    if (error !== null) {
      return { success: false, error }
    }

    throw new Error(`Unexpected cause without error: ${JSON.stringify(exit.cause)}`)
  }
}

describe("Evaluator", () => {
  describe("Property-Based Tests", () => {
    it("should never crash given random inputs", () => {
      fc.assert(
        fc.property(arbitraryRule(), arbitraryContext(), (rule, context) => {
          const result = runEffect(evaluate(rule, context))
          // The evaluator must always return a result (success or typed error)
          expect(result).toBeDefined()

          if (result.success) {
            expect(typeof result.value).toBe("boolean")
          } else {
            // Errors must be typed
            expect(
              result.error._tag === "FieldNotFoundError" || result.error._tag === "EmptyRulesError",
            ).toBe(true)
          }
        }),
        { numRuns: 1000 },
      )
    })

    it("EQ rule with matching value should always return true", () => {
      fc.assert(
        fc.property(fc.string(), fc.anything(), (field, value) => {
          const rule: Rule = { op: "EQ", field, value }
          const context: Context = { [field]: value }

          const result = runEffect(evaluate(rule, context))

          if (result.success) {
            expect(result.value).toBe(true)
          }
        }),
        { numRuns: 1000 },
      )
    })

    it("EQ rule with non-matching value should always return false", () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), fc.string(), (field, value1, value2) => {
          fc.pre(value1 !== value2) // Precondition: values must be different

          const rule: Rule = { op: "EQ", field, value: value1 }
          const context: Context = { [field]: value2 }

          const result = runEffect(evaluate(rule, context))

          if (result.success) {
            expect(result.value).toBe(false)
          }
        }),
        { numRuns: 1000 },
      )
    })

    it("AND with all true rules should return true", () => {
      fc.assert(
        fc.property(fc.array(fc.string(), { minLength: 1, maxLength: 5 }), (fields) => {
          const rules: Rule[] = fields.map((field) => ({
            op: "EQ" as const,
            field,
            value: "test",
          }))

          const andRule: Rule = { op: "AND", rules }
          const context: Context = Object.fromEntries(fields.map((field) => [field, "test"]))

          const result = runEffect(evaluate(andRule, context))

          if (result.success) {
            expect(result.value).toBe(true)
          }
        }),
        { numRuns: 1000 },
      )
    })

    it("OR with at least one true rule should return true", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 2, maxLength: 5 }),
          fc.nat(),
          (fields, indexSeed) => {
            const trueIndex = indexSeed % fields.length

            const rules: Rule[] = fields.map((field, i) => ({
              op: "EQ" as const,
              field,
              value: i === trueIndex ? "match" : "nomatch",
            }))

            const orRule: Rule = { op: "OR", rules }
            const context: Context = Object.fromEntries(fields.map((field) => [field, "match"]))

            const result = runEffect(evaluate(orRule, context))

            if (result.success) {
              expect(result.value).toBe(true)
            }
          },
        ),
        { numRuns: 1000 },
      )
    })
  })

  describe("Edge Cases", () => {
    it("should fail when field is not in context", () => {
      const rule: Rule = { op: "EQ", field: "missing", value: "test" }
      const context: Context = {}

      const result = runEffect(evaluate(rule, context))

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error._tag).toBe("FieldNotFoundError")
        if (result.error._tag === "FieldNotFoundError") {
          expect(result.error.field).toBe("missing")
        }
      }
    })

    it("should fail when AND has empty rules", () => {
      const rule: Rule = { op: "AND", rules: [] }
      const context: Context = {}

      const result = runEffect(evaluate(rule, context))

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error._tag).toBe("EmptyRulesError")
      }
    })

    it("should fail when OR has empty rules", () => {
      const rule: Rule = { op: "OR", rules: [] }
      const context: Context = {}

      const result = runEffect(evaluate(rule, context))

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error._tag).toBe("EmptyRulesError")
      }
    })

    it("should handle deep equality for objects", () => {
      const rule: Rule = {
        op: "EQ",
        field: "user",
        value: { name: "Alice", age: 30 },
      }
      const context: Context = {
        user: { name: "Alice", age: 30 },
      }

      const result = runEffect(evaluate(rule, context))

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })

    it("should handle deep nested rules", () => {
      const rule: Rule = {
        op: "AND",
        rules: [
          { op: "EQ", field: "a", value: 1 },
          {
            op: "OR",
            rules: [
              { op: "EQ", field: "b", value: 2 },
              { op: "EQ", field: "c", value: 3 },
            ],
          },
        ],
      }
      const context: Context = { a: 1, b: 2, c: 99 }

      const result = runEffect(evaluate(rule, context))

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(true)
      }
    })
  })
})
