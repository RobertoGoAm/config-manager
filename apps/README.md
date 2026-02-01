# Applications

This directory contains runnable applications built on top of the shared packages.

## Current Applications

### `server/` - Standalone API Server
Runs the Effect-based HTTP API independently on port 3000.

**Use cases:**
- Developing the API without the frontend
- Running the API separately in production
- Testing and CI/CD

**Commands:**
```bash
pnpm --filter @config-manager/server dev    # Development
pnpm --filter @config-manager/server build  # Production build
pnpm --filter @config-manager/server start  # Run production build
```

---

## Planned Applications

### `web/` - Nuxt Frontend (Coming Soon)
Full-stack Nuxt application with:
- SSR/SSG support
- Nitro server integration
- Direct access to `@domain`, `@infrastructure`, `@api` packages

**Future structure:**
```
apps/web/
├── app/                    # Nuxt app directory
│   ├── components/
│   ├── composables/
│   ├── layouts/
│   ├── pages/
│   └── ...
├── server/                 # Nuxt server routes
│   ├── api/               # Can use @domain, @infrastructure directly
│   └── middleware/
├── public/
├── nuxt.config.ts
└── package.json
```

**Benefits of this architecture:**
1. **Shared domain logic** - Nuxt server can import `@domain` directly (SSR-safe)
2. **Type safety** - Share types between frontend and backend
3. **Easy migration** - Frontend can be replaced with Next.js/SvelteKit without touching packages
4. **Dual-mode deployment**:
   - **Monolith**: Nuxt server uses packages directly
   - **Separated**: Nuxt frontend calls `apps/server` API via HTTP

---

## Architecture Notes

### Dependency Flow

```
packages/domain          (Level 0: Pure logic)
      ↑
packages/infrastructure  (Level 1: Adapters)
      ↑
packages/api             (Level 2: HTTP API)
      ↑
      ├─→ apps/server    (Standalone API)
      └─→ apps/web       (Nuxt app - can use all packages)
```

### Frontend Migration Strategy

When you need to migrate from Nuxt → [Next.js/SvelteKit/etc]:

**Option 1: Keep packages, replace frontend**
```bash
rm -rf apps/web
# Set up new frontend framework
# Point to apps/server API via HTTP
```

**Option 2: Extract API to microservice**
```bash
# Keep packages/ and apps/server
# Deploy apps/server as separate service
# New frontend calls it via REST/GraphQL
```

The packages remain unchanged in both scenarios!
