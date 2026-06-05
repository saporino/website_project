import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VitePWA desativado: o service worker causava versao em cache quebrada
// (ex.: import de CSV/XLSX parava de funcionar) e tela branca no F5.
// Reativar SO quando for fazer o app instalavel/APK, com teste no device.
// import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // VitePWA removido — reativar com cuidado no futuro (ver comentario acima)
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
