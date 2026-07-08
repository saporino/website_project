import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // REVERTIDO (08/07/2026): a reativacao (selfDestroying:false) causou tela
      // "carregando" travada no celular de um rep (SW servindo bundle velho/quebrado).
      // selfDestroying:true instala um SW que se AUTODESTROI e limpa o cache em TODOS
      // os aparelhos (inclusive os que pegaram a versao quebrada) -> portal volta a
      // funcionar como site normal. Reativar o app so na fase dedicada, testando o SW
      // com cuidado (staging/1 aparelho) antes de subir pra todos os reps.
      selfDestroying: true,
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
