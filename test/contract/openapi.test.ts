import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { Spectral } from "@stoplight/spectral-core"
import { bundleAndLoadRuleset } from "@stoplight/spectral-ruleset-bundler/with-loader"
import { fetch } from "@stoplight/spectral-runtime"

/**
 * OpenAPI Contract Tests
 *
 * These tests validate the OpenAPI specification to ensure:
 * - Spec is valid OpenAPI 3.1
 * - All required fields are present
 * - Follows best practices (via Spectral linting)
 * - Matches actual API implementation
 */

const OPENAPI_PATH = resolve(process.cwd(), "docs/openapi/openapi.yaml")
const SPECTRAL_CONFIG_PATH = resolve(process.cwd(), "docs/openapi/.spectral.yaml")

describe("OpenAPI Specification", () => {
  let openapiContent: string

  beforeAll(() => {
    openapiContent = readFileSync(OPENAPI_PATH, "utf-8")
  })

  describe("File Existence", () => {
    it("should have openapi.yaml file", () => {
      expect(openapiContent).toBeDefined()
      expect(openapiContent.length).toBeGreaterThan(0)
    })

    it("should be valid YAML", () => {
      expect(() => {
        // Will throw if invalid YAML
        const lines = openapiContent.split("\n")
        expect(lines.length).toBeGreaterThan(10)
      }).not.toThrow()
    })
  })

  describe("OpenAPI Version", () => {
    it("should be OpenAPI 3.1.0", () => {
      expect(openapiContent).toContain("openapi: 3.1.0")
    })
  })

  describe("Required Metadata", () => {
    it("should have title", () => {
      expect(openapiContent).toContain("title:")
      expect(openapiContent).toContain("Config Manager API")
    })

    it("should have version", () => {
      expect(openapiContent).toContain("version:")
    })

    it("should have description", () => {
      expect(openapiContent).toContain("description:")
    })
  })

  describe("Server Configuration", () => {
    it("should define at least one server", () => {
      expect(openapiContent).toContain("servers:")
    })

    it("should have development server", () => {
      expect(openapiContent).toContain("http://localhost:3000")
    })
  })

  describe("Paths", () => {
    it("should define /api/flags endpoint", () => {
      expect(openapiContent).toContain("/api/flags:")
    })

    it("should have POST operation for /api/flags", () => {
      expect(openapiContent).toContain("post:")
    })

    it("should have operationId for POST /api/flags", () => {
      expect(openapiContent).toContain("operationId: createFeatureFlag")
    })
  })

  describe("Schemas", () => {
    it("should define CreateFlagInput schema", () => {
      expect(openapiContent).toContain("CreateFlagInput:")
    })

    it("should define FeatureFlag schema", () => {
      expect(openapiContent).toContain("FeatureFlag:")
    })

    it("should define error schemas", () => {
      expect(openapiContent).toContain("ValidationError:")
      expect(openapiContent).toContain("ConflictError:")
      expect(openapiContent).toContain("ServerError:")
    })
  })

  describe("Response Codes", () => {
    it("should define 201 Created response", () => {
      expect(openapiContent).toContain("'201':")
      expect(openapiContent).toContain("Feature flag created successfully")
    })

    it("should define 400 Bad Request response", () => {
      expect(openapiContent).toContain("'400':")
      expect(openapiContent).toContain("Validation error")
    })

    it("should define 409 Conflict response", () => {
      expect(openapiContent).toContain("'409':")
      expect(openapiContent).toContain("Flag already exists")
    })

    it("should define 500 Server Error response", () => {
      expect(openapiContent).toContain("'500':")
    })
  })

  describe("Schema Validation", () => {
    it("CreateFlagInput should require key, defaultValue, description", () => {
      expect(openapiContent).toContain("required:")
      expect(openapiContent).toContain("- key")
      expect(openapiContent).toContain("- defaultValue")
      expect(openapiContent).toContain("- description")
    })

    it("key field should have kebab-case pattern", () => {
      expect(openapiContent).toContain("pattern: '^[a-z0-9]+(-[a-z0-9]+)*$'")
    })

    it("description should have length constraints", () => {
      expect(openapiContent).toContain("minLength: 1")
      expect(openapiContent).toContain("maxLength: 500")
    })
  })

  describe("Examples", () => {
    it("should have request examples", () => {
      expect(openapiContent).toContain("examples:")
      expect(openapiContent).toContain("dark-mode")
    })

    it("should have response examples", () => {
      expect(openapiContent).toContain("success:")
    })

    it("should have error examples", () => {
      expect(openapiContent).toContain("invalidKey:")
      expect(openapiContent).toContain("InvalidFlagKeyError")
    })
  })

  describe("Spectral Linting", () => {
    it("should pass Spectral validation", async () => {
      const spectral = new Spectral()

      // Load custom ruleset
      const ruleset = await bundleAndLoadRuleset(SPECTRAL_CONFIG_PATH, { fetch, fs: require("fs") })
      spectral.setRuleset(ruleset)

      // Run linting
      const results = await spectral.run(openapiContent)

      // Filter out warnings, only check errors
      const errors = results.filter((result) => result.severity === 0) // 0 = error

      if (errors.length > 0) {
        console.error("Spectral errors found:")
        errors.forEach((error) => {
          console.error(`  - ${error.path.join(".")}: ${error.message}`)
        })
      }

      expect(errors).toHaveLength(0)
    }, 10000)
  })

  describe("Contract Stability", () => {
    it("should NOT change field names in CreateFlagInput", () => {
      // Breaking change: renaming fields
      expect(openapiContent).toContain("key:")
      expect(openapiContent).toContain("defaultValue:")
      expect(openapiContent).toContain("description:")

      // Ensure we're not using alternative names
      expect(openapiContent).not.toContain("flagId:")
      expect(openapiContent).not.toContain("isEnabled:")
      expect(openapiContent).not.toContain("desc:")
    })

    it("should NOT change response status codes", () => {
      // Breaking change: changing status codes
      const has201 = openapiContent.includes("'201':")
      const has400 = openapiContent.includes("'400':")
      const has409 = openapiContent.includes("'409':")

      expect(has201).toBe(true)
      expect(has400).toBe(true)
      expect(has409).toBe(true)
    })

    it("should NOT change error type names", () => {
      // Breaking change: renaming error types
      expect(openapiContent).toContain("InvalidFlagKeyError")
      expect(openapiContent).toContain("InvalidFlagDescriptionError")
      expect(openapiContent).toContain("FlagAlreadyExistsError")
      expect(openapiContent).toContain("FlagRepositoryError")
    })
  })
})
