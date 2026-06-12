import { useEffect, useState } from 'react';

const KEY = 'saporino-cookie-consent';

// Banner de consentimento de cookies (rodape). Aceitar cobre cookies + privacidade.
// Layout e texto proprios da Saporino. Some apos aceitar (localStorage).
export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch { /* localStorage indisponivel */ }
  }, []);

  const accept = () => {
    try { localStorage.setItem(KEY, 'accepted'); } catch { /* ok */ }
    setShow(false);
  };

  const goTo = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1200] p-3 sm:p-4">
      <div className="max-w-5xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-700 leading-relaxed">
            Usamos cookies para manter seu login, lembrar seu carrinho e melhorar sua experiência no site.
            Ao continuar navegando, você concorda com a nossa{' '}
            <button onClick={() => goTo('/politica-cookies')} className="text-[#8B2214] font-semibold underline">Política de Cookies</button>{' '}
            e a nossa{' '}
            <button onClick={() => goTo('/politica-privacidade')} className="text-[#8B2214] font-semibold underline">Política de Privacidade</button>.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => goTo('/politica-cookies')} className="text-sm font-semibold text-gray-600 hover:text-gray-900">
            Saber mais
          </button>
          <button onClick={accept} className="bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold px-6 py-2.5 rounded-full transition-colors shadow">
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
