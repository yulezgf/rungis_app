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
    <div className="border rounded p-4 space-y-2 bg-amber-50 border-amber-200">
      <p className="font-medium">{customerName(account.profiles) ?? 'Client'}</p>
      <p className="text-xs text-gray-500">Demande du {dateFr(account.requested_at)}</p>
      {account.existing_number && (
        <p className="text-sm">Déclare avoir déjà un compte : n° {account.existing_number}</p>
      )}
      <input
        value={number}
        onChange={e => setNumber(e.target.value)}
        placeholder="Numéro client (facultatif)"
        className="block w-full border rounded px-2 py-1"
      />
      <div className="flex gap-2">
        <button onClick={() => onDecide('accepté', number.trim() || null)} className="flex-1 bg-black text-white rounded py-2">
          Accepter
        </button>
        <button onClick={() => onDecide('refusé', null)} className="flex-1 border rounded py-2">
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
        <h2 className="font-semibold">En attente ({pending.length})</h2>
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
        <h2 className="font-semibold">Clients acceptés ({accepted.length})</h2>
        {accepted.map(a => (
          <div key={a.customer_id} className="border rounded p-3 flex justify-between">
            <span>{customerName(a.profiles) ?? 'Client'}</span>
            <span className="text-sm text-gray-500">{a.account_number ? `n° ${a.account_number}` : ''}</span>
          </div>
        ))}
      </section>

      {refused.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Refusées ({refused.length})</h2>
          {refused.map(a => (
            <div key={a.customer_id} className="border rounded p-3 flex justify-between items-center">
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
