import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireProfile, teamHome } from '@/lib/supabase-server'
import OrderQueue from '@/components/OrderQueue'

export default async function GrossisteQueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profile } = await requireProfile()
  const { id } = await params
  // Réservé à l'équipe de CE grossiste : un client retourne à l'accueil,
  // un membre d'une autre équipe retourne à sa propre file
  if (profile.role !== 'grossiste') redirect('/')
  if (profile.grossiste_id !== id) redirect(teamHome(profile))

  const { data: grossiste } = await supabase
    .from('grossistes')
    .select('name')
    .eq('id', id)
    .single()
  if (!grossiste) notFound()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      created_at,
      assigned_to,
      assigned_at,
      profiles ( display_name ),
      order_lines (
        id,
        quantity,
        status,
        substitution_mode,
        substitution_list,
        substituted_name,
        products ( name, unit )
      )
    `)
    .eq('grossiste_id', id)
    .order('created_at', { ascending: false })

  const { data: products } = await supabase
    .from('products')
    .select('id, name, unit')
    .eq('grossiste_id', id)

  if (error) return <p className="p-8 text-red-500">Erreur : {error.message}</p>

  return (
    <main className="p-8 max-w-md mx-auto">
      <div className="flex justify-between items-baseline mb-4">
        <h1 className="text-2xl font-bold">File d&apos;attente — {grossiste.name}</h1>
        <Link href="/connexion" className="text-sm underline text-gray-500">
          Mon compte
        </Link>
      </div>
      <OrderQueue orders={orders ?? []} products={products ?? []} grossisteId={id} />
    </main>
  )
}