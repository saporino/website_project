import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// PWA (app instalável) DESLIGADO — sem service worker nem manifest.
// Motivo: o service worker causava tela travada / cache teimoso, e a instalação ficava
// presa no splash (logo Saporino). Sem manifest, "Adicionar à tela inicial" vira um
// ATALHO simples que abre /repco no navegador (sempre atualizado, sem travar, sem
// precisar desinstalar a cada mudança). A limpeza de service workers antigos é feita
// por um script no index.html. REATIVAR só na fase dedicada do app, com autoUpdate
// testado em 1 aparelho antes de liberar pros reps. Ver CLAUDE.md §8/§11.

// Staging (`vite --mode staging`, lê `.env.staging`): a página sai do servidor já
// marcada como não indexável e com uma faixa visível, para ninguém confundir o
// ambiente de testes com o site de verdade. Em produção nada disto existe.
function ambienteDeStaging(mode: string): Plugin {
  return {
    name: 'coffeelivre-ambiente-staging',
    transformIndexHtml(html) {
      if (mode !== 'staging') return html;
      return html
        .replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow" />')
        .replace(
          '<body>',
          '<body>\n    <div data-ambiente="staging" style="position:fixed;left:0;bottom:0;z-index:2147483647;' +
            'background:#6b21a8;color:#fff;font:600 11px/1 system-ui,sans-serif;padding:5px 8px;' +
            'letter-spacing:.06em;pointer-events:none;border-top-right-radius:6px">STAGING · dados de teste</div>',
        );
    },
    configureServer(server) {
      if (mode !== 'staging') return;
      server.middlewares.use((_req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); next(); });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ambienteDeStaging(mode),
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
}));
