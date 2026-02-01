import { Effect, Data } from "effect"
import type { FeatureFlag, CreateFlagInput } from "../schema/FeatureFlag.js"

/**
 * Error Types
 * eslint-disable-next-line functional/no-classes
 * Data.TaggedError uses classes which is the Effect standard pattern
 */
// eslint-disable-next-line functional/no-classes
export class InvalidFlagKeyError extends Data.TaggedError("InvalidFlagKeyError")<{
  readonly key: string
  readonly reason: string
}> {}

// eslint-disable-next-line functional/no-classes
export class InvalidFlagDescriptionError extends Data.TaggedError("InvalidFlagDescriptionError")<{
  readonly description: string
  readonly reason: string
}> {}

// eslint-disable-next-line functional/no-classes
export class FlagAlreadyExistsError extends Data.TaggedError("FlagAlreadyExistsError")<{
  readonly key: string
}> {}

// eslint-disable-next-line functional/no-classes
export class FlagRepositoryError extends Data.TaggedError("FlagRepositoryError")<{
  readonly message: string
}> {}

/**
 * Port: Repository interface (implemented in infrastructure layer)
 */
export interface FlagRepository {
  // eslint-disable-next-line no-unused-vars
  readonly exists: (_key: string) => Effect.Effect<boolean, FlagRepositoryError>
  // eslint-disable-next-line no-unused-vars
  readonly save: (_flag: FeatureFlag) => Effect.Effect<FeatureFlag, FlagRepositoryError>
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
