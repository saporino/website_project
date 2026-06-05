/*
 * Service Worker AUTODESTRUTIVO.
 *
 * O PWA foi desativado (o service worker antigo, gerado pelo Workbox, estava
 * servindo uma versao em cache quebrada -> ex.: o import de CSV/XLSX parava de
 * funcionar). Este arquivo SUBSTITUI o SW antigo: ele nao faz cache de nada,
 * se desregistra, limpa todos os caches e recarrega as abas para servir a
 * versao nova SEM service worker. Depois disso o navegador fica limpo.
 *
 * NAO remover este arquivo tao cedo: ele e o que "mata" o SW antigo nos
 * navegadores que ja o instalaram.
 */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    (async function () {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      } catch (e) { /* ignore */ }
      try {
        await self.registration.unregister();
      } catch (e) { /* ignore */ }
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(function (client) {
        try { client.navigate(client.url); } catch (e) { /* ignore */ }
      });
    })()
  );
});

// Sem fetch handler: nada e interceptado/cacheado.
