// Supabase browser client (singleton).
// Reads VITE_SUPABASE_* (see .env.example). When either var is missing,
// `hasSupabase` is false and the app falls back to mock data — this keeps the
// standalone file:// demo working with no backend.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabase = Boolean(url && anonKey)

export const supabase = hasSupabase ? createClient(url, anonKey) : null
