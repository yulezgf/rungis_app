// Statut global d'une commande, calculé à partir du statut de ses lignes.
// Il n'est pas stocké en base : il ne peut donc jamais être en désaccord avec les lignes.

export type OrderStatus = {
  label: string
  color: string
  note: string | null
}

const DONE = ['prêt', 'substitué']

// Commande terminée côté grossiste : complète, partielle ou en rupture (plus rien à préparer)
export const FINISHED = ['complète', 'partielle', 'en rupture']

// Prénoms de ceux qui préparent des lignes (prise en charge par rayon), ex. « Moussa, Devrick »
export function linePreparers(lines: { assigned_to?: string | null }[]): string | null {
  const names = [...new Set(lines.map(l => l.assigned_to).filter((n): n is string => !!n))]
  return names.length > 0 ? names.join(', ') : null
}

export function orderStatus(lines: { status: string }[], assignedTo: string | null): OrderStatus {
  const total = lines.length
  const done = lines.filter(l => DONE.includes(l.status)).length
  const ruptures = lines.filter(l => l.status === 'rupture').length
  const ruptureNote = ruptures > 0 ? `${ruptures} produit${ruptures > 1 ? 's' : ''} en rupture` : null

  // Toutes les lignes sont traitées
  if (done + ruptures === total && total > 0) {
    if (ruptures === 0) return { label: 'complète', color: 'bg-green-100 text-green-700', note: null }
    if (done === 0) return { label: 'en rupture', color: 'bg-red-100 text-red-700', note: 'Aucun produit disponible' }
    return { label: 'partielle', color: 'bg-red-100 text-red-700', note: `${done}/${total} produits — ${ruptureNote}` }
  }

  // Personne n'a pris la commande ni touché aux lignes
  if (!assignedTo && lines.every(l => l.status === 'à préparer')) {
    return { label: 'à préparer', color: 'bg-gray-100 text-gray-600', note: null }
  }

  // En cours : une rupture est signalée tout de suite, sans attendre la fin
  return {
    label: assignedTo ? `en préparation par ${assignedTo}` : 'en préparation',
    color: 'bg-blue-100 text-blue-700',
    note: ruptureNote,
  }
}
