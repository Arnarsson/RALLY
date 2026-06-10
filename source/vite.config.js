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

// The web build self-hosts fonts (inline @font-face pointing at /fonts/*.woff2,
// between the fonts:self-hosted marker comments in index.html). That breaks over
// file:// — absolute /fonts/ URLs don't resolve and public/ isn't inlined — so
// for STANDALONE we swap the whole block back to the Google Fonts CDN, exactly
// what the page used before self-hosting.
const standaloneGoogleFonts = () => ({
  name: 'standalone-google-fonts',
  transformIndexHtml(html) {
    return html.replace(
      /<!-- fonts:self-hosted:start -->[\s\S]*?<!-- fonts:self-hosted:end -->/,
      `<link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@500;600;700;800;900&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />`
    )
  },
})

export default defineConfig({
  plugins: [react(), ...(STANDALONE ? [viteSingleFile(), standaloneGoogleFonts()] : [])],
})
