import { supabase } from '@/lib/supabase'
import OrderQueue from '@/components/OrderQueue'

export default async function GrossistePage() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      created_at,
      order_lines (
        id,
        quantity,
        status,
        substitution_mode,
        substituted_name,
        products ( name )
      )
    `)
    .order('created_at', { ascending: false })

  const { data: products } = await supabase.from('products').select('id, name')

  if (error) return <p className="p-8 text-red-500">Erreur : {error.message}</p>

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">File d'attente</h1>
      <OrderQueue orders={(orders ?? []) as any} products={products ?? []} />
    </main>
  )
}