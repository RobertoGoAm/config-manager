import { Schema } from "effect"

/**
 * JSON-logic style rule tree for configuration evaluation.
 * Supports recursive AND/OR operations and leaf equality checks.
 */

// Leaf node: equality check
const EqRule = Schema.Struct({
  op: Schema.Literal("EQ"),
  field: Schema.String,
  value: Schema.Unknown,
})

// Recursive structure definition
export const Rule: Schema.Schema<Rule> = Schema.suspend(() =>
  Schema.Union(
    EqRule,
    Schema.Struct({
      op: Schema.Literal("AND"),
      rules: Schema.Array(Rule),
    }),
    Schema.Struct({
      op: Schema.Literal("OR"),
      rules: Schema.Array(Rule),
    }),
  ),
)

// eslint-disable-next-line no-redeclare
export type Rule =
  | { readonly op: "EQ"; readonly field: string; readonly value: unknown }
  | { readonly op: "AND"; readonly rules: ReadonlyArray<Rule> }
  | { readonly op: "OR"; readonly rules: ReadonlyArray<Rule> }

// Context for evaluation
export const Context = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})

// eslint-disable-next-line no-redeclare
export type Context = Schema.Schema.Type<typeof Context>
