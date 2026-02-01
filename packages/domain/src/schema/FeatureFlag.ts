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
  Schema.transform(Schema.String, {
    strict: true,
    decode: (s) => s.trim(),
    encode: (s) => s,
  }),
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

// eslint-disable-next-line no-redeclare
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

// eslint-disable-next-line no-redeclare
export type FeatureFlag = Schema.Schema.Type<typeof FeatureFlag>
