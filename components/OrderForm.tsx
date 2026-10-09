'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Product = { id: string; name: string; unit: string; grossiste_id: string }

export default function OrderForm({ products, grossisteId }: { products: Product[]; grossisteId: string }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [modes, setModes] = useState<Record<string, string>>({})
  const [lists, setLists] = useState<Record<string, string[]>>({})
  const [createdOrder, setCreatedOrder] = useState<{ id: string; number: number; summary: { name: string; unit: string; qty: number }[] } | null>(null)

  const updateQty = (id: string, value: number) => {
    setQuantities(prev => ({ ...prev, [id]: value }))
  }

  const updateMode = (id: string, value: string) => {
    setModes(prev => ({ ...prev, [id]: value }))
  }

  const updateList = (productId: string, rank: number, value: string) => {
    setLists(prev => {
      const current = [...(prev[productId] ?? ['', '', ''])]
      current[rank] = value
      return { ...prev, [productId]: current }
    })
  }

  const handleSubmit = async () => {
    const lines = Object.entries(quantities).filter(([, qty]) => qty > 0)
    if (lines.length === 0) return

    for (const [productId] of lines) {
      if (modes[productId] === 'restricted') {
        const list = (lists[productId] ?? []).filter(Boolean)
        if (list.length === 0) {
          const name = products.find(p => p.id === productId)?.name
          alert(`Choisis au moins un substitut pour ${name}, ou change le mode.`)
          return
        }
      }
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({ grossiste_id: grossisteId })
      .select()
      .single()

    if (error || !order) {
      alert('Erreur création commande: ' + error?.message)
      return
    }

    const orderLines = lines.map(([productId, qty]) => {
      const mode = modes[productId] ?? 'none'
      return {
        order_id: order.id,
        product_id: productId,
        quantity: qty,
        substitution_mode: mode,
        substitution_list: mode === 'restricted' ? (lists[productId] ?? []).filter(Boolean) : [],
      }
    })

    const { error: linesError } = await supabase.from('order_lines').insert(orderLines)
    if (linesError) {
      alert('Erreur ajout lignes: ' + linesError.message)
      return
    }

    const summary = lines.map(([productId, qty]) => {
      const product = products.find(p => p.id === productId)
      return { name: product?.name ?? '', unit: product?.unit ?? '', qty }
    })
    setCreatedOrder({ id: order.id, number: order.order_number, summary })
  }

if (createdOrder) return (
  <div className="p-4 space-y-3">
    <p className="text-green-600">Bon de commande #{createdOrder.number} créé !</p>
    <ul className="space-y-1">
      {createdOrder.summary.map(l => (
        <li key={l.name} className="flex justify-between border-b pb-1">
          <span>{l.name}</span>
          <span className="text-gray-500">{l.qty} {l.unit}</span>
        </li>
      ))}
    </ul>
    <Link href={`/suivi/${createdOrder.id}`} className="underline">
      Suivre ma commande en direct
    </Link>
  </div>
)

  return (
    <div className="space-y-2">
      {products.map(p => {
        const chosen = lists[p.id] ?? ['', '', '']
        return (
          <div key={p.id} className="border-b pb-2">
            <div className="flex justify-between items-center gap-2">
              <span className="flex-1">{p.name}</span>
              <select
                className="border rounded px-1 py-1 text-xs"
                defaultValue="none"
                onChange={e => updateMode(p.id, e.target.value)}
              >
                <option value="none">Pas de substitut</option>
                <option value="open">Substitut libre</option>
                <option value="restricted">Ma liste</option>
              </select>
              <input
                type="number"
                min={0}
                className="w-16 border rounded px-2 py-1 text-right"
                placeholder="0"
                onChange={e => updateQty(p.id, Number(e.target.value))}
              />
              <span className="w-10 text-xs text-gray-500">{p.unit}</span>
            </div>

            {modes[p.id] === 'restricted' && (
              <div className="mt-2 space-y-1 pl-2">
                {[0, 1, 2].map(rank => (
                  <select
                    key={rank}
                    value={chosen[rank] ?? ''}
                    onChange={e => updateList(p.id, rank, e.target.value)}
                    className="block w-full border rounded px-2 py-1 text-sm"
                  >
                    <option value="">
                      {rank === 0 ? '1er choix...' : rank === 1 ? '2e choix (facultatif)...' : '3e choix (facultatif)...'}
                    </option>
                    {products
                      .filter(x => x.id !== p.id && !chosen.filter((_, i) => i !== rank).includes(x.name))
                      .map(x => (
                        <option key={x.id} value={x.name}>{x.name}</option>
                      ))}
                  </select>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <button onClick={handleSubmit} className="w-full bg-black text-white rounded py-2 mt-4">
        Envoyer la commande
      </button>
    </div>
  )
}