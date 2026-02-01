<template>
  <div style="padding: 2rem; font-family: sans-serif">
    <h1>Feature Flag Manager</h1>
    <p>Functional monolith with Nuxt 4 frontend</p>

    <div style="margin: 2rem 0; padding: 1rem; background: #f5f5f5; border-radius: 4px">
      <h2>Create Feature Flag</h2>
      <form @submit.prevent="createFlag">
        <div style="margin-bottom: 1rem">
          <label>
            Key (kebab-case):
            <input v-model="form.key" type="text" placeholder="dark-mode" required style="display: block; margin-top: 0.5rem; padding: 0.5rem; width: 100%">
          </label>
        </div>

        <div style="margin-bottom: 1rem">
          <label>
            Description:
            <input v-model="form.description" type="text" placeholder="Enable dark mode theme" required style="display: block; margin-top: 0.5rem; padding: 0.5rem; width: 100%">
          </label>
        </div>

        <div style="margin-bottom: 1rem">
          <label>
            <input v-model="form.defaultValue" type="checkbox">
            Default Value
          </label>
        </div>

        <button type="submit" style="padding: 0.5rem 1rem; background: #0070f3; color: white; border: none; border-radius: 4px; cursor: pointer">
          Create Flag
        </button>
      </form>
    </div>

    <div v-if="result" style="padding: 1rem; background: #e7f7e7; border-radius: 4px; margin-top: 1rem">
      <h3>Success!</h3>
      <pre>{{ JSON.stringify(result, null, 2) }}</pre>
    </div>

    <div v-if="error" style="padding: 1rem; background: #ffe7e7; border-radius: 4px; margin-top: 1rem">
      <h3>Error</h3>
      <p>{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CreateFlagInput } from '@domain/schema/FeatureFlag'

// HTTP response type (matches server serialization)
type FeatureFlagResponse = {
  key: string
  defaultValue: boolean
  description: string
  createdAt: string // ISO string from server
}

const form = ref<CreateFlagInput>({
  key: '',
  description: '',
  defaultValue: false,
})

const result = ref<FeatureFlagResponse | null>(null)
const error = ref('')

const createFlag = async () => {
  try {
    error.value = ''
    result.value = null

    // Call the Nuxt server API route
    // This runs domain logic server-side with full type safety!
    const data = await $fetch('/api/flags', {
      method: 'POST',
      body: form.value,
    })

    result.value = data
    form.value = { key: '', description: '', defaultValue: false }
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Unknown error'
  }
}
</script>
