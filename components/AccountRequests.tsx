'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { customerName } from '@/lib/productName'

type Account = {
  customer_id: string
  status: string
  existing_number: string | null
  account_number: string | null
  requested_at: string
  profiles: unknown // { display_name } : le client
}

const dateFr = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris', // même résultat sur le serveur (UTC) et dans le navigateur
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

// Une demande en attente : le grossiste saisit (ou confirme) le numéro client, puis accepte ou refuse
function PendingRequest({ account, onDecide }: { account: Account; onDecide: (status: string, number: string | null) => void }) {
  const [number, setNumber] = useState(account.existing_number ?? '')
  return (
    <div className="bg-white rounded-xl border-2 border-amber-300 shadow-sm p-4 space-y-2">
      <p className="text-lg font-semibold text-stone-900">{customerName(account.profiles) ?? 'Client'}</p>
      <p className="text-xs text-gray-500">Demande du {dateFr(account.requested_at)}</p>
      {account.existing_number && (
        <p className="text-sm">Déclare avoir déjà un compte : n° {account.existing_number}</p>
      )}
      <input
        value={number}
        onChange={e => setNumber(e.target.value)}
        placeholder="Numéro client (facultatif)"
        className="block w-full border border-stone-300 rounded-md px-3 py-2"
      />
      <div className="flex gap-2">
        <button onClick={() => onDecide('accepté', number.trim() || null)} className="flex-1 bg-red-800 hover:bg-red-900 text-white rounded-md py-2 font-medium">
          Accepter
        </button>
        <button onClick={() => onDecide('refusé', null)} className="flex-1 bg-white border border-stone-300 rounded-md py-2">
          Refuser
        </button>
      </div>
    </div>
  )
}

export default function AccountRequests({ accounts, grossisteId }: { accounts: Account[]; grossisteId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const decide = async (customerId: string, status: string, accountNumber: string | null) => {
    setError(null)
    const { error } = await supabase
      .from('customer_accounts')
      .update({ status, account_number: accountNumber, decided_at: new Date().toISOString() })
      .eq('customer_id', customerId)
      .eq('grossiste_id', grossisteId)
    if (error) return setError(error.message)
    router.refresh() // recharge la liste depuis le serveur
  }

  const pending = accounts.filter(a => a.status === 'en attente')
  const accepted = accounts.filter(a => a.status === 'accepté')
  const refused = accounts.filter(a => a.status === 'refusé')

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">En attente ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-gray-500">Aucune demande en attente.</p>}
        {pending.map(a => (
          <PendingRequest
            key={a.customer_id}
            account={a}
            onDecide={(status, number) => decide(a.customer_id, status, number)}
          />
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Clients acceptés ({accepted.length})</h2>
        {accepted.map(a => (
          <div key={a.customer_id} className="bg-white rounded-xl border border-stone-200 px-4 py-3 flex justify-between">
            <span>{customerName(a.profiles) ?? 'Client'}</span>
            <span className="text-sm text-gray-500">{a.account_number ? `n° ${a.account_number}` : ''}</span>
          </div>
        ))}
      </section>

      {refused.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Refusées ({refused.length})</h2>
          {refused.map(a => (
            <div key={a.customer_id} className="bg-white rounded-xl border border-stone-200 px-4 py-3 flex justify-between items-center">
              <span>{customerName(a.profiles) ?? 'Client'}</span>
              <button onClick={() => decide(a.customer_id, 'accepté', null)} className="text-sm underline">
                Accepter finalement
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
