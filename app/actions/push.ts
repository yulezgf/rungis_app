'use server'
// Server Actions des notifications : appelées depuis le navigateur, exécutées sur le serveur
// (au nom de la personne connectée : la RLS s'applique).
import { createSupabaseServer } from '@/lib/supabase-server'
import { sendPush } from '@/lib/push'
import { customerName } from '@/lib/productName'
import { rayonStyle } from '@/lib/rayons'
import { fulfillmentOf } from '@/lib/fulfillment'

type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } }

// Enregistre le téléphone de la personne connectée
export async function saveSubscription(sub: BrowserSubscription) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: 'endpoint' })
  return { error: error?.message ?? null }
}

// Retire ce téléphone (notifications désactivées)
export async function removeSubscription(endpoint: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return { error: error?.message ?? null }
}

// Nouvelle commande envoyée par le client : prévient les bons vendeurs (choisis par la base, sql/19).
// Appelée par le formulaire de commande juste après l'envoi. Ne bloque jamais la commande :
// si la notification échoue, la commande est quand même passée (et visible dans la file).
export async function notifyNewOrder(orderId: string) {
  const supabase = await createSupabaseServer()

  const { data: order } = await supabase
    .from('orders')
    .select('order_number, grossiste_id, fulfillment, profiles ( display_name ), order_lines ( rayon_id )')
    .eq('id', orderId)
    .single()
  if (!order) return { sent: 0 }

  const [{ data: targets }, { data: rayons }] = await Promise.all([
    supabase.rpc('push_targets_new_order', { p_order_id: orderId }),
    supabase.from('rayons').select('id, name, position').eq('grossiste_id', order.grossiste_id),
  ])
  if (!targets?.length) return { sent: 0 }

  // « 🐂 Bœuf (3) · 🐑 Agneau (2) », ou « 5 produits » pour un grossiste sans rayon
  const lines = order.order_lines as { rayon_id: string | null }[]
  const parts = (rayons ?? [])
    .sort((a, b) => a.position - b.position)
    .map(r => ({ r, n: lines.filter(l => l.rayon_id === r.id).length }))
    .filter(x => x.n > 0)
    .map(x => `${rayonStyle(x.r).icon} ${x.r.name} (${x.n})`)
  const unsorted = lines.filter(l => !l.rayon_id || !(rayons ?? []).some(r => r.id === l.rayon_id)).length
  if (parts.length > 0 && unsorted > 0) parts.push(`❓ À répartir (${unsorted})`)
  const detail = parts.length > 0 ? parts.join(' · ') : `${lines.length} produit${lines.length > 1 ? 's' : ''}`

  const client = customerName(order.profiles) ?? 'Un client'
  const { sent } = await sendPush(targets, {
    title: `Nouvelle commande n° ${order.order_number}`,
    body: `${client}\n${detail} · ${fulfillmentOf(order.fulfillment).icon} ${fulfillmentOf(order.fulfillment).label}`,
    url: `/grossiste/${order.grossiste_id}`,
    tag: `commande-${orderId}`,
  })
  return { sent }
}

// Envoie une notification de test à tous MES téléphones (la RLS ne renvoie que les miens)
export async function sendTestNotification() {
  const supabase = await createSupabaseServer()
  const { data: subs, error } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth')
  if (error) return { error: error.message, sent: 0 }
  if (!subs?.length) return { error: 'Aucun téléphone enregistré : active d’abord les notifications.', sent: 0 }

  const { sent, expired } = await sendPush(subs, {
    title: 'Le Carreau des Halles',
    body: '🔔 Test réussi : ce téléphone recevra les nouvelles commandes.',
    url: '/',
    tag: 'test',
  })
  if (expired.length) await supabase.from('push_subscriptions').delete().in('id', expired)
  return { error: null, sent }
}
