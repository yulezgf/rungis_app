'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Line = { id: string; quantity: number; status: string; products: { name: string }[] }
type Order = { id: string; order_number: number; created_at: string; order_lines: Line[] }

const STATUSES = ['à préparer', 'en cours', 'prêt', 'rupture']

export default function OrderQueue({ orders }: { orders: Order[] }) {
  const [localOrders, setLocalOrders] = useState(orders)

  const updateStatus = async (lineId: string, newStatus: string) => {
    const { error } = await supabase
      .from('order_lines')
      .update({ status: newStatus })
      .eq('id', lineId)

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }

    setLocalOrders(prev =>
      prev.map(order => ({
        ...order,
        order_lines: order.order_lines.map(line =>
          line.id === lineId ? { ...line, status: newStatus } : line
        ),
      }))
    )
  }

  return (
    <div className="space-y-6">
      {localOrders.map(order => (
        <div key={order.id} className="border rounded p-4">
          <p className="font-semibold mb-2">Bon de commande #{order.order_number}</p>
          <div className="space-y-2">
            {order.order_lines.map(line => (
              <div key={line.id} className="flex justify-between items-center">
                <span>{line.products?.[0]?.name} ×{line.quantity}</span>
                <select
                  value={line.status}
                  onChange={e => updateStatus(line.id, e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}