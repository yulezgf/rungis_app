import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: products, error } = await supabase
    .from('products')
    .select('name, category, unit, grossistes(name)')

  if (error) {
    return <p className="p-8 text-red-500">Erreur : {error.message}</p>
  }

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Catalogue produits</h1>
      <ul className="space-y-2">
        {products?.map((p, i) => (
          <li key={i} className="flex justify-between border-b pb-2">
            <span>{p.name}</span>
            <span className="text-gray-500 text-sm">{p.unit}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}