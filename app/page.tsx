import { supabase } from '@/lib/supabase'
import OrderForm from '@/components/OrderForm'

export default async function Home() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, unit, grossiste_id')

  if (error) return <p className="p-8 text-red-500">Erreur : {error.message}</p>

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Bon de commande</h1>
      <OrderForm products={products ?? []} />
    </main>
  )
}