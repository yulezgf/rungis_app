import type { MetadataRoute } from 'next'

// Rend l'app « installable » : ajoutée à l'écran d'accueil, elle s'ouvre comme une vraie app
// (indispensable sur iPhone pour recevoir les notifications).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Le Carreau des Halles',
    short_name: 'Carreau',
    description: 'Commandes aux grossistes de Rungis, suivies en direct',
    start_url: '/',
    display: 'standalone',
    background_color: '#1c1917',
    theme_color: '#1c1917',
    lang: 'fr',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
