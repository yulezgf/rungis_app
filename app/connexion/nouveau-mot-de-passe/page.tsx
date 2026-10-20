'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const MIN_PASSWORD = 8

// On arrive ici par le lien de l'email « Mot de passe oublié » (?code=...).
// Le client Supabase échange ce code contre une session (même navigateur requis),
// puis on enregistre le nouveau mot de passe.
// Sert aussi aux comptes créés par lien, qui n'ont pas encore de mot de passe.
export default function NouveauMotDePassePage() {
  const router = useRouter()
  const [ready, setReady] = useState<boolean | null>(null) // null = on vérifie encore
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setReady(!!session))
    return () => data.subscription.unsubscribe()
  }, [])

  const save = async () => {
    setError(null)
    if (password.length < MIN_PASSWORD) return setError(`Au moins ${MIN_PASSWORD} caractères.`)
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.message)
    // L'accueil redirige l'équipe vers sa file, et /connexion demande le nom s'il manque
    router.replace('/')
  }

  if (ready === null) return <main className="p-8 max-w-md mx-auto text-gray-500">Chargement…</main>

  if (!ready)
    return (
      <main className="p-8 max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Lien expiré</h1>
        <p className="text-gray-600">
          Ce lien n&apos;est plus valable, ou il a été ouvert dans un autre navigateur que celui où tu l&apos;as
          demandé. Redemande un email depuis « Mot de passe oublié ».
        </p>
        <Link href="/connexion" className="block underline">
          Retour à la connexion
        </Link>
      </main>
    )

  return (
    <main className="p-8 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Choisis ton mot de passe</h1>
      <form
        onSubmit={e => {
          e.preventDefault()
          save()
        }}
        className="space-y-3"
      >
        <div className="flex gap-2">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={`Nouveau mot de passe (${MIN_PASSWORD} caractères minimum)`}
            className="flex-1 border rounded px-3 py-2"
          />
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            className="border rounded px-3 text-sm text-gray-600"
          >
            {showPassword ? 'Cacher' : 'Voir'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full bg-black text-white rounded py-2 disabled:opacity-50">
          {busy ? 'Un instant…' : 'Enregistrer'}
        </button>
      </form>
    </main>
  )
}
