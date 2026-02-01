# OpenAPI Specification

This directory contains the OpenAPI 3.1 specification for the Config Manager API.

## Files

- `openapi.yaml` - The main OpenAPI specification
- `.spectral.yaml` - Spectral linting rules for API design standards

## Workflow

### 1. Edit the OpenAPI Spec

Edit `openapi.yaml` to add or modify API endpoints.

**Best practices:**

- Use kebab-case for paths (`/api/feature-flags`)
- Include examples for all requests and responses
- Document all error responses
- Use schema references (`$ref`) to avoid duplication

### 2. Validate the Spec

```bash
# Lint with Spectral (checks best practices)
pnpm openapi:validate

# Quick lint
pnpm openapi:lint
```

**This runs automatically in `pnpm check`!**

### 3. Generate TypeScript Types

```bash
# Generate types from OpenAPI spec
pnpm openapi:generate
```

**Output:** `packages/infrastructure/src/http/types/api.d.ts`

**Benefits:**

- Type-safe API client
- Auto-completion in IDE
- Compiler catches API contract violations

### 4. Use Generated Types

```typescript
import type { components, operations } from "@infrastructure/http/types/api"

// Request type
type CreateFlagRequest = components["schemas"]["CreateFlagInput"]

// Response type
type CreateFlagResponse = components["schemas"]["FeatureFlag"]

// Operation type (includes request + response)
type CreateFlagOp = operations["createFeatureFlag"]
```

## Contract Tests

The OpenAPI spec is tested in `test/contract/openapi.test.ts`:

```bash
pnpm test:contract
```

**Tests verify:**

- ✅ Spec is valid OpenAPI 3.1
- ✅ All required fields present
- ✅ Follows best practices (via Spectral)
- ✅ Contract stability (field names, status codes)

**Breaking changes caught:**

- ❌ Renaming fields (`key` → `id`)
- ❌ Changing status codes (201 → 200)
- ❌ Removing required fields
- ❌ Changing error response formats

## Spectral Rules

`.spectral.yaml` enforces:

- ✅ All operations have `operationId`
- ✅ All operations have descriptions
- ✅ All operations have examples
- ✅ All operations have tags
- ✅ Security best practices
- ⚠️ Tags have descriptions (warning)

## Integration with Development

### Pre-commit Hook (Recommended)

```bash
# .husky/pre-commit or similar
pnpm openapi:validate
pnpm openapi:generate
git add packages/infrastructure/src/http/types/api.d.ts
```

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
- name: Validate OpenAPI
  run: pnpm openapi:validate

- name: Generate types
  run: pnpm openapi:generate

- name: Check for uncommitted changes
  run: git diff --exit-code packages/infrastructure/src/http/types/api.d.ts
```

## Viewing the Spec

### VS Code Extension

Install: [OpenAPI (Swagger) Editor](https://marketplace.visualstudio.com/items?itemName=42Crunch.vscode-openapi)

### Swagger UI (Local)

```bash
npx @redocly/cli preview-docs docs/openapi/openapi.yaml
```

### Online

Upload `openapi.yaml` to:

- https://editor.swagger.io/
- https://redocly.com/redoc/

## Adding New Endpoints

1. **Define in OpenAPI** (`openapi.yaml`)

```yaml
paths:
  /api/flags/{id}:
    get:
      operationId: getFeatureFlag
      summary: Get a feature flag by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Feature flag found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/FeatureFlag"
```

2. **Validate**

```bash
pnpm openapi:validate
```

3. **Generate types**

```bash
pnpm openapi:generate
```

4. **Implement in code**

```typescript
// packages/api/src/routes/flags.ts
import type { operations } from "@infrastructure/http/types/api"

type GetFlagOp = operations["getFeatureFlag"]
// Now you have full type safety!
```

5. **Add contract tests**

```typescript
// test/contract/routes/get-flag.test.ts
it("must return FeatureFlag schema", () => {
  // Verify response matches OpenAPI spec
})
```

## Troubleshooting

### "Module not found: @infrastructure/http/types/api"

Run: `pnpm openapi:generate`

### Spectral validation fails

Check the error output - it will tell you exactly what's wrong and where.

Common issues:

- Missing `operationId`
- Missing `description`
- Missing examples
- Invalid schema references

### Types are out of sync

If you changed `openapi.yaml` but types are old:

```bash
pnpm openapi:generate
```

Make this part of your `pnpm check` or pre-commit hook!
