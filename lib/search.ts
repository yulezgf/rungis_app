// Recherche dans le référentiel, tolérante : sans accents ni majuscules, au milieu des mots.
// « cote » trouve « Côte de bœuf », « toul » trouve « Saucisse de Toulouse ».

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/œ/g, 'oe') // « bœuf » → « boeuf »
    .replace(/æ/g, 'ae')
    .trim()
}

// Les produits qui contiennent la saisie, les mieux placés en premier :
// d'abord ceux que ce grossiste vend (assortiment), puis ceux qui COMMENCENT par la saisie.
export function searchProducts<T extends { id: string; name: string }>(
  products: T[],
  query: string,
  preferredIds: Set<string>,
  limit = 8
): T[] {
  const q = normalize(query)
  if (q.length < 2) return []

  return products
    .map(p => ({ p, name: normalize(p.name) }))
    .filter(({ name }) => name.includes(q))
    .sort((a, b) => {
      const pref = Number(preferredIds.has(b.p.id)) - Number(preferredIds.has(a.p.id))
      if (pref !== 0) return pref
      const starts = Number(b.name.startsWith(q)) - Number(a.name.startsWith(q))
      if (starts !== 0) return starts
      return a.name.localeCompare(b.name)
    })
    .slice(0, limit)
    .map(({ p }) => p)
}
