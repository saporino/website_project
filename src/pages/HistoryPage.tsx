import { useEffect } from 'react';

const go = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
};

// Foto da secagem do café no terreiro — "onde tudo começa".
const HERO_IMG = '/historia-hero.png';

export function HistoryPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Topo simples com logo */}
      <header className="absolute top-0 left-0 right-0 z-20 px-6 lg:px-10 py-5">
        <button onClick={() => go('/')} className="inline-flex items-center">
          <img src="/saporino-logo-tight.png" alt="Café Saporino" className="h-9 w-auto drop-shadow-lg" />
        </button>
      </header>

      {/* Hero */}
      <section className="relative h-[60vh] min-h-[380px] w-full overflow-hidden">
        <img src={HERO_IMG} alt="Colheita do café no Cerrado Mineiro" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30" />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-5xl mx-auto w-full px-6 lg:px-8 pb-12">
            <p className="text-white/80 text-sm font-semibold tracking-widest uppercase mb-3">Café Saporino</p>
            <h1 className="text-4xl md:text-6xl font-bold text-white [text-shadow:_0_2px_16px_rgb(0_0_0_/_60%)]">Nossa História</h1>
            <p className="text-white/90 text-lg md:text-xl mt-3 max-w-2xl">Onde tudo começa — do grão ao terreiro, até a sua xícara.</p>
          </div>
        </div>
      </section>

      {/* Texto */}
      <article className="max-w-3xl mx-auto px-6 lg:px-8 py-16">
        <div className="space-y-6 text-lg text-gray-700 leading-relaxed">
          <p>
            O <strong className="text-gray-900">Café Saporino</strong> nasceu em 2025, em Patrocínio, Minas Gerais, no coração do Cerrado Mineiro, uma das regiões mais tradicionais e respeitadas na produção de café do Brasil. Desde o início, nosso propósito foi claro: levar às pessoas o sabor verdadeiro do café mineiro, aquele que carrega em cada grão a identidade, a cultura e a autenticidade da nossa terra.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 pt-4">A essência começou bem antes da nossa fundação</h2>
          <p>
            A história que nos inspira remonta a 1890, quando, sob o sol forte do Triângulo Mineiro, um jovem agricultor colhia grãos vermelhos que brilhavam como "ouro verde". Seu sonho era simples e grandioso ao mesmo tempo: ver o café de sua família conquistar São Paulo, o grande centro do comércio cafeeiro da época.
          </p>
          <p>
            As sacas, carregadas em carroças, seguiam até a estação mais próxima, de onde embarcavam em longas viagens de trem, cruzando o Rio Grande até Campinas e chegando finalmente à capital paulista. Cada grão levava consigo mais que aroma e sabor, levava a história de famílias inteiras que transformavam trabalho duro em tradição.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 pt-4">Hoje, a Saporino honra esse legado</h2>
          <p>
            Selecionamos cuidadosamente os melhores grãos do Cerrado Mineiro, mantendo o compromisso com a qualidade desde a lavoura até a torra. Cada pacote que chega às prateleiras carrega o percurso histórico que conecta Minas Gerais a São Paulo, da roça à cidade, do passado ao presente.
          </p>

          <blockquote className="border-l-4 border-[#8B2214] pl-5 py-1 my-8 text-xl italic text-gray-800">
            Quando você abre um Café Saporino, você não está apenas provando um café — está vivendo uma jornada que começou há mais de 130 anos e continua sendo escrita, xícara após xícara, por quem valoriza sabor, tradição e origem.
          </blockquote>
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4">
          <button onClick={() => go('/')}
            className="bg-[#8B2214] hover:bg-[#6d1a10] text-white px-8 py-3.5 rounded-full font-semibold transition-colors">
            Conheça nossos cafés
          </button>
          <button onClick={() => go('/')}
            className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3.5 rounded-full font-semibold transition-colors">
            Voltar para a loja
          </button>
        </div>
      </article>
    </div>
  );
}
