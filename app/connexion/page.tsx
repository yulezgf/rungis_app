'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AuthForms from '@/components/AuthForms'

type Profile = {
  role: 'client' | 'grossiste'
  display_name: string | null
  grossiste_id: string | null
  grossistes: unknown // { name } : le grossiste de rattachement, pour l'équipe
}

// Où envoyer la personne une fois connectée : l'équipe vers sa file, le client vers l'accueil
function homeFor(p: Profile): string {
  return p.role === 'grossiste' && p.grossiste_id ? `/grossiste/${p.grossiste_id}` : '/'
}

function grossisteName(g: unknown): string {
  if (Array.isArray(g)) return g[0]?.name ?? ''
  return (g as { name?: string } | null)?.name ?? ''
}

// Connexion (email + mot de passe, voir AuthForms), puis profil : nom de boutique / prénom, déconnexion.
// La session est enregistrée dans un cookie et dure des semaines.
export default function ConnexionPage() {
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [nameInput, setNameInput] = useState('')
  const router = useRouter()
  // Vrai quand on vient de se connecter (mot de passe, ou lien d'email ?code=...) : on redirige
  // alors vers le bon espace. Une simple visite de /connexion (« Mon compte ») ne redirige pas.
  const redirectAfterLogin = useRef(false)

  useEffect(() => {
    redirectAfterLogin.current = new URLSearchParams(window.location.search).has('code')
    // Session déjà ouverte ? (ou en train d'arriver par le lien de l'email)
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      setUser(u ? { id: u.id, email: u.email ?? '' } : null)
      setLoading(false)
    })
    // Prévenu à chaque connexion / déconnexion
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      setUser(u ? { id: u.id, email: u.email ?? '' } : null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Le profil est créé automatiquement par la base (rôle client) : on le lit une fois connecté
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    supabase
      .from('profiles')
      // « !grossiste_id » : le grossiste dont la personne fait partie (équipe),
      // pas ceux où elle a un compte client (customer_accounts, autre chemin possible)
      .select('role, display_name, grossiste_id, grossistes!grossiste_id ( name )')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (error) return setError('Profil introuvable : ' + error.message)
        const p = data as Profile
        setProfile(p)
        // Profil complet et connexion à l'instant : direction son espace.
        // Sinon (nom manquant), on reste ici pour le demander.
        if (redirectAfterLogin.current && p.display_name) router.replace(homeFor(p))
      })
  }, [userId, router])

  const saveName = async () => {
    const name = nameInput.trim()
    if (!name || !userId) return
    const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId)
    if (error) return setError(error.message)
    // Première connexion terminée : direction son espace
    if (profile) router.replace(homeFor(profile))
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  if (loading) return <main className="p-8 max-w-md mx-auto text-gray-500">Chargement…</main>

  const isTeam = profile?.role === 'grossiste'

  return (
    <main className="p-8 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">{user ? 'Mon compte' : 'Le Carreau des Halles'}</h1>

      {user ? (
        <>
          <p className="text-sm text-gray-500">Connecté avec {user.email}</p>

          {profile && !profile.display_name && (
            <form
              onSubmit={e => {
                e.preventDefault()
                saveName()
              }}
              className="space-y-2"
            >
              <label className="block font-medium">
                {isTeam ? 'Ton prénom (visible par les clients)' : 'Nom de ta boutique'}
              </label>
              <input
                required
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder={isTeam ? 'Ex : Ahmed' : 'Ex : Boucherie Martin'}
                className="block w-full border rounded px-2 py-2"
              />
              <button className="w-full bg-black text-white rounded py-2">Enregistrer</button>
            </form>
          )}

          {profile?.display_name && (
            <p>
              <span className="font-medium">{profile.display_name}</span>
              <span className="text-gray-500">
                {isTeam ? ` — équipe ${grossisteName(profile.grossistes)}` : ' — client'}
              </span>
            </p>
          )}

          <button onClick={logout} className="w-full border rounded py-2">
            Se déconnecter
          </button>
        </>
      ) : (
        <AuthForms onSignedIn={() => (redirectAfterLogin.current = true)} />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {profile?.display_name && (
        <Link href={homeFor(profile)} className="block text-sm underline">
          {profile.role === 'grossiste' ? 'Retour à ma file' : "Retour à l'accueil"}
        </Link>
      )}
    </main>
  )
}
