import { useEffect, useState } from 'react';

const KEY = 'cofico-cookie-consent';

// Aviso de cookies PRÓPRIO da COFICO (site institucional — sem carrinho/login).
// Estilo cofico-red; links via hash (#privacidade), sem sair do domínio COFICO.
// Some após aceitar (localStorage). Chave separada da Saporino.
export default function CoficoCookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setShow(true); } catch { /* localStorage indisponível */ }
  }, []);

  const accept = () => {
    try { localStorage.setItem(KEY, 'accepted'); } catch { /* ok */ }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1200] p-3 sm:p-4">
      <div className="mx-auto max-w-5xl bg-white border border-neutral-200 rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="flex-1 text-sm text-neutral-700 leading-relaxed">
          Usamos cookies essenciais e de medição para melhorar sua experiência neste site.
          Ao continuar navegando, você concorda com a nossa{' '}
          <a href="#privacidade" className="text-cofico-ink font-semibold underline">Política de Privacidade</a>.
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          <a href="#privacidade" className="text-sm font-semibold text-neutral-600 hover:text-neutral-900">Saber mais</a>
          <button onClick={accept} className="bg-cofico-ink hover:bg-cofico-dark text-white font-semibold px-6 py-2.5 rounded-full transition-colors shadow">
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
