# Nuxt Frontend - @config-manager/web

Full-stack Nuxt application with **direct access** to domain packages.

## Architecture Benefits

### Type-Safe Monolith

```typescript
// In app.vue (client-side)
import type { Rule } from '@domain/schema/Rule'

// In server/api/flags.post.ts (server-side)
import { createFeatureFlag } from '@domain/logic/FeatureFlag'
import { createInMemoryFlagRepository } from '@infrastructure/db/InMemoryFlagRepository'
```

**Both client and server share the same types** - zero duplication!

### No HTTP Overhead for SSR

When Nuxt renders server-side, it uses domain logic **directly**:
- No HTTP calls needed (runs in same process)
- Faster page loads
- Better DX (no API client needed)

## Development

```bash
# From root
pnpm dev              # Start Nuxt dev server

# From apps/web
pnpm dev              # Same thing
pnpm build            # Build for production
pnpm generate         # Static site generation
pnpm preview          # Preview production build
```

## Project Structure

```
apps/web/
├── app.vue                # Root component
├── pages/
│   └── index.vue         # Example: Create feature flag form
├── server/
│   └── api/
│       └── flags.post.ts # Example: POST /api/flags using @domain
├── nuxt.config.ts        # Nuxt config with workspace aliases
└── package.json
```

## How It Works

### 1. TypeScript Path Aliases

`nuxt.config.ts` maps workspace packages:

```typescript
alias: {
  '@domain': '../../packages/domain/src',
  '@infrastructure': '../../packages/infrastructure/src',
  '@api': '../../packages/api/src',
}
```

### 2. Nuxt Server Routes

Server routes (`server/api/*.ts`) can import domain logic directly:

```typescript
// server/api/flags.post.ts
import { createFeatureFlag } from '@domain/logic/FeatureFlag'

export default defineEventHandler(async (event) => {
  const input = await readBody(event)
  const repository = createInMemoryFlagRepository()

  // Domain logic runs server-side!
  const result = await Effect.runPromise(
    createFeatureFlag(input, repository).pipe(Effect.either)
  )

  return result
})
```

### 3. Client-Side Type Safety

Client code gets full TypeScript support:

```vue
<script setup lang="ts">
import type { CreateFlagInput } from '@domain/schema/FeatureFlag'

const form = ref<CreateFlagInput>({
  key: '',
  description: '',
  defaultValue: false,
})
</script>
```

## Deployment Options

### Option 1: Monolith (Recommended)

Deploy Nuxt with server routes:
- Nuxt server uses `@domain`, `@infrastructure` directly
- Single deployment artifact
- Fastest performance (no network calls)

```bash
pnpm build
pnpm start
```

### Option 2: Separated Backend

Point Nuxt to standalone API (`apps/server`):

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3000' // apps/server
    }
  }
})

// pages/index.vue
const { public: { apiBase } } = useRuntimeConfig()
const data = await $fetch(`${apiBase}/api/flags`, { /* ... */ })
```

## Migration Path

When you want to switch frameworks:

```bash
# Replace Nuxt with Next.js/SvelteKit/etc
rm -rf apps/web
npx create-next-app apps/web

# Option A: Keep monolith, use packages directly
# Configure Next.js to import @domain, @infrastructure

# Option B: Use standalone API
# Point Next.js to apps/server via HTTP
```

**Packages remain unchanged!**
