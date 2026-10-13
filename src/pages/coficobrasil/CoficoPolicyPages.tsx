// Páginas legais PRÓPRIAS da COFICO (LGPD + Termos + Exclusão de dados).
//
// O TEXTO não mora aqui: mora em `legal.json`, que é a fonte única lida também pelo
// `scripts/prerender-seo.mjs` para gerar o HTML estático de cada página — exigência da
// Meta e dos crawlers, que leem a política SEM executar JavaScript.
//
// Controlador = V. Medeiros de Santi Ltda (marca COFICO Brasil). O conteúdo reflete um site
// INSTITUCIONAL/VITRINE: não há checkout/venda/pagamento no site, então não se coletam
// dados de cartão/compra — só contato/lead, navegação e, no futuro, a conversa de WhatsApp.
//
// Rotas: /privacidade, /termos, /exclusao-de-dados (URLs diretas, para a Meta) e os hashes
// antigos #privacidade / #termos, que continuam valendo para não quebrar link já publicado.
import { useEffect } from 'react';
import { renderInline, type Bloco, type Documento, type Vars } from './legalMarkup';
import CoficoFooter from './CoficoFooter';
import dados from './legal.json';

const LEGAL = dados as unknown as {
  atualizado: string; vars: Vars; documentos: Documento[];
};

export const DOCUMENTOS_LEGAIS = LEGAL.documentos;
export const atualizadoEm = LEGAL.atualizado;
export function documentoLegal(slug: string): Documento | undefined {
  return LEGAL.documentos.find(d => d.slug === slug);
}

function voltarAoSite(e: React.MouseEvent) {
  // Dentro do app, voltar para a home da COFICO sem recarregar a página.
  e.preventDefault();
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

function Linha({ bloco }: { bloco: Bloco }) {
  const html = (t: string) => ({ __html: renderInline(t, LEGAL.vars) });
  if (bloco.h2) {
    return <h2 className="text-xl md:text-2xl font-bold text-neutral-900 mt-8 mb-3"
      dangerouslySetInnerHTML={html(bloco.h2)} />;
  }
  if (bloco.ul) {
    return (
      <ul className="list-disc pl-6">
        {bloco.ul.map((item, i) => <li key={i} className="mb-1" dangerouslySetInnerHTML={html(item)} />)}
      </ul>
    );
  }
  return <p dangerouslySetInnerHTML={html(bloco.p ?? '')} />;
}

export function CoficoLegalPage({ slug }: { slug: string }) {
  const doc = documentoLegal(slug);
  useEffect(() => { if (doc) document.title = doc.titulo; }, [doc]);
  if (!doc) return null;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <a href="/" onClick={voltarAoSite} className="font-semibold text-neutral-900 hover:text-cofico-ink transition-colors">
            COFICO <span className="text-cofico-ink">Brasil</span>
          </a>
          <a href="/" onClick={voltarAoSite} className="text-sm text-neutral-500 hover:text-cofico-ink transition-colors">
            ← Voltar ao site
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 pt-10 pb-16">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">{doc.h1}</h1>
        <p className="text-sm text-neutral-500 mb-8"><strong>Última atualização:</strong> {LEGAL.atualizado}</p>
        <div className="text-neutral-700 leading-relaxed space-y-4">
          {doc.blocos.map((b, i) => <Linha key={i} bloco={b} />)}
        </div>
      </main>
      <CoficoFooter />
    </div>
  );
}

// Nomes antigos mantidos: CoficoBrasilPage ainda os usa para os hashes #privacidade/#termos.
export const CoficoPrivacidade = () => <CoficoLegalPage slug="privacidade" />;
export const CoficoTermos = () => <CoficoLegalPage slug="termos" />;
export const CoficoExclusaoDeDados = () => <CoficoLegalPage slug="exclusao-de-dados" />;
