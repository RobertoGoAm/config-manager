import { Effect } from "effect"
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Schema } from "effect"
import { createServer } from "node:http"
import { createInMemoryFlagRepository } from "@infrastructure/db/InMemoryFlagRepository.js"
import { createFeatureFlag } from "@domain/logic/FeatureFlag.js"
import { CreateFlagInput } from "@domain/schema/FeatureFlag.js"

/**
 * HTTP Server for Configuration Management System
 */

// Create repository instance
const flagRepository = createInMemoryFlagRepository()

// POST /api/flags route handler
const createFlagHandler = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const body = yield* request.json

  // Parse input
  const parseResult = yield* Schema.decodeUnknown(CreateFlagInput)(body).pipe(Effect.either)

  if (parseResult._tag === "Left") {
    return yield* HttpServerResponse.json(
      {
        error: "ValidationError",
        message: "Invalid input",
        details: parseResult.left.message,
      },
      { status: 400 },
    )
  }

  // Create flag
  const result = yield* createFeatureFlag(parseResult.right, flagRepository).pipe(Effect.either)

  if (result._tag === "Left") {
    const error = result.left
    if (error._tag === "InvalidFlagKeyError" || error._tag === "InvalidFlagDescriptionError") {
      return yield* HttpServerResponse.json(
        {
          error: error._tag,
          message: error.reason,
        },
        { status: 400 },
      )
    }
    if (error._tag === "FlagAlreadyExistsError") {
      return yield* HttpServerResponse.json(
        {
          error: error._tag,
          message: `Flag with key '${error.key}' already exists`,
        },
        { status: 409 },
      )
    }
    return yield* HttpServerResponse.json(
      {
        error: error._tag,
        message: error.message,
      },
      { status: 500 },
    )
  }

  const flag = result.right
  return yield* HttpServerResponse.json(
    {
      key: flag.key,
      defaultValue: flag.defaultValue,
      description: flag.description,
      createdAt: flag.createdAt.toISOString(),
    },
    { status: 201 },
  )
})

// Define router
const router = HttpRouter.empty.pipe(HttpRouter.post("/api/flags", createFlagHandler))

// Create server layer
const HttpLive = HttpServer.serve(router)

const ServerLive = NodeHttpServer.layer(() => createServer(), { port: 3000 })

// Run the server
const program = Effect.log("Starting Configuration Management Server on port 3000").pipe(
  Effect.zipRight(Effect.never),
)

program.pipe(Effect.provide(HttpLive), Effect.provide(ServerLive), NodeRuntime.runMain)
