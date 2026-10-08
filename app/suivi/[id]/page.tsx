'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Line = {
  id: string
  quantity: number
  status: string
  substituted_name: string | null
  products: { name: string }[]
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

  useEffect(() => {
    const fetchOrder = async () => {
      const { data: order } = await supabase
        .from('orders')
        .select('order_number')
        .eq('id', orderId)
        .single()
      if (order) setOrderNumber(order.order_number)

      const { data: orderLines } = await supabase
        .from('order_lines')
        .select('id, quantity, status, substituted_name, products ( name )')
        .eq('order_id', orderId)
      if (orderLines) setLines(orderLines as unknown as Line[])
    }
    fetchOrder()

    const channel = supabase
      .channel('order_lines_changes')
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Commande #{orderNumber}</h1>
      <div className="space-y-2">
        {lines.map(line => (
          <div key={line.id} className="border-b pb-2">
            <div className="flex justify-between items-center">
              <span>{line.products?.[0]?.name} ×{line.quantity}</span>
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