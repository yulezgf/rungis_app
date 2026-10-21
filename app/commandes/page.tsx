import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireProfile, teamHome } from '@/lib/supabase-server'
import { productName } from '@/lib/productName'
import { orderStatus, linePreparers } from '@/lib/orderStatus'
import { fulfillmentOf } from '@/lib/fulfillment'

// « Mes commandes » : toutes les commandes du client connecté, de la plus récente à la plus ancienne.
// Pas besoin de filtrer par client : la RLS (sql/05) ne renvoie que SES commandes.
export default async function MesCommandesPage() {
  const { supabase, profile } = await requireProfile()
  if (profile.role === 'grossiste') redirect(teamHome(profile))

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, created_at, assigned_to, fulfillment, grossistes ( name ), order_lines ( status, assigned_to )')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return <p className="p-8 text-red-500">Erreur : {error.message}</p>

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mes commandes</h1>

      {orders.length === 0 && <p className="text-gray-500">Aucune commande pour l&apos;instant.</p>}

      <div className="space-y-2">
        {orders.map(order => {
          // Prise en charge par rayon (Eurodis…) ou de toute la commande (grossiste sans rayon)
          const status = orderStatus(order.order_lines, linePreparers(order.order_lines) ?? order.assigned_to)
          return (
            <Link key={order.id} href={`/suivi/${order.id}`} className="block border rounded p-4">
              <div className="flex justify-between items-center gap-2">
                <span className="font-medium">
                  #{order.order_number} · {productName(order.grossistes)}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${status.color}`}>{status.label}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {/* Heure de Paris : le serveur Vercel, lui, est à l'heure UTC */}
                {new Date(order.created_at).toLocaleString('fr-FR', {
                  timeZone: 'Europe/Paris',
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' · '}
                {fulfillmentOf(order.fulfillment).icon} {fulfillmentOf(order.fulfillment).label}
              </p>
              {status.note && <p className="text-xs text-red-600 mt-1">{status.note}</p>}
            </Link>
          )
        })}
      </div>

      <Link href="/" className="block mt-6 text-sm underline text-gray-500">
        Passer une nouvelle commande
      </Link>
    </main>
  )
}
