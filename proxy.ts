import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// S'exécute avant chaque page : rafraîchit la session Supabase si elle a expiré
// et remet les cookies à jour, pour que les pages serveur voient la bonne personne.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          // Empêche qu'une réponse contenant une session soit mise en cache et servie à quelqu'un d'autre
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    }
  )

  // Vérifie la session auprès de Supabase (et la rafraîchit si besoin)
  const { data } = await supabase.auth.getUser()

  // Pas connecté : toutes les pages renvoient vers /connexion (sauf /connexion elle-même).
  // Les droits selon le rôle (client / équipe) sont vérifiés dans chaque page (requireProfile).
  if (!data.user && !request.nextUrl.pathname.startsWith('/connexion')) {
    const url = request.nextUrl.clone()
    url.pathname = '/connexion'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Toutes les pages, sauf les fichiers statiques et les images
  // (sw.js et manifest.webmanifest aussi : le téléphone doit pouvoir les charger pour les notifications ;
  //  api/push : appelée par Supabase, sans session, protégée par son propre mot de passe)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|api/push|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
