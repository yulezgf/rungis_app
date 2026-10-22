'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { saveSubscription, removeSubscription, sendTestNotification } from '@/app/actions/push'
import { useFlash, FlashBar } from '@/components/Flash'

// La clé publique VAPID doit être transformée en octets pour le navigateur
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

// Ce que permet ce téléphone (calculé seulement dans le navigateur)
type Support = 'unknown' | 'ok' | 'install-ios' | 'unsupported'
function detectSupport(): Support {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok'
  if (isIos && !installed) return 'install-ios' // sur iPhone, il faut d'abord ajouter l'app à l'écran d'accueil
  return 'unsupported'
}
const noSubscribe = () => () => {}

// Notifications de CE téléphone + « Je suis de service ».
// (Les rayons du vendeur se règlent avec les pastilles « Mes rayons » en haut de la file.)
export default function NotificationPanel({ userId, initialOnDuty }: { userId: string; initialOnDuty: boolean }) {
  const support = useSyncExternalStore(noSubscribe, detectSupport, () => 'unknown' as Support)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [onDuty, setOnDuty] = useState(initialOnDuty)
  const [busy, setBusy] = useState(false)
  const { flash, show, hide } = useFlash()

  // Enregistre le « facteur » (public/sw.js) et regarde si ce téléphone est déjà abonné
  useEffect(() => {
    if (support !== 'ok') return
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setSubscription(sub))
      .catch(() => {})
  }, [support])

  const enable = async () => {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        show('Notifications refusées : autorise-les dans les réglages du navigateur.', { tone: 'error' })
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      const { error } = await saveSubscription(JSON.parse(JSON.stringify(sub)))
      if (error) {
        show(error, { tone: 'error' })
        return
      }
      setSubscription(sub)
      show('Notifications activées sur ce téléphone.', { undoLabel: 'Désactiver', onUndo: () => disable(sub) })
    } catch (e) {
      show('Impossible d’activer les notifications : ' + (e as Error).message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const disable = async (sub = subscription) => {
    if (!sub) return
    setBusy(true)
    await removeSubscription(sub.endpoint)
    await sub.unsubscribe().catch(() => {})
    setSubscription(null)
    setBusy(false)
    show('Notifications désactivées sur ce téléphone.', { undoLabel: 'Réactiver', onUndo: enable })
  }

  const test = async () => {
    setBusy(true)
    const { error, sent } = await sendTestNotification()
    setBusy(false)
    if (error) show(error, { tone: 'error' })
    else show(`Notification de test envoyée à ${sent} téléphone${sent > 1 ? 's' : ''}. Elle arrive dans quelques secondes.`)
  }

  // Réglage du profil « de service » : la base vérifie qu'on ne touche qu'à SON profil
  const saveProfile = async (patch: { on_duty: boolean }) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    if (error) {
      show(error.message, { tone: 'error' })
      return false
    }
    return true
  }

  const toggleDuty = async () => {
    const next = !onDuty
    if (!(await saveProfile({ on_duty: next }))) return
    setOnDuty(next)
    show(next ? 'Tu es de service : tu seras prévenu des nouvelles commandes.' : 'Tu n’es plus de service : plus de notifications.', {
      onUndo: async () => {
        if (await saveProfile({ on_duty: !next })) setOnDuty(!next)
      },
    })
  }

  return (
    <details className="bg-white rounded-xl border border-stone-200">
      <summary className="px-4 py-3 cursor-pointer font-medium text-stone-800 flex items-center justify-between">
        <span>🔔 Notifications</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${subscription && onDuty ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-600'}`}>
          {subscription ? (onDuty ? 'actives' : 'pas de service') : 'désactivées'}
        </span>
      </summary>

      <div className="px-4 pb-4 space-y-4 text-sm">
        {/* 1. Ce téléphone */}
        {support === 'install-ios' && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            Sur iPhone, ajoute d&apos;abord l&apos;app à l&apos;écran d&apos;accueil : bouton <b>Partager</b> ⬆️ puis{' '}
            <b>« Sur l&apos;écran d&apos;accueil »</b>. Ouvre-la ensuite depuis son icône, et reviens ici.
          </p>
        )}
        {support === 'unsupported' && <p className="text-stone-600">Ce navigateur ne permet pas les notifications.</p>}
        {support === 'ok' && (
          <div className="flex flex-wrap gap-2">
            {subscription ? (
              <>
                <button disabled={busy} onClick={test} className="bg-stone-900 text-white rounded-md px-3 py-2 disabled:opacity-50">
                  M&apos;envoyer une notification de test
                </button>
                <button disabled={busy} onClick={() => disable()} className="border border-stone-300 rounded-md px-3 py-2 disabled:opacity-50">
                  Désactiver sur ce téléphone
                </button>
              </>
            ) : (
              <button disabled={busy} onClick={enable} className="bg-red-800 text-white rounded-md px-3 py-2 font-medium disabled:opacity-50">
                Activer les notifications sur ce téléphone
              </button>
            )}
          </div>
        )}

        {/* 2. De service */}
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="font-medium">Je suis de service</span>
            <span className="block text-xs text-stone-500">Hors service : aucune notification, sauf alerte d&apos;équipe.</span>
          </span>
          <input type="checkbox" checked={onDuty} onChange={toggleDuty} className="w-5 h-5 accent-red-800" />
        </label>

      </div>
      <FlashBar flash={flash} onClose={hide} />
    </details>
  )
}
