import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  console.error('Failed to initialize app:', error);
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; font-family: system-ui;">
      <div style="max-width: 600px; text-align: center;">
        <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #a4240e;">Erro ao carregar o site</h1>
        <p style="color: #666; margin-bottom: 1rem;">Por favor, recarregue a página ou entre em contato conosco.</p>
        <pre style="background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; text-align: left; overflow-x: auto;">${error}</pre>
      </div>
    </div>
  `;
}
