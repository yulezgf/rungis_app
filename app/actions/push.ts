'use server'
// Server Actions des notifications : appelées depuis le navigateur, exécutées sur le serveur
// (au nom de la personne connectée : la RLS s'applique).
import { createSupabaseServer } from '@/lib/supabase-server'
import { sendPush } from '@/lib/push'

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
