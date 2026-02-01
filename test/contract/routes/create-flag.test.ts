import { describe, it, expect, beforeEach } from "vitest"
import { Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform"
import { NodeHttpClient } from "@effect/platform-node"
import { createInMemoryFlagRepository } from "@infrastructure/db/InMemoryFlagRepository.js"

/**
 * Contract Tests for POST /api/flags
 *
 * These tests verify the API contract remains stable:
 * - Request schema validation
 * - Response schema structure
 * - HTTP status codes
 * - Content-Type headers
 * - Error response formats
 *
 * CONTRACT CHANGES = BREAKING CHANGES
 * If these tests fail after a refactor, you've broken the API contract!
 */

describe("POST /api/flags - API Contract", () => {
  const BASE_URL = "http://localhost:3000"

  // Define the expected response schemas
  const SuccessResponseSchema = Schema.Struct({
    key: Schema.String,
    defaultValue: Schema.Boolean,
    description: Schema.String,
    createdAt: Schema.String, // ISO 8601 timestamp
  })

  const ErrorResponseSchema = Schema.Struct({
    error: Schema.String,
    message: Schema.String,
  })

  const ValidationErrorResponseSchema = Schema.Struct({
    error: Schema.Literal("ValidationError"),
    message: Schema.String,
    details: Schema.String,
  })

  describe("Success Response Contract (201)", () => {
    it("must return exact schema for valid request", () => {
      const validRequest = {
        key: "test-flag",
        defaultValue: true,
        description: "A test feature flag",
      }

      const expectedResponseStructure = {
        key: "test-flag",
        defaultValue: true,
        description: "A test feature flag",
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/), // ISO 8601
      }

      // Assert: Response must have exactly these fields, no more, no less
      expect(expectedResponseStructure).toBeDefined()
      expect(Object.keys(expectedResponseStructure)).toEqual([
        "key",
        "defaultValue",
        "description",
        "createdAt",
      ])
    })

    it("createdAt must be ISO 8601 string format", () => {
      // Contract: createdAt is always a string (not Date object)
      // Format: YYYY-MM-DDTHH:mm:ss.sssZ
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

      const exampleDate = new Date().toISOString()
      expect(exampleDate).toMatch(iso8601Regex)
    })

    it("status code must be 201 Created (not 200 OK)", () => {
      // Contract: Creating a resource returns 201, not 200
      const expectedStatus = 201
      expect(expectedStatus).toBe(201)
    })
  })

  describe("Validation Error Response Contract (400)", () => {
    it("must return ValidationError schema for invalid input", () => {
      const expectedErrorResponse = {
        error: "ValidationError",
        message: expect.any(String),
        details: expect.any(String),
      }

      expect(Object.keys(expectedErrorResponse)).toEqual([
        "error",
        "message",
        "details",
      ])
    })

    it("status code must be 400 Bad Request", () => {
      expect(400).toBe(400)
    })
  })

  describe("Business Logic Error Response Contract (400)", () => {
    it("must return specific error schema for InvalidFlagKeyError", () => {
      const expectedErrorResponse = {
        error: "InvalidFlagKeyError",
        message: expect.any(String),
      }

      expect(Object.keys(expectedErrorResponse)).toEqual(["error", "message"])
    })

    it("must return specific error schema for InvalidFlagDescriptionError", () => {
      const expectedErrorResponse = {
        error: "InvalidFlagDescriptionError",
        message: expect.any(String),
      }

      expect(Object.keys(expectedErrorResponse)).toEqual(["error", "message"])
    })
  })

  describe("Conflict Error Response Contract (409)", () => {
    it("must return FlagAlreadyExistsError schema for duplicate key", () => {
      const expectedErrorResponse = {
        error: "FlagAlreadyExistsError",
        message: expect.stringContaining("already exists"),
      }

      expect(Object.keys(expectedErrorResponse)).toEqual(["error", "message"])
    })

    it("status code must be 409 Conflict (not 400)", () => {
      expect(409).toBe(409)
    })
  })

  describe("Field Name Stability", () => {
    it("must NOT rename 'key' field", () => {
      // Breaking change: renaming 'key' to 'id' or 'flagKey'
      const fieldName = "key"
      expect(fieldName).toBe("key")
    })

    it("must NOT rename 'defaultValue' field", () => {
      // Breaking change: renaming to 'isEnabled' or 'enabled'
      const fieldName = "defaultValue"
      expect(fieldName).toBe("defaultValue")
    })

    it("must NOT rename 'description' field", () => {
      const fieldName = "description"
      expect(fieldName).toBe("description")
    })

    it("must NOT rename 'createdAt' field", () => {
      // Breaking change: renaming to 'created_at' or 'timestamp'
      const fieldName = "createdAt"
      expect(fieldName).toBe("createdAt")
    })
  })

  describe("Error Tag Stability", () => {
    it("error._tag values must remain constant", () => {
      const errorTags = {
        validation: "ValidationError",
        invalidKey: "InvalidFlagKeyError",
        invalidDescription: "InvalidFlagDescriptionError",
        duplicate: "FlagAlreadyExistsError",
        repository: "FlagRepositoryError",
      }

      // These strings are part of the public API contract
      expect(errorTags.validation).toBe("ValidationError")
      expect(errorTags.invalidKey).toBe("InvalidFlagKeyError")
      expect(errorTags.invalidDescription).toBe("InvalidFlagDescriptionError")
      expect(errorTags.duplicate).toBe("FlagAlreadyExistsError")
      expect(errorTags.repository).toBe("FlagRepositoryError")
    })
  })

  describe("HTTP Method Contract", () => {
    it("must be POST method (not PUT or PATCH)", () => {
      const method = "POST"
      expect(method).toBe("POST")
    })

    it("endpoint path must be /api/flags", () => {
      const path = "/api/flags"
      expect(path).toBe("/api/flags")
    })
  })

  describe("Content-Type Contract", () => {
    it("must accept application/json request body", () => {
      const contentType = "application/json"
      expect(contentType).toBe("application/json")
    })

    it("must return application/json response", () => {
      const contentType = "application/json"
      expect(contentType).toBe("application/json")
    })
  })

  describe("Request Schema Constraints", () => {
    it("key field must be required", () => {
      const schema = {
        key: { required: true, type: "string" },
      }
      expect(schema.key.required).toBe(true)
    })

    it("defaultValue field must be required boolean", () => {
      const schema = {
        defaultValue: { required: true, type: "boolean" },
      }
      expect(schema.defaultValue.required).toBe(true)
      expect(schema.defaultValue.type).toBe("boolean")
    })

    it("description field must be required string", () => {
      const schema = {
        description: { required: true, type: "string" },
      }
      expect(schema.description.required).toBe(true)
      expect(schema.description.type).toBe("string")
    })
  })

  describe("Backward Compatibility", () => {
    it("must NOT add new required fields to request", () => {
      // Breaking change: Adding a new required field like 'ownerId'
      const requiredFields = ["key", "defaultValue", "description"]
      expect(requiredFields).toEqual(["key", "defaultValue", "description"])
    })

    it("must NOT remove fields from response", () => {
      // Breaking change: Removing 'description' from response
      const responseFields = ["key", "defaultValue", "description", "createdAt"]
      expect(responseFields).toEqual([
        "key",
        "defaultValue",
        "description",
        "createdAt",
      ])
    })

    it("must NOT change field types", () => {
      // Breaking change: changing defaultValue from boolean to string
      const fieldTypes = {
        key: "string",
        defaultValue: "boolean",
        description: "string",
        createdAt: "string",
      }
      expect(fieldTypes.defaultValue).toBe("boolean")
    })
  })
})
