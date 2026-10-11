'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// Connexion par lien magique : on tape son email, Supabase envoie un lien,
// le clic ramène ici et la session est enregistrée dans le navigateur.
export default function ConnexionPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Session déjà ouverte ? (ou en train d'arriver par le lien de l'email)
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null)
      setLoading(false)
    })
    // Prévenu à chaque connexion / déconnexion
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const sendLink = async () => {
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + '/connexion' },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setSent(false)
  }

  if (loading) return <main className="p-8 max-w-md mx-auto text-gray-500">Chargement…</main>

  return (
    <main className="p-8 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Connexion</h1>

      {userEmail ? (
        <>
          <p>
            Connecté en tant que <span className="font-medium">{userEmail}</span>
          </p>
          <button onClick={logout} className="w-full border rounded py-2">
            Se déconnecter
          </button>
        </>
      ) : sent ? (
        <p className="text-green-600">
          Lien envoyé à {email.trim()}. Ouvre ton email et clique sur le lien pour te connecter.
        </p>
      ) : (
        <form
          onSubmit={e => {
            e.preventDefault()
            sendLink()
          }}
          className="space-y-2"
        >
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="ton@email.fr"
            className="block w-full border rounded px-2 py-2"
          />
          <button className="w-full bg-black text-white rounded py-2">Recevoir mon lien de connexion</button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}

      <Link href="/" className="block text-sm underline">
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}
