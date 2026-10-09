'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { productName, productUnit, formatQty } from '@/lib/productName'
import { orderStatus } from '@/lib/orderStatus'

const PREPARATEUR_KEY = 'preparateur'
const subscribeStorage = (callback: () => void) => {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

type Line = {
  id: string
  quantity: number
  status: string
  substitution_mode: string
  substitution_list: string[] | null
  substituted_name: string | null
  products: unknown
}
type Order = {
  id: string
  order_number: number
  created_at: string
  assigned_to: string | null
  assigned_at: string | null
  order_lines: Line[]
}
type Product = { id: string; name: string; unit: string }

const STATUSES = ['à préparer', 'en cours', 'prêt', 'rupture', 'substitué']
const ALERT_AFTER_MINUTES = 30

export default function OrderQueue({
  orders,
  products,
  grossisteId,
}: {
  orders: Order[]
  products: Product[]
  grossisteId: string
}) {
  const [localOrders, setLocalOrders] = useState(orders)
  const [picking, setPicking] = useState<string | null>(null)
  // Prénom lu directement dans le localStorage (vide côté serveur, rempli dans le navigateur)
  const name = useSyncExternalStore(
    subscribeStorage,
    () => localStorage.getItem(PREPARATEUR_KEY) ?? '',
    () => ''
  )
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
                    order_lines: [],
                  },
                  ...prev,
                ]
          )
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
                    x.id === l.id ? { ...x, status: l.status, substituted_name: l.substituted_name } : x
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

  const saveName = (value: string) => {
    localStorage.setItem(PREPARATEUR_KEY, value)
    // L'événement 'storage' ne se déclenche que dans les autres onglets : on prévient celui-ci aussi
    window.dispatchEvent(new StorageEvent('storage', { key: PREPARATEUR_KEY }))
  }

  const claim = async (orderId: string) => {
    const preparateur = name.trim()
    if (!preparateur) {
      alert('Entre ton prénom en haut de la page.')
      return
    }
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
    patch: { status: string; substituted_name: string | null }
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
      <div>
        <label className="text-sm text-gray-500">Ton prénom (préparateur)</label>
        <input
          value={name}
          onChange={e => saveName(e.target.value)}
          placeholder="Ex : Ahmed"
          className="block w-full border rounded px-2 py-1 mt-1"
        />
      </div>

      {localOrders.map(order => {
        const status = orderStatus(order.order_lines, order.assigned_to)
        return (
        <div key={order.id} className="border rounded p-4">
          <div className="flex justify-between items-center gap-2">
            <p className="font-semibold">Bon de commande #{order.order_number}</p>
            <span className={`text-xs px-2 py-1 rounded ${status.color}`}>{status.label}</span>
          </div>
          {status.note && <p className="text-xs text-red-600 mt-1">{status.note}</p>}

          <div className="mb-3 mt-1 text-sm">
            {order.assigned_to ? (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Préparée par {order.assigned_to}</span>
                {order.assigned_to !== name.trim() && (
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

          <div className="space-y-3">
            {order.order_lines.map(line => (
              <div key={line.id}>
                <div className="flex justify-between items-center">
                  <span>
                    {productName(line.products)}{' '}
                    <span className="text-gray-500">— {formatQty(line.quantity, productUnit(line.products))}</span>
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
                      : products
                          .filter(p => p.name !== productName(line.products))
                          .map(p => ({ key: p.id, name: p.name, label: p.name }))
                    ).map(opt => (
                      <option key={opt.key} value={opt.name}>{opt.label}</option>
                    ))}
                  </select>
                )} 
              </div>
            ))}
          </div>
        </div>
        )
      })}
    </div>
  )
}