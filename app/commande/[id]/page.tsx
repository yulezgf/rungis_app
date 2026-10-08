import { supabase } from '@/lib/supabase'
import OrderForm from '@/components/OrderForm'

export default async function CommandePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: grossiste } = await supabase
    .from('grossistes')
    .select('name')
    .eq('id', id)
    .single()

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, unit, grossiste_id')
    .eq('grossiste_id', id)
    .order('name')

  if (error) return <p className="p-8 text-red-500">Erreur : {error.message}</p>

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Bon de commande — {grossiste?.name}</h1>
      <OrderForm products={products ?? []} grossisteId={id} />
    </main>
  )
}