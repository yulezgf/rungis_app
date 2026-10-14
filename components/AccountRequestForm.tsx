'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AccountRequestForm({ grossisteId, grossisteName }: { grossisteId: string; grossisteName: string }) {
  const router = useRouter()
  const [hasAccount, setHasAccount] = useState(false)
  const [number, setNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const submit = async () => {
    setError(null)
    if (hasAccount && !number.trim()) return setError('Indique ton numéro client.')
    setSending(true)
    // Le statut part automatiquement « en attente » (valeur par défaut en base)
    const { error } = await supabase.from('customer_accounts').insert({
      grossiste_id: grossisteId,
      existing_number: hasAccount ? number.trim() : null,
    })
    setSending(false)
    if (error) return setError(error.message)
    router.push('/')
    router.refresh()
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        submit()
      }}
      className="space-y-4"
    >
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={hasAccount} onChange={e => setHasAccount(e.target.checked)} className="mt-1" />
        <span>J&apos;ai déjà un compte chez {grossisteName}</span>
      </label>

      {hasAccount && (
        <input
          value={number}
          onChange={e => setNumber(e.target.value)}
          placeholder="Mon numéro client chez eux"
          className="block w-full border rounded px-3 py-2"
        />
      )}

      {/* Étape suivante : la fiche d'ouverture de compte et les documents (Kbis, pièce d'identité, RIB) */}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={sending} className="w-full bg-black text-white rounded py-2 disabled:opacity-50">
        {sending ? 'Envoi…' : 'Envoyer ma demande'}
      </button>
    </form>
  )
}
