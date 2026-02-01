import { Effect } from "effect"
import { createFeatureFlag } from "@domain/logic/FeatureFlag"
import { createInMemoryFlagRepository } from "@infrastructure/db/InMemoryFlagRepository"
import type { CreateFlagInput } from "@domain/schema/FeatureFlag"

/**
 * Nuxt Server API Route - POST /api/flags
 *
 * This demonstrates the power of the functional monolith:
 * - Direct access to @domain, @infrastructure packages
 * - Full type safety (TypeScript knows about CreateFlagInput)
 * - No HTTP overhead (runs in same process)
 * - Can use Effect directly in Nuxt server routes
 */

export default defineEventHandler(async (event) => {
  // Read request body with type safety
  const input = await readBody<CreateFlagInput>(event)

  // Create repository
  const repository = createInMemoryFlagRepository()

  // Use domain logic directly - no API calls needed!
  const program = createFeatureFlag(input, repository)

  // Run the Effect program
  const result = await Effect.runPromise(program.pipe(Effect.either))

  // Handle result
  if (result._tag === "Left") {
    const error = result.left

    if (error._tag === "InvalidFlagKeyError" || error._tag === "InvalidFlagDescriptionError") {
      throw createError({
        statusCode: 400,
        statusMessage: error._tag,
        message: error.reason,
      })
    }

    if (error._tag === "FlagAlreadyExistsError") {
      throw createError({
        statusCode: 409,
        statusMessage: "FlagAlreadyExistsError",
        message: `Flag with key '${error.key}' already exists`,
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: error._tag,
      message: error.message,
    })
  }

  const flag = result.right

  // Return success response
  return {
    key: flag.key,
    defaultValue: flag.defaultValue,
    description: flag.description,
    createdAt: flag.createdAt.toISOString(),
  }
})
