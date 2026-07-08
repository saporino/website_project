import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // REATIVADO (23/06/2026) para a fase do app dos representantes: instalavel
      // via "Adicionar a tela inicial" e, depois, Google Play via PWABuilder.
      // As travas anti-tela-branca ja estao no workbox abaixo (navigateFallback +
      // skipWaiting + clientsClaim + cleanupOutdatedCaches). Se voltar a dar
      // cache teimoso/tela branca, reverter para selfDestroying: true e redeploy.
      selfDestroying: false,
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'RepCo — Café Saporino',
        short_name: 'RepCo',
        description: 'Portal do Representante Comercial — Café Saporino',
        theme_color: '#8B2214',
        background_color: '#f8f7f5',
        display: 'standalone',
        start_url: '/repco',
        scope: '/',
        // Icones com fundo TRANSPARENTE (logo Saporino). Sem 'maskable' de proposito:
        // maskable + transparente = o Android/Samsung enche o quadrado de PRETO no splash.
        // Como 'any', o logo aparece sobre o background_color claro (sem quadrado preto).
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        // navigateFallback garante que F5 em /admin /repco /rastrear nao da tela branca.
        navigateFallback: '/index.html',
        // Nao interceptar arquivos estaticos nem assets — so navegacao SPA.
        navigateFallbackDenylist: [/^\/assets\//, /^\/icons\//, /\.[a-z0-9]+$/i],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  optimizeDeps: {
    include: ['leaflet'],
    exclude: ['lucide-react'],
  },
  resolve: {
    dedupe: ['leaflet'],
  },
  server: { watch: { usePolling: false } },
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'leaflet-vendor': ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
});
