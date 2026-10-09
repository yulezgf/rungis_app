// Supabase renvoie la relation `products` tantôt comme objet, tantôt comme tableau :
// ces helpers acceptent les deux formes.
type ProductFields = { name?: string; unit?: string }

function one(p: unknown): ProductFields | null {
  if (Array.isArray(p)) return p[0] ?? null
  return p as ProductFields | null
}

export function productName(p: unknown): string {
  return one(p)?.name ?? ''
}

export function productUnit(p: unknown): string {
  return one(p)?.unit ?? ''
}

// « 1 unité », « 3 unités », « 2 carcasses », « 2,5 kg »
export function formatQty(qty: number, unit: string): string {
  const plural = qty >= 2 && unit !== '' && unit !== 'kg'
  return `${qty.toLocaleString('fr-FR')} ${unit}${plural ? 's' : ''}`.trim()
}
