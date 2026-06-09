import { defineConfig } from 'vitest/config'

// Hermetic tests: blank the Supabase env so `hasSupabase` is false and the
// loaders exercise the mock-fallback path. Without this, vitest auto-loads
// source/.env and the loader tests would hit the live backend.
export default defineConfig({
  test: {
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
