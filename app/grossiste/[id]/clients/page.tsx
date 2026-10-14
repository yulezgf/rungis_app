import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireProfile, teamHome } from '@/lib/supabase-server'
import AccountRequests from '@/components/AccountRequests'

// Clients et demandes d'ouverture de compte d'un grossiste (réservé à son équipe)
export default async function ClientsPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profile } = await requireProfile()
  const { id } = await params
  if (profile.role !== 'grossiste') redirect('/')
  if (profile.grossiste_id !== id) redirect(teamHome(profile))

  const { data: accounts, error } = await supabase
    .from('customer_accounts')
    .select('customer_id, status, existing_number, account_number, requested_at, profiles ( display_name )')
    .eq('grossiste_id', id)
    .order('requested_at', { ascending: false })

  if (error) return <p className="p-8 text-red-500">Erreur : {error.message}</p>

  return (
    <main className="p-8 max-w-md mx-auto">
      <Link href={teamHome(profile)} className="block text-sm underline text-gray-500 mb-2">
        ← File d&apos;attente
      </Link>
      <h1 className="text-2xl font-bold mb-4">Clients et demandes de compte</h1>
      <AccountRequests accounts={accounts ?? []} grossisteId={id} />
    </main>
  )
}
