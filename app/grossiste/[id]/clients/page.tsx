import { notFound, redirect } from 'next/navigation'
import { requireProfile, teamHome } from '@/lib/supabase-server'
import AccountRequests from '@/components/AccountRequests'
import TeamHeader from '@/components/TeamHeader'

// Clients et demandes d'ouverture de compte d'un grossiste (réservé à son équipe)
export default async function ClientsPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profile } = await requireProfile()
  const { id } = await params
  if (profile.role !== 'grossiste') redirect('/')
  if (profile.grossiste_id !== id) redirect(teamHome(profile))

  const [{ data: grossiste }, { data: accounts, error }] = await Promise.all([
    supabase.from('grossistes').select('name').eq('id', id).single(),
    supabase
      .from('customer_accounts')
      .select('customer_id, status, existing_number, account_number, requested_at, profiles ( display_name )')
      .eq('grossiste_id', id)
      .order('requested_at', { ascending: false }),
  ])
  if (!grossiste) notFound()

  const pendingCount = (accounts ?? []).filter(a => a.status === 'en attente').length

  return (
    <div className="min-h-screen bg-stone-100">
      <TeamHeader
        grossisteId={id}
        grossisteName={grossiste.name}
        preparateur={profile.display_name}
        pendingCount={pendingCount}
        active="clients"
      />
      <main className="max-w-3xl mx-auto px-4 py-4">
        {error ? (
          <p className="text-red-600">Erreur : {error.message}</p>
        ) : (
          <AccountRequests accounts={accounts ?? []} grossisteId={id} />
        )}
      </main>
    </div>
  )
}
