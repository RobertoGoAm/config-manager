<template>
  <div>
    <h1>Config Manager</h1>
    <p>Nuxt frontend with direct access to domain packages</p>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
// Example: importing domain types directly in the frontend!
import type { Rule } from '@domain/schema/Rule'

// TypeScript knows about domain types - full type safety!
const exampleRule: Rule = {
  op: 'EQ',
  field: 'user.role',
  value: 'admin'
}

console.log('Example rule:', exampleRule)
</script>
