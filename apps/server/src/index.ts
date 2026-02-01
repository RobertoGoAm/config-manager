#!/usr/bin/env node
/**
 * Standalone API Server Entry Point
 *
 * Runs the Effect-based HTTP API server on port 3000.
 * This is used for:
 * - Development of the API
 * - Running API separately from the Nuxt frontend
 * - Testing and CI/CD
 */

// Import and run the server
import "@api/server.js"
