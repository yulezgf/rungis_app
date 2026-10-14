'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatQty } from '@/lib/productName'

type Product = { id: string; name: string; unit: string; grossiste_id: string }

// Produit saisi librement : absent de la liste de référence, mais le grossiste peut l'avoir
type FreeLine = { key: number; name: string; qty: number; unit: string; mode: string }

// Boutons − / + et champ de quantité (on peut aussi taper le nombre)
function QtyStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Moins de ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-9 h-9 border rounded text-lg leading-none"
      >
        −
      </button>
      <input
        inputMode="numeric"
        value={value || ''}
        placeholder="0"
        onChange={e => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
        className="w-12 h-9 border rounded text-center"
      />
      <button
        type="button"
        aria-label={`Plus de ${label}`}
        onClick={() => onChange(value + 1)}
        className="w-9 h-9 border rounded text-lg leading-none"
      >
        +
      </button>
    </div>
  )
}

export default function OrderForm({
  products,
  grossisteId,
  grossisteName,
}: {
  products: Product[]
  grossisteId: string
  grossisteName: string
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [modes, setModes] = useState<Record<string, string>>({})
  const [lists, setLists] = useState<Record<string, string[]>>({})
  const [createdOrder, setCreatedOrder] = useState<{ id: string; number: number; summary: { name: string; unit: string; qty: number }[] } | null>(null)

  const [freeLines, setFreeLines] = useState<FreeLine[]>([])

  const addFreeLine = () =>
    setFreeLines(prev => [...prev, { key: Date.now(), name: '', qty: 1, unit: 'unité', mode: 'none' }])
  const updateFree = (key: number, patch: Partial<FreeLine>) =>
    setFreeLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)))
  const removeFree = (key: number) => setFreeLines(prev => prev.filter(l => l.key !== key))

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
    // Une ligne libre compte si elle a un nom et une quantité
    const free = freeLines.filter(l => l.name.trim() && l.qty > 0)
    if (lines.length === 0 && free.length === 0) return

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
    const freeOrderLines = free.map(l => ({
      order_id: order.id,
      product_id: null,
      custom_name: l.name.trim(),
      custom_unit: l.unit,
      quantity: l.qty,
      substitution_mode: l.mode,
      substitution_list: [],
    }))

    const { error: linesError } = await supabase.from('order_lines').insert([...orderLines, ...freeOrderLines])
    if (linesError) {
      alert('Erreur ajout lignes: ' + linesError.message)
      return
    }

    const summary = lines.map(([productId, qty]) => {
      const product = products.find(p => p.id === productId)
      return { name: product?.name ?? '', unit: product?.unit ?? '', qty }
    })
    for (const l of free) summary.push({ name: l.name.trim(), unit: l.unit, qty: l.qty })
    setCreatedOrder({ id: order.id, number: order.order_number, summary })
  }

if (createdOrder) return (
  <div className="p-4 space-y-3">
    <p className="text-green-600">Bon de commande #{createdOrder.number} envoyé chez {grossisteName} !</p>
    <ul className="space-y-1">
      {createdOrder.summary.map((l, i) => (
        <li key={i} className="flex justify-between border-b pb-1">
          <span>{l.name}</span>
          <span className="text-gray-500">{formatQty(l.qty, l.unit)}</span>
        </li>
      ))}
    </ul>
    <Link href={`/suivi/${createdOrder.id}`} className="block underline">
      Suivre ma commande en direct
    </Link>
    <Link href="/commandes" className="block text-sm underline text-gray-500">
      Toutes mes commandes
    </Link>
  </div>
)

  return (
    <div className="space-y-2">
      {products.map(p => {
        const chosen = lists[p.id] ?? ['', '', '']
        return (
          <div key={p.id} className="border-b pb-2">
            <p className="font-medium">{p.name}</p>
            <div className="flex justify-between items-center gap-2 mt-1">
              <select
                className="border rounded px-1 py-1 text-xs"
                defaultValue="none"
                onChange={e => updateMode(p.id, e.target.value)}
              >
                <option value="none">Pas de substitut</option>
                <option value="open">Substitut libre</option>
                <option value="restricted">Ma liste</option>
              </select>
              <div className="flex items-center gap-1">
                <QtyStepper value={quantities[p.id] ?? 0} onChange={v => updateQty(p.id, v)} label={p.name} />
                <span className="w-14 text-xs text-gray-500">{p.unit}</span>
              </div>
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

      {/* Produits saisis librement : la liste aide à aller vite, mais ne limite jamais la commande */}
      <div className="pt-4 space-y-3">
        {freeLines.map(l => (
          <div key={l.key} className="border-b pb-2 space-y-1">
            <div className="flex gap-2">
              <input
                value={l.name}
                onChange={e => updateFree(l.key, { name: e.target.value })}
                placeholder="Ex : Cuisses de pintade fermière"
                className="flex-1 border rounded px-2 py-1"
              />
              <button
                type="button"
                aria-label="Retirer ce produit"
                onClick={() => removeFree(l.key)}
                className="w-9 h-9 border rounded text-gray-500"
              >
                ×
              </button>
            </div>
            <div className="flex justify-between items-center gap-2">
              <select
                value={l.mode}
                onChange={e => updateFree(l.key, { mode: e.target.value })}
                className="border rounded px-1 py-1 text-xs"
              >
                <option value="none">Pas de substitut</option>
                <option value="open">Substitut libre</option>
              </select>
              <div className="flex items-center gap-1">
                <QtyStepper value={l.qty} onChange={v => updateFree(l.key, { qty: v })} label={l.name || 'ce produit'} />
                <select
                  value={l.unit}
                  onChange={e => updateFree(l.key, { unit: e.target.value })}
                  className="border rounded px-1 py-1 text-xs"
                >
                  <option value="unité">unité</option>
                  <option value="carcasse">carcasse</option>
                </select>
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={addFreeLine} className="w-full border border-dashed rounded py-2 text-sm">
          + Ajouter un produit qui n&apos;est pas dans la liste
        </button>
      </div>

      <button onClick={handleSubmit} className="w-full bg-black text-white rounded py-2 mt-4">
        Envoyer la commande
      </button>
    </div>
  )
}