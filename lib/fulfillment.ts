// Comment le client récupère sa commande (orders.fulfillment, sql/17)
export type Fulfillment = 'retrait' | 'livraison'

export const FULFILLMENT: Record<Fulfillment, { icon: string; label: string }> = {
  retrait: { icon: '🏪', label: 'Retrait sur place' },
  livraison: { icon: '🚚', label: 'Livraison' },
}

// Valeur inconnue ou absente (anciennes commandes) : retrait, la valeur par défaut en base
export function fulfillmentOf(value: string | null | undefined) {
  return FULFILLMENT[value === 'livraison' ? 'livraison' : 'retrait']
}
