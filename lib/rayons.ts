// Rayons d'un grossiste (Bœuf, Veau, Agneau, Sous-vide, Triperie…) : une commande reste unique,
// mais ses lignes sont préparées rayon par rayon. Voir sql/13_rayons.sql.

export type Rayon = { id: string; name: string; position: number }

// Icône et couleurs d'un rayon, pour qu'on voie d'un coup d'œil où on est dans une commande.
// (Classes Tailwind écrites en entier : Tailwind ne détecte pas les classes construites morceau par morceau.)
type RayonStyle = { icon: string; band: string; border: string }

const STYLES: { match: RegExp; style: RayonStyle }[] = [
  { match: /sous.?vide/, style: { icon: '📦', band: 'bg-sky-100 text-sky-900', border: 'border-l-sky-500' } },
  { match: /triperie|abats|tripe/, style: { icon: '🫀', band: 'bg-purple-100 text-purple-900', border: 'border-l-purple-500' } },
  { match: /agneau|mouton/, style: { icon: '🐑', band: 'bg-emerald-100 text-emerald-900', border: 'border-l-emerald-500' } },
  { match: /veau/, style: { icon: '🐄', band: 'bg-rose-100 text-rose-900', border: 'border-l-rose-400' } },
  { match: /boeuf|bœuf/, style: { icon: '🐂', band: 'bg-red-100 text-red-900', border: 'border-l-red-600' } },
  { match: /volaille|poulet/, style: { icon: '🐓', band: 'bg-orange-100 text-orange-900', border: 'border-l-orange-500' } },
]
const DEFAULT_STYLE: RayonStyle = { icon: '🥩', band: 'bg-stone-100 text-stone-900', border: 'border-l-stone-400' }
const UNSORTED_STYLE: RayonStyle = { icon: '❓', band: 'bg-amber-100 text-amber-900', border: 'border-l-amber-500' }

// rayon null = « À répartir »
export function rayonStyle(rayon: Rayon | null): RayonStyle {
  if (!rayon) return UNSORTED_STYLE
  const name = rayon.name.toLowerCase()
  return STYLES.find(s => s.match.test(name))?.style ?? DEFAULT_STYLE
}

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
