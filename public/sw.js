/* Service worker : permet d'installer l'application sur le téléphone (PWA).
   Il essaie toujours le réseau d'abord ; s'il n'y a pas de connexion, il
   affiche la dernière version gardée en cache. */
// Service worker minimal : permet l'installation sur téléphone (PWA). Réseau d'abord, cache en secours pour l'interface.
const CACHE = 'forestier-v1';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/')))
  );
});
