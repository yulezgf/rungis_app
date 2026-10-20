'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Un navigateur ne garde qu'UNE session pour tous ses onglets. Si quelqu'un se connecte
// avec un autre compte dans un autre onglet, les pages déjà ouvertes affichent encore
// l'ancien nom : on les recharge pour qu'elles montrent le bon compte.
// (Pas sur /connexion, qui gère elle-même la connexion et la redirection.)
export default function SessionWatcher() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname.startsWith('/connexion')) return
    let initialUserId: string | null | undefined // undefined = pas encore connu
    supabase.auth.getSession().then(({ data }) => {
      initialUserId = data.session?.user.id ?? null
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null
      if (initialUserId !== undefined && userId !== initialUserId) window.location.reload()
    })
    return () => data.subscription.unsubscribe()
  }, [pathname])

  return null
}
