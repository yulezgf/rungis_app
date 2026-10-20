'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatQty } from '@/lib/productName'
import { searchProducts } from '@/lib/search'

type Product = { id: string; name: string; unit: string; category: string | null }
type Mode = 'none' | 'open' | 'restricted'

// Une ligne de « Ma commande » : un produit du référentiel (productId)
// ou un produit saisi librement (productId = null, nom et unité choisis par le client).
type CartLine = {
  key: string
  productId: string | null
  name: string
  unit: string
  qty: number
  mode: Mode
  list: string[] // remplaçants autorisés, mode « Ma liste »
}

const newLine = (p: Product, qty: number): CartLine => ({
  key: p.id,
  productId: p.id,
  name: p.name,
  unit: p.unit,
  qty,
  mode: 'none',
  list: ['', '', ''],
})

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

// Une ligne éditable : nom, mode de substitution, quantité (et liste de remplaçants en « Ma liste »)
function LineEditor({
  line,
  onChange,
  onRemove,
  substitutes,
}: {
  line: CartLine
  onChange: (line: CartLine) => void
  onRemove?: () => void
  substitutes: Product[] // choix possibles pour « Ma liste » (l'assortiment du grossiste)
}) {
  const isFree = line.productId === null
  return (
    <div className="border-b pb-2">
      <div className="flex gap-2 items-center">
        {isFree ? (
          <input
            value={line.name}
            onChange={e => onChange({ ...line, name: e.target.value })}
            className="flex-1 border rounded px-2 py-1"
          />
        ) : (
          <p className="flex-1 font-medium">{line.name}</p>
        )}
        {onRemove && (
          <button
            type="button"
            aria-label={`Retirer ${line.name}`}
            onClick={onRemove}
            className="w-9 h-9 border rounded text-gray-500"
          >
            ×
          </button>
        )}
      </div>
      <div className="flex justify-between items-center gap-2 mt-1">
        <select
          value={line.mode}
          onChange={e => onChange({ ...line, mode: e.target.value as Mode })}
          className="border rounded px-1 py-1 text-xs"
        >
          <option value="none">Pas de substitut</option>
          <option value="open">Substitut libre</option>
          {!isFree && <option value="restricted">Ma liste</option>}
        </select>
        <div className="flex items-center gap-1">
          <QtyStepper value={line.qty} onChange={qty => onChange({ ...line, qty })} label={line.name || 'ce produit'} />
          {isFree ? (
            <select
              value={line.unit}
              onChange={e => onChange({ ...line, unit: e.target.value })}
              className="border rounded px-1 py-1 text-xs"
            >
              <option value="unité">unité</option>
              <option value="carcasse">carcasse</option>
              <option value="carton">carton</option>
            </select>
          ) : (
            <span className="w-14 text-xs text-gray-500">{line.unit}</span>
          )}
        </div>
      </div>

      {line.mode === 'restricted' && (
        <div className="mt-2 space-y-1 pl-2">
          {[0, 1, 2].map(rank => (
            <select
              key={rank}
              value={line.list[rank] ?? ''}
              onChange={e => {
                const list = [...line.list]
                list[rank] = e.target.value
                onChange({ ...line, list })
              }}
              className="block w-full border rounded px-2 py-1 text-sm"
            >
              <option value="">
                {rank === 0 ? '1er choix...' : rank === 1 ? '2e choix (facultatif)...' : '3e choix (facultatif)...'}
              </option>
              {substitutes
                .filter(x => x.id !== line.productId && !line.list.filter((_, i) => i !== rank).includes(x.name))
                .map(x => (
                  <option key={x.id} value={x.name}>{x.name}</option>
                ))}
            </select>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrderForm({
  catalog,
  assortmentIds,
  top,
  grossisteId,
  grossisteName,
}: {
  catalog: Product[] // tout le référentiel (pour la recherche)
  assortmentIds: string[] // ce que ce grossiste vend
  top: Product[] // le top 10 : habitudes du client, puis meilleures ventes du grossiste
  grossisteId: string
  grossisteName: string
}) {
  const [cart, setCart] = useState<CartLine[]>([])
  const [query, setQuery] = useState('')
  const [comment, setComment] = useState('')
  const [createdOrder, setCreatedOrder] = useState<{
    id: string
    number: number
    summary: { name: string; unit: string; qty: number }[]
    comment: string
  } | null>(null)

  const assortment = useMemo(() => new Set(assortmentIds), [assortmentIds])
  const topIds = useMemo(() => new Set(top.map(p => p.id)), [top])
  const substitutes = useMemo(() => catalog.filter(p => assortment.has(p.id)), [catalog, assortment])
  const suggestions = useMemo(() => searchProducts(catalog, query, assortment), [catalog, query, assortment])

  // Ajoute la ligne, ou la remplace si elle existe déjà (même clé)
  const upsert = (line: CartLine) =>
    setCart(prev => (prev.some(l => l.key === line.key) ? prev.map(l => (l.key === line.key ? line : l)) : [...prev, line]))
  const remove = (key: string) => setCart(prev => prev.filter(l => l.key !== key))
  const lineFor = (p: Product) => cart.find(l => l.productId === p.id) ?? newLine(p, 0)

  // Suggestion choisie : +1 si le produit est déjà dans la commande
  const addProduct = (p: Product) => {
    const existing = cart.find(l => l.productId === p.id)
    upsert(existing ? { ...existing, qty: existing.qty + 1 } : newLine(p, 1))
    setQuery('')
  }

  // Rien ne convient : le produit part tel qu'il a été tapé (ligne libre)
  const addFree = () => {
    const name = query.trim()
    if (!name) return
    upsert({ key: `libre-${Date.now()}`, productId: null, name, unit: 'unité', qty: 1, mode: 'none', list: [] })
    setQuery('')
  }

  const handleSubmit = async () => {
    const lines = cart.filter(l => l.qty > 0 && l.name.trim())
    if (lines.length === 0) return

    for (const l of lines) {
      if (l.mode === 'restricted' && l.list.filter(Boolean).length === 0) {
        alert(`Choisis au moins un substitut pour ${l.name}, ou change le mode.`)
        return
      }
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({ grossiste_id: grossisteId, comment: comment.trim() || null })
      .select()
      .single()

    if (error || !order) {
      alert('Erreur création commande: ' + error?.message)
      return
    }

    const rows = lines.map(l =>
      l.productId
        ? {
            order_id: order.id,
            product_id: l.productId,
            quantity: l.qty,
            substitution_mode: l.mode,
            substitution_list: l.mode === 'restricted' ? l.list.filter(Boolean) : [],
          }
        : {
            order_id: order.id,
            product_id: null,
            custom_name: l.name.trim(),
            custom_unit: l.unit,
            quantity: l.qty,
            substitution_mode: l.mode,
            substitution_list: [],
          }
    )

    const { error: linesError } = await supabase.from('order_lines').insert(rows)
    if (linesError) {
      alert('Erreur ajout lignes: ' + linesError.message)
      return
    }

    setCreatedOrder({
      id: order.id,
      number: order.order_number,
      summary: lines.map(l => ({ name: l.name.trim(), unit: l.unit, qty: l.qty })),
      comment: comment.trim(),
    })
  }

  if (createdOrder)
    return (
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
        {createdOrder.comment && (
          <p className="text-sm text-gray-600 whitespace-pre-line">💬 {createdOrder.comment}</p>
        )}
        <Link href={`/suivi/${createdOrder.id}`} className="block underline">
          Suivre ma commande en direct
        </Link>
        <Link href="/commandes" className="block text-sm underline text-gray-500">
          Toutes mes commandes
        </Link>
      </div>
    )

  // Produits ajoutés par la recherche ou saisis librement (le top 10 a sa propre section)
  const added = cart.filter(l => !l.productId || !topIds.has(l.productId))
  const count = cart.filter(l => l.qty > 0).length

  return (
    <div className="space-y-6">
      {/* Champ à double comportement : suggère un produit de la liste, sinon l'ajoute tel quel */}
      <div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && suggestions.length === 0) addFree()
          }}
          placeholder="🔍 Tape un produit…"
          className="block w-full border rounded px-3 py-2"
        />
        {query.trim().length >= 2 && (
          <ul className="border rounded mt-1 divide-y">
            {suggestions.map(p => (
              <li key={p.id}>
                <button type="button" onClick={() => addProduct(p)} className="w-full text-left px-3 py-2">
                  {p.name}
                  {!assortment.has(p.id) && <span className="text-xs text-gray-400"> · autre produit de la liste</span>}
                </button>
              </li>
            ))}
            <li>
              <button type="button" onClick={addFree} className="w-full text-left px-3 py-2 text-gray-600">
                Ajouter « {query.trim()} » tel quel
              </button>
            </li>
          </ul>
        )}
      </div>

      {top.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Produits fréquents</h2>
          {top.map(p => (
            <LineEditor key={p.id} line={lineFor(p)} onChange={upsert} substitutes={substitutes} />
          ))}
        </section>
      )}

      {added.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Ajoutés à ma commande</h2>
          {added.map(l => (
            <LineEditor key={l.key} line={l} onChange={upsert} onRemove={() => remove(l.key)} substitutes={substitutes} />
          ))}
        </section>
      )}

      <div>
        <label htmlFor="comment" className="font-semibold">
          Un mot pour le préparateur <span className="font-normal text-gray-500">(facultatif)</span>
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Ex : je passe vers 5h, bien parer les bavettes…"
          className="block w-full border rounded px-3 py-2 mt-1"
        />
      </div>

      <button onClick={handleSubmit} className="w-full bg-black text-white rounded py-2">
        Envoyer la commande{count > 0 ? ` (${count} produit${count > 1 ? 's' : ''})` : ''}
      </button>
    </div>
  )
}
