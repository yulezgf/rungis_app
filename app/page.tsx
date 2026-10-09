import Link from 'next/link'
import { connection } from 'next/server'
import { supabase } from '@/lib/supabase'

export default async function Home() {
  // Lecture à chaque visite : sinon la liste est figée au moment du build
  await connection()

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
    </main>
  )
}