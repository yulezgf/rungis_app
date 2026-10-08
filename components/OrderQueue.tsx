'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Line = {
  id: string
  quantity: number
  status: string
  substitution_mode: string
  substituted_name: string | null
  products: { name: string }[]
}
type Order = { id: string; order_number: number; created_at: string; order_lines: Line[] }
type Product = { id: string; name: string }

const STATUSES = ['à préparer', 'en cours', 'prêt', 'rupture', 'substitué']

export default function OrderQueue({ orders, products }: { orders: Order[]; products: Product[] }) {
  const [localOrders, setLocalOrders] = useState(orders)
  const [picking, setPicking] = useState<string | null>(null)

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
      setPicking(line.id)
      return
    }
    setPicking(null)
    await updateLine(line.id, { status: newStatus, substituted_name: null })
  }

  return (
    <div className="space-y-6">
      {localOrders.map(order => (
        <div key={order.id} className="border rounded p-4">
          <p className="font-semibold mb-2">Bon de commande #{order.order_number}</p>
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
                  Substitution : {line.substitution_mode === 'none' ? 'refusée' : 'libre'}
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
                    {products
                      .filter(p => p.name !== line.products?.[0]?.name)
                      .map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
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