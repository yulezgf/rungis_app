// « Facteur » (service worker) : tourne en arrière-plan sur le téléphone, même app fermée.
// Il reçoit les notifications envoyées par notre serveur et les affiche ;
// un toucher sur la notification ouvre la bonne page (la file du grossiste).

self.addEventListener('push', event => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'Le Carreau des Halles', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag, // même tag = la nouvelle notification remplace l'ancienne (évite l'avalanche)
      renotify: true,
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      // L'app est déjà ouverte : on la ramène devant et on va sur la page
      for (const w of windows) {
        if ('focus' in w) {
          w.navigate(url)
          return w.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
