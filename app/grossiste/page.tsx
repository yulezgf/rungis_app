import { redirect } from 'next/navigation'
import { requireProfile, teamHome } from '@/lib/supabase-server'

// Plus de liste de grossistes ici : chaque membre d'équipe ne voit que la file
// de son grossiste. Cette adresse redirige donc chacun vers le bon endroit.
export default async function GrossisteIndex() {
  const { profile } = await requireProfile()
  redirect(profile.role === 'grossiste' ? teamHome(profile) : '/')
}
