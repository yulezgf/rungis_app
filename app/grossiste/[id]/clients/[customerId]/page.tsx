import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireProfile, teamHome } from '@/lib/supabase-server'
import TeamHeader from '@/components/TeamHeader'
import { customerName, lineName, lineUnit, formatQty } from '@/lib/productName'
import { orderStatus, linePreparers, FINISHED } from '@/lib/orderStatus'
import { fulfillmentOf } from '@/lib/fulfillment'

const dateFr = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

// Fiche client côté grossiste : le compte, puis toutes ses commandes chez CE grossiste
// (celles en cours d'abord). La RLS ne renvoie que les commandes de ce grossiste.
export default async function FicheClientPage({ params }: { params: Promise<{ id: string; customerId: string }> }) {
  const { supabase, profile } = await requireProfile()
  const { id, customerId } = await params
  if (profile.role !== 'grossiste') redirect('/')
  if (profile.grossiste_id !== id) redirect(teamHome(profile))

  const [{ data: grossiste }, { data: account }, { data: orders, error }, { count: pendingCount }] = await Promise.all([
    supabase.from('grossistes').select('name').eq('id', id).single(),
    supabase
      .from('customer_accounts')
      .select('status, account_number, existing_number, requested_at, profiles ( display_name )')
      .eq('grossiste_id', id)
      .eq('customer_id', customerId)
      .maybeSingle(),
    supabase
      .from('orders')
      .select(
        'id, order_number, created_at, assigned_to, fulfillment, comment, order_lines ( quantity, status, assigned_to, custom_name, custom_unit, products ( name, unit ) )'
      )
      .eq('grossiste_id', id)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('customer_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('grossiste_id', id)
      .eq('status', 'en attente'),
  ])
  if (!grossiste) notFound()
  // Pas de compte chez ce grossiste : ce n'est pas un de ses clients
  if (!account) notFound()

  const name = customerName(account.profiles) ?? 'Client'
  const withStatus = (orders ?? []).map(o => ({
    ...o,
    status: orderStatus(o.order_lines, linePreparers(o.order_lines) ?? o.assigned_to),
  }))
  const current = withStatus.filter(o => o.order_lines.length === 0 || !FINISHED.includes(o.status.label))
  const past = withStatus.filter(o => o.order_lines.length > 0 && FINISHED.includes(o.status.label))

  const orderCard = (o: (typeof withStatus)[number]) => (
    <article key={o.id} className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="font-semibold text-stone-900">Bon n° {o.order_number}</p>
          <p className="text-xs text-stone-500">
            {dateFr(o.created_at)} · {fulfillmentOf(o.fulfillment).icon} {fulfillmentOf(o.fulfillment).label}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${o.status.color}`}>
          {o.status.label}
        </span>
      </div>
      {o.comment && <p className="mt-2 text-sm text-stone-700 whitespace-pre-line">💬 {o.comment}</p>}
      <ul className="mt-2 text-sm text-stone-700 divide-y divide-stone-100">
        {o.order_lines.map((l, i) => (
          <li key={i} className="py-1 flex justify-between gap-2">
            <span>{lineName(l)}</span>
            <span className="text-stone-500 whitespace-nowrap">
              {formatQty(l.quantity, lineUnit(l))} · {l.status}
            </span>
          </li>
        ))}
      </ul>
    </article>
  )

  return (
    <div className="min-h-screen bg-stone-100">
      <TeamHeader
        grossisteId={id}
        grossisteName={grossiste.name}
        preparateur={profile.display_name}
        pendingCount={pendingCount ?? 0}
        active="clients"
      />
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-6">
        <div>
          <Link href={`/grossiste/${id}/clients`} className="text-sm text-stone-500 underline">
            ← Tous les clients
          </Link>
          <h1 className="text-2xl font-bold text-stone-900 mt-2">{name}</h1>
          <p className="text-sm text-stone-600">
            Compte {account.status}
            {account.account_number ? ` · n° ${account.account_number}` : ''}
            {' · '}
            {withStatus.length} commande{withStatus.length > 1 ? 's' : ''}
          </p>
        </div>

        {error && <p className="text-red-600">Erreur : {error.message}</p>}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">En cours ({current.length})</h2>
          {current.length === 0 && <p className="text-sm text-stone-500">Aucune commande en cours.</p>}
          {current.map(orderCard)}
        </section>

        {past.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Historique ({past.length})</h2>
            {past.map(orderCard)}
          </section>
        )}
      </main>
    </div>
  )
}
