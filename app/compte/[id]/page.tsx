import { notFound, redirect } from 'next/navigation'
import { requireProfile, teamHome } from '@/lib/supabase-server'
import AccountRequestForm from '@/components/AccountRequestForm'

// Demande d'ouverture de compte chez un grossiste (côté client)
export default async function DemandeComptePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profile } = await requireProfile()
  if (profile.role === 'grossiste') redirect(teamHome(profile))
  const { id } = await params

  const [{ data: grossiste }, { data: account }] = await Promise.all([
    supabase.from('grossistes').select('name').eq('id', id).single(),
    supabase.from('customer_accounts').select('status').eq('grossiste_id', id).maybeSingle(),
  ])
  if (!grossiste) notFound()
  // Une demande existe déjà : l'accueil affiche où elle en est
  if (account) redirect('/')

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-2">Ouvrir un compte chez {grossiste.name}</h1>
      <p className="text-sm text-gray-600 mb-6">
        Un grossiste ne sert que les clients qui ont un compte chez lui. Ta demande lui est envoyée ; tu pourras
        commander dès qu&apos;il l&apos;aura acceptée.
      </p>
      <AccountRequestForm grossisteId={id} grossisteName={grossiste.name} />
    </main>
  )
}
