// Supabase renvoie une relation (products, grossistes, profiles…) tantôt comme objet,
// tantôt comme tableau : ces helpers acceptent les deux formes.
function one<T>(p: unknown): T | null {
  if (Array.isArray(p)) return p[0] ?? null
  return p as T | null
}

export function productName(p: unknown): string {
  return one<{ name?: string }>(p)?.name ?? ''
}

export function productUnit(p: unknown): string {
  return one<{ unit?: string }>(p)?.unit ?? ''
}

// Une ligne de commande = un produit de la liste de référence (products)
// OU un produit saisi librement par le client (custom_name + custom_unit).
type LineLike = { products: unknown; custom_name?: string | null; custom_unit?: string | null }

export function lineName(line: LineLike): string {
  return productName(line.products) || line.custom_name || ''
}

export function lineUnit(line: LineLike): string {
  return productUnit(line.products) || line.custom_unit || ''
}

// Nom de la boutique du client (relation profiles d'une commande)
export function customerName(p: unknown): string | null {
  return one<{ display_name?: string }>(p)?.display_name ?? null
}

// « 1 unité », « 3 unités », « 2 carcasses », « 2,5 kg »
export function formatQty(qty: number, unit: string): string {
  const plural = qty >= 2 && unit !== '' && unit !== 'kg'
  return `${qty.toLocaleString('fr-FR')} ${unit}${plural ? 's' : ''}`.trim()
}
