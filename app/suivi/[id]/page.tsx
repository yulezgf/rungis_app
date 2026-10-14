'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { productName, lineName, lineUnit, formatQty } from '@/lib/productName'
import { orderStatus } from '@/lib/orderStatus'

type Line = {
  id: string
  quantity: number
  status: string
  substituted_name: string | null
  products: unknown
  custom_name: string | null
  custom_unit: string | null
}

const STATUS_COLORS: Record<string, string> = {
  'à préparer': 'bg-gray-100 text-gray-600',
  'en cours': 'bg-blue-100 text-blue-700',
  'prêt': 'bg-green-100 text-green-700',
  'rupture': 'bg-red-100 text-red-700',
  'substitué': 'bg-amber-100 text-amber-700',
}

export default function SuiviPage() {
  const params = useParams()
  const orderId = params.id as string
  const [lines, setLines] = useState<Line[]>([])
  const [orderNumber, setOrderNumber] = useState<number | null>(null)
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  const [grossisteName, setGrossisteName] = useState('')

  useEffect(() => {
    const fetchOrder = async () => {
      const { data: order } = await supabase
        .from('orders')
        .select('order_number, assigned_to, grossistes ( name )')
        .eq('id', orderId)
        .single()
      if (order) {
        setOrderNumber(order.order_number)
        setAssignedTo(order.assigned_to)
        // même forme { name } que la relation products : le helper marche aussi
        setGrossisteName(productName(order.grossistes))
      }

      const { data: orderLines } = await supabase
        .from('order_lines')
        .select('id, quantity, status, substituted_name, custom_name, custom_unit, products ( name, unit )')
        .eq('order_id', orderId)
      if (orderLines) setLines(orderLines as unknown as Line[])
    }
    fetchOrder()

    const channel = supabase
      .channel('suivi_' + orderId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'order_lines', filter: `order_id=eq.${orderId}` },
        payload => {
          setLines(prev =>
            prev.map(line =>
              line.id === payload.new.id
                ? { ...line, status: payload.new.status, substituted_name: payload.new.substituted_name }
                : line
            )
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        payload => {
          setAssignedTo(payload.new.assigned_to)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  const status = orderStatus(lines, assignedTo)

  return (
    <main className="p-8 max-w-md mx-auto">
      <Link href="/commandes" className="block text-sm underline text-gray-500 mb-2">
        ← Mes commandes
      </Link>
      <h1 className="text-2xl font-bold">Commande #{orderNumber}</h1>
      {grossisteName && <p className="text-gray-600">Votre commande chez {grossisteName}</p>}
      <div className="mt-1 mb-4">
        {lines.length > 0 && <span className={`text-sm px-2 py-1 rounded ${status.color}`}>{status.label}</span>}
        {status.note && <p className="text-sm text-red-600 mt-1">{status.note}</p>}
      </div>
      <div className="space-y-2">
        {lines.map(line => (
          <div key={line.id} className="border-b pb-2">
            <div className="flex justify-between items-center">
              <span>
                {lineName(line)}{' '}
                <span className="text-gray-500">— {formatQty(line.quantity, lineUnit(line))}</span>
              </span>
              <span className={`text-sm px-2 py-1 rounded ${STATUS_COLORS[line.status] ?? ''}`}>
                {line.status}
              </span>
            </div>
            {line.substituted_name && (
              <p className="text-xs text-gray-500 mt-1">Remplacé par {line.substituted_name}</p>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}