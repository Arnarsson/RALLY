import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Two build targets, one config:
//
//  • WEB (default, `npm run build`) — a NORMAL chunked Vite build with code
//    splitting. The Vercel deploy serves this: a small initial chunk (splash +
//    Tonight) and lazy chunks for the rest, so the critical mobile download is
//    tiny and LCP lands fast.
//
//  • STANDALONE (`STANDALONE=1`, `npm run build:standalone`) — viteSingleFile
//    inlines JS + CSS + assets into one portable index.html — that's the
//    "RALLY — open me.html" you can double-click with no server. Code splitting
//    is disabled so everything ends up in the single inlined file.
//
// `npm run dev` is unaffected (plugins only matter on build).
const STANDALONE = process.env.STANDALONE === '1'

export default defineConfig({
  plugins: [react(), ...(STANDALONE ? [viteSingleFile()] : [])],
})
