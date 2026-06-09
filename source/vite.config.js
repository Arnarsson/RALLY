import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// viteSingleFile inlines JS + CSS into one portable index.html — that's the
// "RALLY — open me.html" you can double-click with no server. `npm run dev`
// is unaffected (the plugin only runs on build).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
})
