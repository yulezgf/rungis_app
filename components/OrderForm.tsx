'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Product = { id: string; name: string; unit: string; grossiste_id: string }

export default function OrderForm({ products }: { products: Product[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [orderNumber, setOrderNumber] = useState<number | null>(null)

  const updateQty = (id: string, value: number) => {
    setQuantities(prev => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async () => {
    const lines = Object.entries(quantities).filter(([_, qty]) => qty > 0)
    if (lines.length === 0) return

    const grossisteId = products[0].grossiste_id

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
    }))

    const { error: linesError } = await supabase.from('order_lines').insert(orderLines)
    if (linesError) {
      alert('Erreur ajout lignes: ' + linesError.message)
      return
    }

    setOrderNumber(order.order_number)
  }

  if (orderNumber) return <p className="p-4 text-green-600">Bon de commande #{orderNumber} créé !</p>

  return (
    <div className="space-y-2">
      {products.map(p => (
        <div key={p.id} className="flex justify-between items-center border-b pb-2">
          <span>{p.name}</span>
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