import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'Saporino RepCo',
        short_name: 'RepCo',
        description: 'Portal do Representante Comercial Saporino',
        theme_color: '#8B2214',
        background_color: '#f5f3ee',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/repco',
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
          },
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 500, maxAgeSeconds: 86400 } },
          },
        ],
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
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
});
