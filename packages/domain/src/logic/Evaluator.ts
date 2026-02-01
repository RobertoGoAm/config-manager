import { Effect } from "effect"
import type { Rule, Context } from "../schema/Rule.js"

/**
 * Errors that can occur during rule evaluation
 */
export interface FieldNotFoundError {
  readonly _tag: "FieldNotFoundError"
  readonly field: string
}

// eslint-disable-next-line no-redeclare
export const FieldNotFoundError = (field: string): FieldNotFoundError => ({
  _tag: "FieldNotFoundError",
  field,
})

export interface EmptyRulesError {
  readonly _tag: "EmptyRulesError"
  readonly operator: "AND" | "OR"
}

// eslint-disable-next-line no-redeclare
export const EmptyRulesError = (operator: "AND" | "OR"): EmptyRulesError => ({
  _tag: "EmptyRulesError",
  operator,
})

/**
 * Pure evaluator that interprets a Rule against a Context.
 * Never throws - all errors are typed and handled via Effect.
 */
export const evaluate = (
  rule: Rule,
  context: Context,
): Effect.Effect<boolean, FieldNotFoundError | EmptyRulesError> =>
  Effect.gen(function* () {
    switch (rule.op) {
      case "EQ": {
        const fieldValue = context[rule.field]

        if (fieldValue === undefined) {
          return yield* Effect.fail(FieldNotFoundError(rule.field))
        }

        // Deep equality check
        return JSON.stringify(fieldValue) === JSON.stringify(rule.value)
      }

      case "AND": {
        if (rule.rules.length === 0) {
          return yield* Effect.fail(EmptyRulesError("AND"))
        }

        // Evaluate all rules and check if all are true
        const results = yield* Effect.all(
          rule.rules.map((r) => evaluate(r, context)),
          { concurrency: "unbounded" },
        )

        return results.every((result) => result === true)
      }

      case "OR": {
        if (rule.rules.length === 0) {
          return yield* Effect.fail(EmptyRulesError("OR"))
        }

        // Evaluate all rules and check if any is true
        const results = yield* Effect.all(
          rule.rules.map((r) => evaluate(r, context)),
          { concurrency: "unbounded" },
        )

        return results.some((result) => result === true)
      }
    }
  })
