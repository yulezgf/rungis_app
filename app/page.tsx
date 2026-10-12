import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireProfile, teamHome } from '@/lib/supabase-server'

export default async function Home() {
  const { supabase, profile } = await requireProfile()
  // L'accueil est l'espace des clients : l'équipe d'un grossiste va directement à sa file
  if (profile.role === 'grossiste') redirect(teamHome(profile))

  const { data: grossistes, error } = await supabase
    .from('grossistes')
    .select('id, name, specialites')
    .order('name')

  if (error) return <p className="p-8 text-red-500">Erreur : {error.message}</p>

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Commander chez...</h1>
      <div className="space-y-2">
        {grossistes?.map(g => (
          <Link key={g.id} href={`/commande/${g.id}`} className="block border rounded p-4">
            <span className="font-medium">{g.name}</span>
            {g.specialites && (
              <span className="block text-sm text-gray-500">{g.specialites}</span>
            )}
          </Link>
        ))}
      </div>
      <Link href="/connexion" className="block mt-6 text-sm underline text-gray-500">
        Mon compte ({profile.display_name})
      </Link>
    </main>
  )
}
