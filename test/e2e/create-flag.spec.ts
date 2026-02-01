import { test, expect } from "@playwright/test"

const API_BASE_URL = "http://localhost:3000"

test.describe("POST /api/flags - Create Feature Flag", () => {
  test("creates new feature flag", async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/flags`, {
      data: {
        key: "test-flag-" + Date.now(),
        defaultValue: true,
        description: "Test flag for E2E testing",
      },
    })

    expect(response.status()).toBe(201)
    const body = await response.json()
    expect(body.key).toMatch(/^[a-z0-9-]+$/)
    expect(body.defaultValue).toBe(true)
    expect(body.description).toBe("Test flag for E2E testing")
    expect(body.createdAt).toBeTruthy()
  })

  test("rejects duplicate key", async ({ request }) => {
    const key = "duplicate-test-" + Date.now()

    // First creation succeeds
    const firstResponse = await request.post(`${API_BASE_URL}/api/flags`, {
      data: {
        key,
        defaultValue: true,
        description: "First flag",
      },
    })
    expect(firstResponse.status()).toBe(201)

    // Second creation fails
    const response = await request.post(`${API_BASE_URL}/api/flags`, {
      data: {
        key,
        defaultValue: false,
        description: "Second flag",
      },
    })

    expect(response.status()).toBe(409) // Conflict
    const body = await response.json()
    expect(body.data.error).toBe("FlagAlreadyExistsError")
  })

  test("rejects non-kebab-case key", async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/flags`, {
      data: {
        key: "InvalidKey",
        defaultValue: true,
        description: "Test description",
      },
    })

    expect(response.status()).toBe(400) // Bad Request
    const body = await response.json()
    expect(body.data.error).toBe("InvalidFlagKeyError")
  })

  test("rejects empty description", async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/flags`, {
      data: {
        key: "test-flag-" + Date.now(),
        defaultValue: false,
        description: "",
      },
    })

    expect(response.status()).toBe(400) // Bad Request
    const body = await response.json()
    expect(body.data.error).toBe("InvalidFlagDescriptionError")
  })

  test("rejects missing description", async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/flags`, {
      data: {
        key: "test-flag-" + Date.now(),
        defaultValue: false,
      },
    })

    expect(response.status()).toBe(400) // Bad Request
    const body = await response.json()
    expect(body.data.error).toBe("InvalidFlagDescriptionError")
  })

  test("trims description whitespace", async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/flags`, {
      data: {
        key: "test-flag-" + Date.now(),
        defaultValue: true,
        description: "  trimmed description  ",
      },
    })

    expect(response.status()).toBe(201)
    const body = await response.json()
    expect(body.description).toBe("trimmed description")
  })

  test("rejects description exceeding 500 characters", async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/flags`, {
      data: {
        key: "test-flag-" + Date.now(),
        defaultValue: true,
        description: "x".repeat(501),
      },
    })

    expect(response.status()).toBe(400) // Bad Request
    const body = await response.json()
    expect(body.data.error).toBe("InvalidFlagDescriptionError")
  })
})
