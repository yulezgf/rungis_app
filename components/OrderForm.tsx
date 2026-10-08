'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Product = { id: string; name: string; unit: string; grossiste_id: string }

export default function OrderForm({ products, grossisteId }: { products: Product[]; grossisteId: string }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [modes, setModes] = useState<Record<string, string>>({})
  const [createdOrder, setCreatedOrder] = useState<{ id: string; number: number } | null>(null)

  const updateQty = (id: string, value: number) => {
    setQuantities(prev => ({ ...prev, [id]: value }))
  }

  const updateMode = (id: string, value: string) => {
    setModes(prev => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async () => {
    const lines = Object.entries(quantities).filter(([_, qty]) => qty > 0)
    if (lines.length === 0) return

    const { data: order, error } = await supabase
      .from('orders')
      .insert({ grossiste_id: grossisteId })
      .select()
      .single()

    if (error || !order) {
      alert('Erreur création commande: ' + error?.message)
      return
    }

    const orderLines = lines.map(([productId, qty]) => ({
      order_id: order.id,
      product_id: productId,
      quantity: qty,
      substitution_mode: modes[productId] ?? 'none',
    }))

    const { error: linesError } = await supabase.from('order_lines').insert(orderLines)
    if (linesError) {
      alert('Erreur ajout lignes: ' + linesError.message)
      return
    }

    setCreatedOrder({ id: order.id, number: order.order_number })
  }

  if (createdOrder) return (
    <div className="p-4 space-y-2">
      <p className="text-green-600">Bon de commande #{createdOrder.number} créé !</p>
      <Link href={`/suivi/${createdOrder.id}`} className="underline">
        Suivre ma commande en direct
      </Link>
    </div>
  )

  return (
    <div className="space-y-2">
      {products.map(p => (
        <div key={p.id} className="flex justify-between items-center border-b pb-2 gap-2">
          <span className="flex-1">{p.name}</span>
          <select
            className="border rounded px-1 py-1 text-xs"
            defaultValue="none"
            onChange={e => updateMode(p.id, e.target.value)}
          >
            <option value="none">Pas de substitut</option>
            <option value="open">Substitut Autoeisé</option>
          </select>
          <input
            type="number"
            min={0}
            className="w-16 border rounded px-2 py-1 text-right"
            placeholder="0"
            onChange={e => updateQty(p.id, Number(e.target.value))}
          />
        </div>
      ))}
      <button onClick={handleSubmit} className="w-full bg-black text-white rounded py-2 mt-4">
        Envoyer la commande
      </button>
    </div>
  )
}