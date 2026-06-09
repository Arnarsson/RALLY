// Vercel Edge Middleware — per-plan share unfurls.
//
// A shared link is /p/<planId>, which vercel.json rewrites to the static SPA
// (index.html). That means link-unfurl crawlers only ever see the site-wide
// brand OG tags — they can't name the actual match. This middleware fixes that
// WITHOUT touching the human experience:
//
//   • A real person opening /p/<id>  → next() → the SPA boots as before.
//   • A crawler (facebookexternalhit, Twitterbot, Slackbot, iMessage/Applebot,
//     WhatsApp, Discord, Telegram, LinkedIn, …) → rewritten to /api/p-og, a tiny
//     serverless function that emits per-plan OG/Twitter tags (match, venue,
//     "N going") with the match-specific landscape poster as the image.
//
// Crawlers don't run JS, so a meta-only document is all they need; humans never
// hit this path because they follow the original /p/<id> URL, not /api/p-og.

import { next, rewrite } from '@vercel/edge'

export const config = { matcher: '/p/:planId*' }

// Link-preview / social crawlers worth rendering rich cards for.
const BOT = /facebookexternalhit|facebot|twitterbot|slackbot|slack-imgproxy|discordbot|telegrambot|whatsapp|linkedinbot|pinterest|redditbot|embedly|iframely|quora link preview|outbrain|vkshare|w3c_validator|applebot|googlebot|bingbot|google-inspectiontool|developers\.google\.com|skypeuripreview|nuzzel|bitlybot|flipboard|tumblr|mastodon|bluesky|opengraph|metainspector|snapchat|googleweblight|yandex|baiduspider|petalbot/i

export default function middleware(req) {
  const ua = req.headers.get('user-agent') || ''
  const url = new URL(req.url)
  const m = url.pathname.match(/^\/p\/([^/?#]+)/)

  if (m && BOT.test(ua)) {
    const dest = new URL('/api/p-og', url.origin)
    dest.searchParams.set('planId', decodeURIComponent(m[1]))
    const ref = url.searchParams.get('ref')
    if (ref) dest.searchParams.set('ref', ref)
    return rewrite(dest)
  }

  return next()
}
