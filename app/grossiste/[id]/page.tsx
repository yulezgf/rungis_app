import { notFound, redirect } from 'next/navigation'
import { requireProfile, teamHome } from '@/lib/supabase-server'
import OrderQueue from '@/components/OrderQueue'
import TeamHeader from '@/components/TeamHeader'

export default async function GrossisteQueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profile } = await requireProfile()
  const { id } = await params
  // Réservé à l'équipe de CE grossiste : un client retourne à l'accueil,
  // un membre d'une autre équipe retourne à sa propre file
  if (profile.role !== 'grossiste') redirect('/')
  if (profile.grossiste_id !== id) redirect(teamHome(profile))

  const { data: grossiste } = await supabase.from('grossistes').select('name').eq('id', id).single()
  if (!grossiste) notFound()

  const [{ data: orders, error }, { data: products }, { data: assortment }, { data: rayons }, { count: pendingCount }] =
    await Promise.all([
      supabase
        .from('orders')
        .select(`
          id,
          order_number,
          created_at,
          assigned_to,
          assigned_at,
          comment,
          profiles ( display_name ),
          order_lines (
            id,
            quantity,
            status,
            substitution_mode,
            substitution_list,
            substituted_name,
            custom_name,
            custom_unit,
            rayon_id,
            assigned_to,
            assigned_at,
            products ( name, unit )
          )
        `)
        .eq('grossiste_id', id)
        .order('created_at', { ascending: false }),
      // Tout le référentiel (nom des produits qui arrivent en direct)
      supabase.from('products').select('id, name, unit').order('name'),
      // L'assortiment de ce grossiste (remplaçants proposés en « Substitut libre »)
      supabase.from('assortiments').select('product_id').eq('grossiste_id', id),
      // Les rayons de ce grossiste (aucun = pas de découpage, comme avant)
      supabase.from('rayons').select('id, name, position').eq('grossiste_id', id).order('position'),
      // Nombre de demandes d'ouverture de compte en attente (sans charger les lignes)
      supabase
        .from('customer_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('grossiste_id', id)
        .eq('status', 'en attente'),
    ])

  return (
    <div className="min-h-screen bg-stone-100">
      <TeamHeader
        grossisteId={id}
        grossisteName={grossiste.name}
        preparateur={profile.display_name}
        pendingCount={pendingCount ?? 0}
        active="file"
      />
      <main className="max-w-3xl mx-auto px-4 py-4">
        {error ? (
          <p className="text-red-600">Erreur : {error.message}</p>
        ) : (
          <OrderQueue
            orders={orders ?? []}
            products={products ?? []}
            assortmentIds={(assortment ?? []).map(a => a.product_id)}
            rayons={rayons ?? []}
            grossisteId={id}
            preparateur={profile.display_name}
          />
        )}
      </main>
    </div>
  )
}
