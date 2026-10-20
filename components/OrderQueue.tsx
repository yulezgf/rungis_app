'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { lineName, lineUnit, formatQty, customerName } from '@/lib/productName'
import { orderStatus } from '@/lib/orderStatus'
import { groupByRayon, type Rayon } from '@/lib/rayons'

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
}
type Order = {
  id: string
  order_number: number
  created_at: string
  assigned_to: string | null
  assigned_at: string | null
  profiles: unknown // { display_name } : le client qui a passé la commande
  comment: string | null // « Un mot pour le préparateur »
  order_lines: Line[]
}
type Product = { id: string; name: string; unit: string }

const STATUSES = ['à préparer', 'en cours', 'prêt', 'rupture', 'substitué']
const ALERT_AFTER_MINUTES = 30

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
  // Remplaçants proposés en « Substitut libre » : l'assortiment du grossiste
  // (tout le référentiel si l'assortiment est encore vide)
  const substitutes = assortmentIds.length > 0 ? products.filter(p => assortmentIds.includes(p.id)) : products
  const [picking, setPicking] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

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
              .then(({ data }) =>
                setLocalOrders(prev => prev.map(x => (x.id === o.id ? { ...x, profiles: data } : x)))
              )
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
                      ? { ...x, status: l.status, substituted_name: l.substituted_name, rayon_id: l.rayon_id }
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

  // « Je prends » / « Reprendre » : la commande est attribuée au compte connecté
  const claim = async (orderId: string) => {
    const assignedAt = new Date().toISOString()
    const { error } = await supabase
      .from('orders')
      .update({ assigned_to: preparateur, assigned_at: assignedAt })
      .eq('id', orderId)
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    const { error: historyError } = await supabase
      .from('assignment_history')
      .insert({ order_id: orderId, assigned_to: preparateur })
    if (historyError) alert("Commande prise, mais l'historique n'a pas été enregistré : " + historyError.message)
    setLocalOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, assigned_to: preparateur, assigned_at: assignedAt } : o))
    )
  }

  const updateLine = async (
    lineId: string,
    patch: Partial<Pick<Line, 'status' | 'substituted_name' | 'rayon_id'>>
  ) => {
    const { error } = await supabase.from('order_lines').update(patch).eq('id', lineId)
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setLocalOrders(prev =>
      prev.map(order => ({
        ...order,
        order_lines: order.order_lines.map(line =>
          line.id === lineId ? { ...line, ...patch } : line
        ),
      }))
    )
  }

  const handleStatusChange = async (line: Line, newStatus: string) => {
    if (newStatus === 'substitué') {
      if (line.substitution_mode === 'none') {
        alert("Le client n'accepte aucune substitution pour ce produit.")
        return
      }
      if (line.substitution_mode === 'restricted' && !(line.substitution_list ?? []).length) {
        alert('Aucun substitut autorisé pour ce produit.')
        return
      }
      setPicking(line.id)
      return
    }
    setPicking(null)
    await updateLine(line.id, { status: newStatus, substituted_name: null })
  }

  const minutesWaiting = (order: Order) => Math.floor((now - new Date(order.created_at).getTime()) / 60000)

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">Connecté en tant que {preparateur}</p>

      {localOrders.map(order => {
        const status = orderStatus(order.order_lines, order.assigned_to)
        return (
        <div key={order.id} className="border rounded p-4">
          <div className="flex justify-between items-center gap-2">
            <p className="font-semibold">
              Bon de commande #{order.order_number}
              {customerName(order.profiles) && ` · ${customerName(order.profiles)}`}
            </p>
            <span className={`text-xs px-2 py-1 rounded ${status.color}`}>{status.label}</span>
          </div>
          {status.note && <p className="text-xs text-red-600 mt-1">{status.note}</p>}
          {order.comment && (
            <p className="mt-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-sm whitespace-pre-line">
              💬 {order.comment}
            </p>
          )}

          <div className="mb-3 mt-1 text-sm">
            {order.assigned_to ? (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Préparée par {order.assigned_to}</span>
                {order.assigned_to !== preparateur && (
                  <button onClick={() => claim(order.id)} className="underline">
                    Reprendre
                  </button>
                )}
              </div>
            ) : (
              <div className="flex justify-between items-center">
                {/* L'heure du serveur et celle du téléphone peuvent différer d'une minute */}
                <span
                  suppressHydrationWarning
                  className={minutesWaiting(order) >= ALERT_AFTER_MINUTES ? 'text-red-600' : 'text-gray-500'}
                >
                  {minutesWaiting(order) >= ALERT_AFTER_MINUTES
                    ? `Non prise en charge depuis ${minutesWaiting(order)} min`
                    : 'Personne ne la prépare'}
                </span>
                <button onClick={() => claim(order.id)} className="bg-black text-white rounded px-3 py-1">
                  Je prends
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {groupByRayon(order.order_lines, rayons).map(group => (
              <div key={group.rayon?.id ?? 'a-repartir'} className="space-y-3">
                {/* Titre du rayon (seulement si le grossiste travaille par rayon) */}
                {rayons.length > 0 && (
                  <h3 className={`text-sm font-semibold border-b pb-1 ${group.rayon ? '' : 'text-amber-700'}`}>
                    {group.rayon ? group.rayon.name : 'À répartir'}
                  </h3>
                )}
                {group.lines.map(line => (
              <div key={line.id}>
                <div className="flex justify-between items-center">
                  <span>
                    {lineName(line)}{' '}
                    <span className="text-gray-500">— {formatQty(line.quantity, lineUnit(line))}</span>
                  </span>
                  <select
                    value={line.status}
                    onChange={e => handleStatusChange(line, e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500">
                  Substitution :{' '}
                  {line.substitution_mode === 'none'
                    ? 'refusée'
                    : line.substitution_mode === 'restricted'
                    ? `liste imposée : ${(line.substitution_list ?? []).join(' > ')}`
                    : 'libre'}
                  {line.substituted_name ? ` — remplacé par ${line.substituted_name}` : ''}
                </p>
                {picking === line.id && (
                  <select
                    className="border rounded px-2 py-1 text-sm mt-1 w-full"
                    defaultValue=""
                    onChange={e =>
                      e.target.value &&
                      updateLine(line.id, { status: 'substitué', substituted_name: e.target.value }).then(() =>
                        setPicking(null)
                      )
                    }
                  >
                    <option value="">Choisir le remplaçant...</option>
                    {(line.substitution_mode === 'restricted'
                      ? (line.substitution_list ?? []).map((name, i) => ({ key: name, name, label: `${i + 1}. ${name}` }))
                      : substitutes
                          .filter(p => p.name !== lineName(line))
                          .map(p => ({ key: p.id, name: p.name, label: p.name }))
                    ).map(opt => (
                      <option key={opt.key} value={opt.name}>{opt.label}</option>
                    ))}
                  </select>
                )}
                {/* Ligne pas encore rangée : un vendeur la range dans son rayon */}
                {rayons.length > 0 && !group.rayon && (
                  <select
                    value=""
                    onChange={e => e.target.value && updateLine(line.id, { rayon_id: e.target.value })}
                    className="border rounded px-2 py-1 text-xs mt-1 text-amber-700"
                  >
                    <option value="">Ranger dans…</option>
                    {rayons.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}
              </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        )
      })}
    </div>
  )
}