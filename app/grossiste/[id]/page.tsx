import { supabase } from '@/lib/supabase'
import OrderQueue from '@/components/OrderQueue'

export default async function GrossisteQueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: grossiste } = await supabase
    .from('grossistes')
    .select('name')
    .eq('id', id)
    .single()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      created_at,
      assigned_to,
      assigned_at,
      order_lines (
        id,
        quantity,
        status,
        substitution_mode,
        substitution_list,
        substituted_name,
        products ( name )
      )
    `)
    .eq('grossiste_id', id)
    .order('created_at', { ascending: false })

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('grossiste_id', id)

  if (error) return <p className="p-8 text-red-500">Erreur : {error.message}</p>

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">File d'attente — {grossiste?.name}</h1>
      <OrderQueue orders={(orders ?? []) as any} products={products ?? []} grossisteId={id} />
    </main>
  )
}