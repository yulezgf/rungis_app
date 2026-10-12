import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
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

export type Profile = {
  role: 'client' | 'grossiste'
  display_name: string
  grossiste_id: string | null
}

// À appeler en haut de chaque page protégée.
// Renvoie le client Supabase et le profil complet de la personne connectée ;
// sinon redirige vers /connexion (pas connecté, ou nom pas encore renseigné).
export async function requireProfile() {
  const supabase = await createSupabaseServer()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/connexion')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name, grossiste_id')
    .eq('id', data.user.id)
    .single()
  if (!profile?.display_name) redirect('/connexion')

  return { supabase, profile: profile as Profile }
}

// L'espace d'un membre d'équipe : la file de son grossiste
export function teamHome(profile: Profile) {
  return `/grossiste/${profile.grossiste_id}`
}
