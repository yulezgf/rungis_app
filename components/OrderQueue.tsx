'use client'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { lineName, lineUnit, formatQty, customerName } from '@/lib/productName'
import { orderStatus, linePreparers, FINISHED } from '@/lib/orderStatus'
import { groupByRayon, type Rayon, type RayonGroup } from '@/lib/rayons'

type Line = {
  id: string
  quantity: number
  status: string
  substitution_mode: string
  substitution_list: string[] | null
  substituted_name: string | null
  products: unknown // produit de la liste de référence…
  custom_name: string | null // … ou produit saisi librement par le client
  custom_unit: string | null
  rayon_id: string | null // rayon qui prépare cette ligne (null = « À répartir »)
  assigned_to: string | null // vendeur qui a pris le rayon de cette ligne
  assigned_at: string | null
}
type Order = {
  id: string
  order_number: number
  created_at: string
  assigned_to: string | null // prise en charge de toute la commande (grossiste sans rayon)
  assigned_at: string | null
  profiles: unknown // { display_name } : le client qui a passé la commande
  comment: string | null // « Un mot pour le préparateur »
  order_lines: Line[]
}
type Product = { id: string; name: string; unit: string }

// Boutons de statut d'une ligne (valeur en base → libellé court)
const STATUS_BUTTONS: { value: string; label: string; active: string }[] = [
  { value: 'à préparer', label: 'À faire', active: 'bg-stone-700 text-white' },
  { value: 'en cours', label: 'En cours', active: 'bg-blue-600 text-white' },
  { value: 'prêt', label: 'Prêt', active: 'bg-green-600 text-white' },
  { value: 'rupture', label: 'Rupture', active: 'bg-red-600 text-white' },
  { value: 'substitué', label: 'Substitué', active: 'bg-amber-500 text-white' },
]
const ALERT_AFTER_MINUTES = 30

// Filtre « Mon rayon », mémorisé sur cet appareil (localStorage)
const subscribeStorage = (callback: () => void) => {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

const timeFr = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })

export default function OrderQueue({
  orders,
  products,
  assortmentIds,
  rayons,
  grossisteId,
  preparateur,
}: {
  orders: Order[]
  products: Product[] // tout le référentiel
  assortmentIds: string[] // les produits que ce grossiste vend
  rayons: Rayon[] // vide si le grossiste ne travaille pas par rayon
  grossisteId: string
  preparateur: string // prénom du compte connecté (profiles.display_name)
}) {
  const [localOrders, setLocalOrders] = useState(orders)
  const [picking, setPicking] = useState<string | null>(null) // ligne dont on choisit le remplaçant
  const [view, setView] = useState<'todo' | 'done'>('todo')
  const [now, setNow] = useState(() => Date.now())
  const byRayon = rayons.length > 0

  const filterKey = `rayon-${grossisteId}`
  const rayonFilter = useSyncExternalStore(
    subscribeStorage,
    () => localStorage.getItem(filterKey) ?? '',
    () => ''
  )
  const setRayonFilter = (value: string) => {
    localStorage.setItem(filterKey, value)
    window.dispatchEvent(new StorageEvent('storage', { key: filterKey }))
  }

  // Remplaçants proposés en « Substitut libre » : l'assortiment du grossiste
  // (tout le référentiel si l'assortiment est encore vide)
  const substitutes = useMemo(
    () => (assortmentIds.length > 0 ? products.filter(p => assortmentIds.includes(p.id)) : products),
    [products, assortmentIds]
  )

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  // File partagée en direct : nouvelles commandes, prises en charge et statuts
  // faits par les collègues apparaissent sans recharger la page.
  useEffect(() => {
    const channel = supabase
      .channel('file_' + grossisteId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `grossiste_id=eq.${grossisteId}` },
        ({ new: o }) => {
          setLocalOrders(prev =>
            prev.some(x => x.id === o.id)
              ? prev
              : [
                  {
                    id: o.id,
                    order_number: o.order_number,
                    created_at: o.created_at,
                    assigned_to: o.assigned_to,
                    assigned_at: o.assigned_at,
                    comment: o.comment,
                    profiles: null,
                    order_lines: [],
                  },
                  ...prev,
                ]
          )
          // L'événement ne contient que l'id du client : on va chercher son nom
          if (o.customer_id) {
            supabase
              .from('profiles')
              .select('display_name')
              .eq('id', o.customer_id)
              .single()
              .then(({ data }) => setLocalOrders(prev => prev.map(x => (x.id === o.id ? { ...x, profiles: data } : x))))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `grossiste_id=eq.${grossisteId}` },
        ({ new: o }) => {
          setLocalOrders(prev =>
            prev.map(x => (x.id === o.id ? { ...x, assigned_to: o.assigned_to, assigned_at: o.assigned_at } : x))
          )
        }
      )
      // order_lines n'a pas de grossiste_id : on ignore les lignes des commandes qui ne sont pas dans la file
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_lines' }, ({ new: l }) => {
        const line: Line = {
          id: l.id,
          quantity: l.quantity,
          status: l.status,
          substitution_mode: l.substitution_mode,
          substitution_list: l.substitution_list,
          substituted_name: l.substituted_name,
          products: products.find(p => p.id === l.product_id) ?? null,
          custom_name: l.custom_name,
          custom_unit: l.custom_unit,
          rayon_id: l.rayon_id, // rempli par la base à la création (sql/13)
          assigned_to: l.assigned_to,
          assigned_at: l.assigned_at,
        }
        setLocalOrders(prev =>
          prev.map(o =>
            o.id === l.order_id && !o.order_lines.some(x => x.id === l.id)
              ? { ...o, order_lines: [...o.order_lines, line] }
              : o
          )
        )
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_lines' }, ({ new: l }) => {
        setLocalOrders(prev =>
          prev.map(o =>
            o.id !== l.order_id
              ? o
              : {
                  ...o,
                  order_lines: o.order_lines.map(x =>
                    x.id === l.id
                      ? {
                          ...x,
                          status: l.status,
                          substituted_name: l.substituted_name,
                          rayon_id: l.rayon_id,
                          assigned_to: l.assigned_to,
                          assigned_at: l.assigned_at,
                        }
                      : x
                  ),
                }
          )
        )
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [grossisteId, products])

  const patchLines = (ids: string[], patch: Partial<Line>) =>
    setLocalOrders(prev =>
      prev.map(o => ({ ...o, order_lines: o.order_lines.map(l => (ids.includes(l.id) ? { ...l, ...patch } : l)) }))
    )

  const recordHistory = async (orderId: string, rayonId: string | null) => {
    const { error } = await supabase
      .from('assignment_history')
      .insert({ order_id: orderId, assigned_to: preparateur, rayon_id: rayonId })
    if (error) alert("Prise en charge faite, mais l'historique n'a pas été enregistré : " + error.message)
  }

  // Grossiste sans rayon : « Je prends » prend toute la commande
  const claimOrder = async (orderId: string) => {
    const assignedAt = new Date().toISOString()
    const { error } = await supabase
      .from('orders')
      .update({ assigned_to: preparateur, assigned_at: assignedAt })
      .eq('id', orderId)
    if (error) return alert('Erreur : ' + error.message)
    setLocalOrders(prev => prev.map(o => (o.id === orderId ? { ...o, assigned_to: preparateur, assigned_at: assignedAt } : o)))
    await recordHistory(orderId, null)
  }

  // Grossiste par rayon : « Je prends » prend les lignes de CE rayon dans la commande
  const claimGroup = async (orderId: string, group: RayonGroup<Line>) => {
    const ids = group.lines.map(l => l.id)
    const assignedAt = new Date().toISOString()
    const { error } = await supabase
      .from('order_lines')
      .update({ assigned_to: preparateur, assigned_at: assignedAt })
      .in('id', ids)
    if (error) return alert('Erreur : ' + error.message)
    patchLines(ids, { assigned_to: preparateur, assigned_at: assignedAt })
    await recordHistory(orderId, group.rayon?.id ?? null)
  }

  const updateLine = async (lineId: string, patch: Partial<Pick<Line, 'status' | 'substituted_name' | 'rayon_id'>>) => {
    const { error } = await supabase.from('order_lines').update(patch).eq('id', lineId)
    if (error) return alert('Erreur : ' + error.message)
    patchLines([lineId], patch)
  }

  const handleStatusChange = async (line: Line, newStatus: string) => {
    if (newStatus === line.status && newStatus !== 'substitué') return
    if (newStatus === 'substitué') {
      if (line.substitution_mode === 'none')
        return alert("Le client n'accepte aucune substitution pour ce produit : mettre en rupture.")
      if (line.substitution_mode === 'restricted' && !(line.substitution_list ?? []).length)
        return alert('Aucun substitut autorisé pour ce produit.')
      setPicking(picking === line.id ? null : line.id)
      return
    }
    setPicking(null)
    await updateLine(line.id, { status: newStatus, substituted_name: null })
  }

  const minutesSince = (iso: string) => Math.floor((now - new Date(iso).getTime()) / 60000)
  const ago = (iso: string) => {
    const m = minutesSince(iso)
    if (m < 1) return "à l'instant"
    if (m < 60) return `il y a ${m} min`
    return `à ${timeFr(iso)}`
  }

  // Statut global : pour un grossiste par rayon, « en préparation par Moussa, Devrick »
  const statusOf = (o: Order) => orderStatus(o.order_lines, byRayon ? linePreparers(o.order_lines) : o.assigned_to)

  const visible = localOrders.filter(o => {
    const finished = o.order_lines.length > 0 && FINISHED.includes(statusOf(o).label)
    if (view === 'todo' ? finished : !finished) return false
    // Filtre « Mon rayon » : les commandes qui ont au moins une ligne dans ce rayon (ou à répartir)
    if (byRayon && rayonFilter) return o.order_lines.some(l => l.rayon_id === rayonFilter || !l.rayon_id)
    return true
  })

  const counts = localOrders.reduce(
    (acc, o) => {
      const label = statusOf(o).label
      if (FINISHED.includes(label)) acc.done++
      else if (label === 'à préparer') acc.todo++
      else acc.doing++
      return acc
    },
    { todo: 0, doing: 0, done: 0 }
  )

  const renderLine = (line: Line) => (
    <div key={line.id} className="py-3 border-t first:border-t-0 border-stone-100">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="font-medium text-stone-900">{lineName(line)}</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Substitution{' '}
            {line.substitution_mode === 'none'
              ? 'refusée'
              : line.substitution_mode === 'restricted'
                ? `: ${(line.substitution_list ?? []).map((n, i) => `${i + 1}. ${n}`).join(' · ')}`
                : 'libre'}
          </p>
          {line.substituted_name && (
            <p className="text-xs text-amber-700 mt-0.5">→ remplacé par {line.substituted_name}</p>
          )}
        </div>
        <p className="text-lg font-bold text-stone-900 whitespace-nowrap">{formatQty(line.quantity, lineUnit(line))}</p>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {STATUS_BUTTONS.map(b => (
          <button
            key={b.value}
            type="button"
            onClick={() => handleStatusChange(line, b.value)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium border ${
              line.status === b.value ? `${b.active} border-transparent` : 'bg-white text-stone-600 border-stone-200'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {picking === line.id && (
        <select
          className="border border-stone-300 rounded-md px-2 py-2 text-sm mt-2 w-full"
          defaultValue=""
          onChange={e =>
            e.target.value &&
            updateLine(line.id, { status: 'substitué', substituted_name: e.target.value }).then(() => setPicking(null))
          }
        >
          <option value="">Choisir le remplaçant…</option>
          {(line.substitution_mode === 'restricted'
            ? (line.substitution_list ?? []).map((name, i) => ({ key: name, name, label: `${i + 1}. ${name}` }))
            : substitutes.filter(p => p.name !== lineName(line)).map(p => ({ key: p.id, name: p.name, label: p.name }))
          ).map(opt => (
            <option key={opt.key} value={opt.name}>{opt.label}</option>
          ))}
        </select>
      )}

      {/* Ligne pas encore rangée : un vendeur la range dans son rayon */}
      {byRayon && !line.rayon_id && (
        <select
          value=""
          onChange={e => e.target.value && updateLine(line.id, { rayon_id: e.target.value })}
          className="mt-2 border border-amber-300 bg-amber-50 text-amber-800 rounded-md px-2 py-1.5 text-xs"
        >
          <option value="">Ranger dans un rayon…</option>
          {rayons.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      )}
    </div>
  )

  // Barre de prise en charge (toute la commande, ou un rayon)
  const claimBar = (assignedTo: string | null, sinceIso: string, onClaim: () => void) => {
    const waiting = minutesSince(sinceIso)
    if (assignedTo)
      return (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-stone-600">
            👤 <span className="font-medium text-stone-900">{assignedTo}</span>
          </span>
          {assignedTo !== preparateur && (
            <button onClick={onClaim} className="text-stone-600 underline">
              Reprendre
            </button>
          )}
        </div>
      )
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span suppressHydrationWarning className={waiting >= ALERT_AFTER_MINUTES ? 'text-red-600 font-medium' : 'text-stone-500'}>
          {waiting >= ALERT_AFTER_MINUTES ? `⚠️ Non pris depuis ${waiting} min` : 'Personne dessus'}
        </span>
        <button onClick={onClaim} className="bg-red-800 hover:bg-red-900 text-white rounded-md px-3 py-1.5 font-medium">
          Je prends
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Compteurs en direct */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'À préparer', value: counts.todo, color: 'text-stone-900' },
          { label: 'En préparation', value: counts.doing, color: 'text-blue-700' },
          { label: 'Terminées', value: counts.done, color: 'text-green-700' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-stone-200 px-3 py-2">
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-stone-500">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Onglets et filtre « Mon rayon » */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex bg-stone-200 rounded-lg p-1">
          {(['todo', 'done'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${view === v ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}`}
            >
              {v === 'todo' ? `À traiter (${counts.todo + counts.doing})` : `Terminées (${counts.done})`}
            </button>
          ))}
        </div>
        {byRayon && (
          <select
            value={rayonFilter}
            onChange={e => setRayonFilter(e.target.value)}
            className="border border-stone-300 bg-white rounded-lg px-2 py-2 text-sm"
          >
            <option value="">Tous les rayons</option>
            {rayons.map(r => (
              <option key={r.id} value={r.id}>Mon rayon : {r.name}</option>
            ))}
          </select>
        )}
      </div>

      {visible.length === 0 && (
        <p className="text-center text-stone-500 py-10">
          {view === 'todo' ? 'Aucune commande à traiter pour le moment.' : 'Aucune commande terminée.'}
        </p>
      )}

      {visible.map(order => {
        const status = statusOf(order)
        const client = customerName(order.profiles)
        const groups = groupByRayon(order.order_lines, rayons).filter(
          g => !byRayon || !rayonFilter || !g.rayon || g.rayon.id === rayonFilter
        )
        return (
          <article key={order.id} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-stone-100">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-stone-500" suppressHydrationWarning>
                    Bon n° {order.order_number} · {ago(order.created_at)}
                  </p>
                  <p className="text-lg font-semibold text-stone-900 truncate">{client ?? 'Client'}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${status.color}`}>
                  {status.label}
                </span>
              </div>
              {status.note && <p className="text-xs text-red-600 mt-1">{status.note}</p>}
              {order.comment && (
                <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-stone-800 whitespace-pre-line">
                  💬 {order.comment}
                </p>
              )}
              {!byRayon && (
                <div className="mt-3">
                  {claimBar(order.assigned_to, order.created_at, () => claimOrder(order.id))}
                </div>
              )}
            </div>

            {groups.map(group => {
              const groupPreparer = linePreparers(group.lines)
              const groupStatus = orderStatus(group.lines, groupPreparer)
              return (
                <section key={group.rayon?.id ?? 'a-repartir'} className="px-4 py-3 border-b last:border-b-0 border-stone-100">
                  {byRayon && (
                    <div className="mb-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`font-semibold ${group.rayon ? 'text-stone-900' : 'text-amber-700'}`}>
                          {group.rayon ? group.rayon.name : 'À répartir'}
                        </h3>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${groupStatus.color}`}>{groupStatus.label}</span>
                      </div>
                      {group.rayon &&
                        claimBar(groupPreparer, order.created_at, () => claimGroup(order.id, group))}
                    </div>
                  )}
                  {group.lines.map(renderLine)}
                </section>
              )
            })}
          </article>
        )
      })}
    </div>
  )
}
