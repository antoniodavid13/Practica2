/* Service worker: red primero y, sin conexión, lo último guardado.
   Así siempre se ve la versión publicada más reciente y la práctica funciona offline tras la primera visita. */
const CACHE = 'p2-corriente-continua-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  // Vídeo y audio se piden por trozos (Range): eso lo gestiona el navegador directamente, sin caché
  if (req.headers.has('range') || req.destination === 'video' || req.destination === 'audio') return
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./') : undefined)))
  )
})
