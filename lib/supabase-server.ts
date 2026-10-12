import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Client pour les pages serveur : il lit la session dans les cookies de la requête,
// donc il agit au nom de la personne connectée. À créer à chaque requête.
// Lire les cookies rend la page dynamique : elle est recalculée à chaque visite.
export async function createSupabaseServer() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Une page serveur ne peut pas écrire de cookies : c'est proxy.ts
          // qui rafraîchit la session avant chaque page.
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}

// La personne connectée et son profil, ou null si personne n'est connecté.
export async function getCurrentProfile() {
  const supabase = await createSupabaseServer()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name, grossiste_id')
    .eq('id', data.user.id)
    .single()
  return profile
}
