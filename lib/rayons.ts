// Rayons d'un grossiste (Bœuf, Veau, Agneau, Sous-vide, Triperie…) : une commande reste unique,
// mais ses lignes sont préparées rayon par rayon. Voir sql/13_rayons.sql.

export type Rayon = { id: string; name: string; position: number }

export type RayonGroup<L> = {
  rayon: Rayon | null // null = « À répartir » (produit non classé ou ligne libre)
  lines: L[]
}

// Regroupe les lignes par rayon, dans l'ordre des rayons, « À répartir » en dernier.
// Un grossiste sans rayon : un seul groupe, sans titre (rien ne change pour lui).
export function groupByRayon<L extends { rayon_id: string | null }>(lines: L[], rayons: Rayon[]): RayonGroup<L>[] {
  if (rayons.length === 0) return [{ rayon: null, lines }]

  const sorted = [...rayons].sort((a, b) => a.position - b.position)
  const groups: RayonGroup<L>[] = sorted.map(rayon => ({
    rayon,
    lines: lines.filter(l => l.rayon_id === rayon.id),
  }))
  const known = new Set(sorted.map(r => r.id))
  groups.push({ rayon: null, lines: lines.filter(l => !l.rayon_id || !known.has(l.rayon_id)) })

  return groups.filter(g => g.lines.length > 0)
}
