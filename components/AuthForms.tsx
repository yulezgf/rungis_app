'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'signup' | 'forgot' | 'link'

// Les messages de Supabase sont en anglais : on traduit les plus courants
function frMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email ou mot de passe incorrect.'
  if (/email not confirmed/i.test(message))
    return "Ton email n'est pas encore confirmé : clique sur le lien reçu à l'inscription (regarde aussi dans les spams)."
  if (/rate limit|too many/i.test(message)) return 'Trop de tentatives : patiente quelques minutes.'
  if (/password should be at least/i.test(message)) return 'Le mot de passe doit faire au moins 8 caractères.'
  return message
}

const MIN_PASSWORD = 8

// Formulaires de connexion : email + mot de passe (le parcours normal),
// création de compte, mot de passe oublié, et lien par email en secours.
// onSignedIn : prévient la page qu'on vient de se connecter (pour rediriger au bon endroit).
export default function AuthForms({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const switchTo = (m: Mode) => {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  const submit = async () => {
    setError(null)
    setInfo(null)
    const cleanEmail = email.trim()
    const origin = window.location.origin
    setBusy(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      setBusy(false)
      if (error) return setError(frMessage(error.message))
      return onSignedIn()
    }

    if (mode === 'signup') {
      if (password.length < MIN_PASSWORD) {
        setBusy(false)
        return setError(`Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`)
      }
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { emailRedirectTo: origin + '/connexion' },
      })
      setBusy(false)
      if (error) return setError(frMessage(error.message))
      // Si la confirmation d'email est désactivée dans Supabase, on est connecté tout de suite
      if (data.session) return onSignedIn()
      // Supabase ne dit pas (par sécurité) si l'email existe déjà : il renvoie alors un compte sans identité
      if (data.user && data.user.identities?.length === 0)
        return setError('Un compte existe déjà avec cet email : connecte-toi, ou utilise « Mot de passe oublié ».')
      return setInfo(
        `Compte créé ! Un email de confirmation a été envoyé à ${cleanEmail}. Clique sur le lien (une seule fois), puis connecte-toi.`
      )
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: origin + '/connexion/nouveau-mot-de-passe',
      })
      setBusy(false)
      if (error) return setError(frMessage(error.message))
      return setInfo(`Si un compte existe pour ${cleanEmail}, un email vient de partir pour choisir un nouveau mot de passe.`)
    }

    // mode === 'link' : l'ancien lien de connexion par email, gardé en secours
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { emailRedirectTo: origin + '/connexion', shouldCreateUser: false },
    })
    setBusy(false)
    if (error) return setError(frMessage(error.message))
    setInfo(`Lien envoyé à ${cleanEmail}. Ouvre-le dans ce même navigateur.`)
  }

  const titles: Record<Mode, string> = {
    login: 'Se connecter',
    signup: 'Créer un compte',
    forgot: 'Mot de passe oublié',
    link: 'Recevoir un lien de connexion',
  }
  const needsPassword = mode === 'login' || mode === 'signup'

  return (
    <div className="space-y-4">
      {/* Les deux parcours principaux */}
      {(mode === 'login' || mode === 'signup') && (
        <div className="grid grid-cols-2 border rounded overflow-hidden">
          {(['login', 'signup'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchTo(m)}
              className={`py-2 ${mode === m ? 'bg-black text-white' : 'bg-white'}`}
            >
              {titles[m]}
            </button>
          ))}
        </div>
      )}
      {(mode === 'forgot' || mode === 'link') && <h2 className="text-lg font-semibold">{titles[mode]}</h2>}

      <form
        onSubmit={e => {
          e.preventDefault()
          submit()
        }}
        className="space-y-3"
      >
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="ton@email.fr"
          className="block w-full border rounded px-3 py-2"
        />

        {needsPassword && (
          <div className="flex gap-2">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              // Permet au téléphone / navigateur de retenir et proposer le mot de passe
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'signup' ? MIN_PASSWORD : undefined}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? `Mot de passe (${MIN_PASSWORD} caractères minimum)` : 'Mot de passe'}
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
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-green-700">{info}</p>}

        <button disabled={busy} className="w-full bg-black text-white rounded py-2 disabled:opacity-50">
          {busy
            ? 'Un instant…'
            : mode === 'login'
              ? 'Se connecter'
              : mode === 'signup'
                ? 'Créer mon compte'
                : mode === 'forgot'
                  ? 'Recevoir un email'
                  : 'Recevoir le lien'}
        </button>
      </form>

      <div className="text-sm text-gray-600 space-y-1">
        {mode === 'login' && (
          <button type="button" onClick={() => switchTo('forgot')} className="block underline">
            Mot de passe oublié ?
          </button>
        )}
        {(mode === 'forgot' || mode === 'link') && (
          <button type="button" onClick={() => switchTo('login')} className="block underline">
            ← Retour à la connexion
          </button>
        )}
        {mode === 'login' && (
          <button type="button" onClick={() => switchTo('link')} className="block underline text-gray-400">
            Recevoir plutôt un lien de connexion par email
          </button>
        )}
      </div>
    </div>
  )
}
