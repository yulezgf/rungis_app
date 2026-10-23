import { timingSafeEqual } from 'node:crypto'
import { sendPush, type StoredSubscription } from '@/lib/push'

// Appelée par Supabase (pg_cron + pg_net, sql/20) quand une commande attend depuis 30 min
// sans que personne n'ait cliqué « Je prends » : on prévient toute l'équipe du grossiste.
// Protégée par un mot de passe partagé (PUSH_WEBHOOK_SECRET), sinon n'importe qui pourrait
// envoyer de fausses alertes aux vendeurs.

type EscaladeBody = {
  subscriptions: StoredSubscription[]
  title: string
  body: string
  url?: string
  tag?: string
}

function secretOk(received: string | null) {
  const expected = process.env.PUSH_WEBHOOK_SECRET
  if (!expected || !received) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  // Comparaison à temps constant : ne laisse pas deviner le secret caractère par caractère
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!secretOk(request.headers.get('x-push-secret'))) {
    return Response.json({ error: 'non autorisé' }, { status: 401 })
  }

  const data = (await request.json()) as EscaladeBody
  if (!Array.isArray(data.subscriptions) || !data.title) {
    return Response.json({ error: 'requête invalide' }, { status: 400 })
  }

  const { sent, expired } = await sendPush(data.subscriptions, {
    title: data.title,
    body: data.body,
    url: data.url,
    tag: data.tag,
  })
  return Response.json({ sent, expired: expired.length })
}
