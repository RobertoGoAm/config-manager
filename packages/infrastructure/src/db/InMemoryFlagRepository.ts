import { Effect } from "effect"
import type { FeatureFlag } from "@domain/schema/FeatureFlag.js"
import { FlagRepositoryError, type FlagRepository } from "@domain/logic/FeatureFlag.js"

/**
 * In-memory implementation of FlagRepository
 * Uses a Map for O(1) lookups by key
 */
export const createInMemoryFlagRepository = (): FlagRepository => {
  const flags = new Map<string, FeatureFlag>()

  return {
    exists: (key: string) =>
      Effect.sync(() => flags.has(key)).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new FlagRepositoryError({
              message: `Failed to check flag existence: ${String(error)}`,
            }),
          ),
        ),
      ),

    save: (flag: FeatureFlag) =>
      Effect.sync(() => {
        flags.set(flag.key, flag)
        return flag
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new FlagRepositoryError({
              message: `Failed to save flag: ${String(error)}`,
            }),
          ),
        ),
      ),
  }
}
