'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Line = {
  id: string
  quantity: number
  status: string
  substitution_mode: string
  substitution_list: string[] | null
  substituted_name: string | null
  products: { name: string }[]
}
type Order = {
  id: string
  order_number: number
  created_at: string
  assigned_to: string | null
  assigned_at: string | null
  order_lines: Line[]
}
type Product = { id: string; name: string }

const STATUSES = ['à préparer', 'en cours', 'prêt', 'rupture', 'substitué']
const ALERT_AFTER_MINUTES = 30

export default function OrderQueue({ orders, products }: { orders: Order[]; products: Product[] }) {
  const [localOrders, setLocalOrders] = useState(orders)
  const [picking, setPicking] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setName(localStorage.getItem('preparateur') ?? '')
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  const saveName = (value: string) => {
    setName(value)
    localStorage.setItem('preparateur', value)
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
    await supabase.from('assignment_history').insert({ order_id: orderId, assigned_to: preparateur })
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

  const minutesWaiting = (order: Order) =>
    now === null ? 0 : Math.floor((now - new Date(order.created_at).getTime()) / 60000)

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

      {localOrders.map(order => (
        <div key={order.id} className="border rounded p-4">
          <p className="font-semibold">Bon de commande #{order.order_number}</p>

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
                <span className={minutesWaiting(order) >= ALERT_AFTER_MINUTES ? 'text-red-600' : 'text-gray-500'}>
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
                  <span>{line.products?.[0]?.name} ×{line.quantity}</span>
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
                          .filter(p => p.name !== line.products?.[0]?.name)
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
      ))}
    </div>
  )
}