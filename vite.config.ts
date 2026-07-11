import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PWA (app instalável) DESLIGADO — sem service worker nem manifest.
// Motivo: o service worker causava tela travada / cache teimoso, e a instalação ficava
// presa no splash (logo Saporino). Sem manifest, "Adicionar à tela inicial" vira um
// ATALHO simples que abre /repco no navegador (sempre atualizado, sem travar, sem
// precisar desinstalar a cada mudança). A limpeza de service workers antigos é feita
// por um script no index.html. REATIVAR só na fase dedicada do app, com autoUpdate
// testado em 1 aparelho antes de liberar pros reps. Ver CLAUDE.md §8/§11.

export default defineConfig({
  plugins: [
    react(),
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
