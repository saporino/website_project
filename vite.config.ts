import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // DESLIGADO durante a fase de desenvolvimento: o service worker fazia
      // cache teimoso (F5 mostrava versao antiga; so atualizava ao fechar o
      // navegador). selfDestroying gera um SW que se desinstala sozinho e
      // limpa o cache em TODOS os navegadores que ja tinham a versao antiga
      // (inclusive os reps). REATIVAR (selfDestroying: false) so na fase do
      // app Google Play / PWABuilder. Ver CLAUDE.md sec.8 e sec.11.
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Café Saporino — RepCo',
        short_name: 'RepCo Saporino',
        description: 'Portal do Representante Comercial — Café Saporino',
        theme_color: '#8B2214',
        background_color: '#f8f7f5',
        display: 'standalone',
        start_url: '/repco',
        scope: '/',
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
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
