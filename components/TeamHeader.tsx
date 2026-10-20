import Link from 'next/link'

// En-tête de l'espace grossiste (file d'attente, clients) : identité, navigation, compte.
export default function TeamHeader({
  grossisteId,
  grossisteName,
  preparateur,
  pendingCount,
  active,
}: {
  grossisteId: string
  grossisteName: string
  preparateur: string
  pendingCount: number
  active: 'file' | 'clients'
}) {
  const tab = (isActive: boolean) =>
    `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-white text-stone-900' : 'text-stone-300 hover:text-white'}`

  return (
    <header className="bg-stone-900 text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-stone-400">Le Carreau des Halles</p>
          <p className="text-lg font-semibold truncate">{grossisteName}</p>
        </div>
        <Link href="/connexion" className="text-right text-sm shrink-0">
          <span className="block text-stone-400 text-xs">Connecté</span>
          <span className="font-medium">{preparateur}</span>
        </Link>
      </div>
      <nav className="max-w-3xl mx-auto px-4 pb-3 flex gap-2">
        <Link href={`/grossiste/${grossisteId}`} className={tab(active === 'file')}>
          File d&apos;attente
        </Link>
        <Link href={`/grossiste/${grossisteId}/clients`} className={tab(active === 'clients')}>
          Clients
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-amber-400 text-stone-900 text-xs font-bold">
              {pendingCount}
            </span>
          )}
        </Link>
      </nav>
    </header>
  )
}
