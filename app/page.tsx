import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireProfile, teamHome } from '@/lib/supabase-server'

export default async function Home() {
  const { supabase, profile } = await requireProfile()
  // L'accueil est l'espace des clients : l'équipe d'un grossiste va directement à sa file
  if (profile.role === 'grossiste') redirect(teamHome(profile))

  const [{ data: grossistes, error }, { data: accounts }] = await Promise.all([
    supabase.from('grossistes').select('id, name, specialites').order('name'),
    // Les comptes de ce client chez les grossistes (la RLS ne renvoie que les siens)
    supabase.from('customer_accounts').select('grossiste_id, status'),
  ])

  if (error) return <p className="p-8 text-red-500">Erreur : {error.message}</p>

  const statusOf = new Map((accounts ?? []).map(a => [a.grossiste_id, a.status as string]))

  return (
    <main className="p-8 max-w-md mx-auto">
      <Link href="/commandes" className="block border rounded p-3 mb-6 text-center font-medium">
        Mes commandes →
      </Link>
      <h1 className="text-2xl font-bold mb-4">Commander chez...</h1>
      <div className="space-y-2">
        {grossistes?.map(g => {
          const status = statusOf.get(g.id)
          const title = (
            <>
              <span className="font-medium">{g.name}</span>
              {g.specialites && <span className="block text-sm text-gray-500">{g.specialites}</span>}
            </>
          )

          // Compte accepté : on peut commander
          if (status === 'accepté')
            return (
              <Link key={g.id} href={`/commande/${g.id}`} className="block border rounded p-4">
                {title}
              </Link>
            )

          // Pas encore de compte accepté : on montre où en est la demande
          return (
            <div key={g.id} className="border rounded p-4 bg-gray-50">
              {title}
              {status === 'en attente' && (
                <p className="text-sm text-amber-700 mt-2">⏳ Demande de compte envoyée, en attente de réponse</p>
              )}
              {status === 'refusé' && (
                <p className="text-sm text-red-600 mt-2">Demande de compte refusée : contactez le grossiste</p>
              )}
              {!status && (
                <Link href={`/compte/${g.id}`} className="inline-block text-sm underline mt-2">
                  Demander l&apos;ouverture d&apos;un compte
                </Link>
              )}
            </div>
          )
        })}
      </div>
      <Link href="/connexion" className="block mt-6 text-sm underline text-gray-500">
        Mon compte ({profile.display_name})
      </Link>
    </main>
  )
}
