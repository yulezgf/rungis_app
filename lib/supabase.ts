import { createBrowserClient } from '@supabase/ssr'

// Client pour les composants 'use client'.
// La session est gardée dans un cookie : le serveur peut donc la lire aussi
// (voir lib/supabase-server.ts pour les pages serveur).
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
