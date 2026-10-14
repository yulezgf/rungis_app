import { notFound, redirect } from 'next/navigation'
import { requireProfile, teamHome } from '@/lib/supabase-server'
import OrderForm from '@/components/OrderForm'

export default async function CommandePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profile } = await requireProfile()
  // Commander est réservé aux clients
  if (profile.role === 'grossiste') redirect(teamHome(profile))
  const { id } = await params

  const { data: grossiste } = await supabase
    .from('grossistes')
    .select('name')
    .eq('id', id)
    .single()
  if (!grossiste) notFound()

  // Pas de compte accepté chez ce grossiste : retour à l'accueil, qui affiche où en est la demande.
  // (La vraie protection est en base : la RLS refuse la commande, sql/12.)
  const { data: account } = await supabase
    .from('customer_accounts')
    .select('status')
    .eq('grossiste_id', id)
    .maybeSingle()
  if (account?.status !== 'accepté') redirect('/')

  // Les trois requêtes partent en même temps
  const [catalogRes, assortmentRes, topRes] = await Promise.all([
    // Tout le référentiel, pour la recherche (limite Supabase par défaut : 1000 produits)
    supabase.from('products').select('id, name, unit, category').order('name'),
    // Ce que ce grossiste vend
    supabase.from('assortiments').select('product_id').eq('grossiste_id', id),
    // Top 10 : habitudes de ce client chez ce grossiste, puis meilleures ventes (sql/10)
    supabase.rpc('top_products', { p_grossiste_id: id }),
  ])

  const error = catalogRes.error ?? assortmentRes.error ?? topRes.error
  if (error) return <p className="p-8 text-red-500">Erreur : {error.message}</p>

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Bon de commande — {grossiste.name}</h1>
      <OrderForm
        catalog={catalogRes.data ?? []}
        assortmentIds={(assortmentRes.data ?? []).map(a => a.product_id)}
        top={topRes.data ?? []}
        grossisteId={id}
        grossisteName={grossiste.name}
      />
    </main>
  )
}