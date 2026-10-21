// Envoi des notifications web (CÔTÉ SERVEUR UNIQUEMENT : utilise la clé privée VAPID).
// Ne jamais importer ce fichier dans un composant 'use client'.
import webpush from 'web-push'

let configured = false
function configure() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'https://rungis-app.vercel.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  configured = true
}

export type StoredSubscription = { id: string; endpoint: string; p256dh: string; auth: string }
export type PushPayload = { title: string; body: string; url?: string; tag?: string }

// Envoie à une liste de téléphones. Renvoie les ids des abonnements expirés
// (téléphone désinstallé, permission retirée…) pour qu'on les supprime.
export async function sendPush(subscriptions: StoredSubscription[], payload: PushPayload) {
  configure()
  const expired: string[] = []
  let sent = 0
  await Promise.all(
    subscriptions.map(async s => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: 60 * 60, // si le téléphone est éteint, on garde la notification une heure
          urgency: 'high',
        })
        sent++
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) expired.push(s.id)
        else console.error('Notification non envoyée', status, error)
      }
    })
  )
  return { sent, expired }
}
