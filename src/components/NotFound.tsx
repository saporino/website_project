import { useEffect } from 'react';

export default function NotFound() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const goHome = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  return (
    <div className="min-h-screen bg-[#f8f7f5] flex flex-col items-center justify-center px-6 text-center">
      <img src="/saporino-logo.png" alt="Café Saporino" className="h-20 w-auto mb-8" />
      <p className="text-6xl font-extrabold text-[#8B2214] mb-2">404</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Página não encontrada</h1>
      <p className="text-gray-600 max-w-md mb-8">A página que você procura não existe ou foi movida. Que tal voltar e conhecer nossos cafés?</p>
      <button onClick={goHome} className="bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold px-8 py-3 rounded-full transition-colors shadow-lg">
        Voltar para a loja
      </button>
    </div>
  );
}
