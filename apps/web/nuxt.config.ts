import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Nuxt 4 specific
  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: '2025-01-31',
  devtools: { enabled: true },

  // TypeScript configuration
  typescript: {
    typeCheck: true,
    strict: true,
  },

  // Alias configuration for workspace packages
  alias: {
    '@domain': resolve(rootDir, '../../packages/domain/src'),
    '@infrastructure': resolve(rootDir, '../../packages/infrastructure/src'),
    '@api': resolve(rootDir, '../../packages/api/src'),
  },

  // Vite configuration
  vite: {
    resolve: {
      alias: {
        '@domain': resolve(rootDir, '../../packages/domain/src'),
        '@infrastructure': resolve(rootDir, '../../packages/infrastructure/src'),
        '@api': resolve(rootDir, '../../packages/api/src'),
      },
    },
  },
})
