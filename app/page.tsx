import Link from 'next/link'
import { createSupabaseServer, getCurrentProfile } from '@/lib/supabase-server'

export default async function Home() {
  const supabase = await createSupabaseServer()
  const profile = await getCurrentProfile()
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
      <div className="mt-6 text-sm text-gray-500 space-y-1">
        {profile?.role === 'grossiste' && profile.grossiste_id && (
          <Link href={`/grossiste/${profile.grossiste_id}`} className="block underline">
            Ma file d&apos;attente
          </Link>
        )}
        <Link href="/connexion" className="block underline">
          {profile ? `Connecté : ${profile.display_name ?? 'mon compte'}` : 'Se connecter'}
        </Link>
      </div>
    </main>
  )
}