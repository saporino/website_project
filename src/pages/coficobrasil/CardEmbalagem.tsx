import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Expand } from 'lucide-react';
import CompartilharWhats from './CompartilharWhats';
import { MINIMO_PADRAO, type EmbalagemItem } from './embalagens';

// Card de embalagem com galeria: os quadrinhos trocam a foto principal, e clicar na foto
// principal abre ela em tela cheia. Quem compra embalagem precisa VER a medida e o
// acabamento — miniatura não decide compra.
export default function CardEmbalagem({ item, ancora }: { item: EmbalagemItem; ancora: string }) {
  const fotos = [item.foto, ...(item.fotos ?? [])].filter(Boolean) as string[];
  const [atual, setAtual] = useState(0);
  const [ampliada, setAmpliada] = useState(false);

  useEffect(() => {
    if (!ampliada) return;
    const fechar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAmpliada(false); };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [ampliada]);

  const linha = (rotulo: string, valor?: string, mono = false) => valor ? (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-500">{rotulo}</dt>
      <dd className={`font-medium ${mono ? 'font-mono text-[13px]' : ''}`}>{valor}</dd>
    </div>
  ) : null;

  return (
    <article className="border border-neutral-200 p-6 grid gap-8 sm:grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start">
      {/* Foto grande à esquerda, miniaturas embaixo — quem compra embalagem decide pelo que vê.
          O painel da foto é vermelho COFICO: o branco das artes não é o mesmo branco da página,
          e solto no card a foto parecia um retângulo sujo. Sobre o vermelho, ela se fecha. */}
      {fotos.length > 0 && (
        <div>
          <button type="button" onClick={() => setAmpliada(true)}
            title="Ver a foto grande" aria-label={`Ver ${item.nome} em tamanho grande`}
            className="group relative w-full aspect-square flex items-center justify-center cursor-zoom-in bg-white">
            <img src={fotos[atual]} alt={item.nome} className="w-full h-full object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 bg-white/90 border border-neutral-200 text-[11px] font-semibold text-neutral-600 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Expand className="w-3 h-3" aria-hidden="true" /> ampliar
            </span>
          </button>
          {fotos.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {fotos.map((f, i) => (
                <button key={f} type="button" onClick={() => setAtual(i)}
                  aria-label={`Foto ${i + 1} de ${item.nome}`} aria-current={i === atual}
                  className={`w-16 h-16 border-2 p-1 bg-white transition-colors ${i === atual ? 'border-cofico' : 'border-neutral-200 hover:border-neutral-400'}`}>
                  <img src={f} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col h-full">
        <h3 className="text-lg font-semibold leading-snug">{item.nome}</h3>
        {item.detalhes?.length ? (
          <p className="mt-2 text-sm text-neutral-600">{item.detalhes.join(' · ')}</p>
        ) : null}
        <dl className="mt-4 text-sm border-t border-neutral-200 pt-3 space-y-1">
          {linha('Capacidade', item.capacidade)}
          {linha('Medidas', item.medidas)}
          {linha('Cor', item.cor)}
          {linha('Mínimo', item.minimo ?? MINIMO_PADRAO)}
          {linha('Código', item.codigo, true)}
        </dl>
        <CompartilharWhats titulo={item.nome} ancora={ancora} />
      </div>

      {/* Descrição, aplicações e ficha ocupam a largura toda: é o texto que o cliente lê antes
          de pedir orçamento, e em coluna estreita vira parede. */}
      {(item.descricao?.length || item.aplicacoes?.length || item.ficha?.length || item.naoAcompanha || item.faq?.length) && (
        <div className="sm:col-span-2 border-t border-neutral-200 pt-6 grid gap-8 lg:grid-cols-2">
          <div>
            {item.descricao?.length ? (
              <>
                <h4 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Descrição do produto</h4>
                <div className="mt-3 space-y-3 text-sm text-neutral-700 leading-relaxed">
                  {item.descricao.map(p => <p key={p}>{p}</p>)}
                </div>
              </>
            ) : null}
            {item.aplicacoes?.length ? (
              <>
                <h4 className="mt-7 text-sm font-bold uppercase tracking-wide text-neutral-500">Principais aplicações</h4>
                <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
                  {item.aplicacoes.map(a => (
                    <li key={a} className="flex gap-2">
                      <span className="text-cofico-ink" aria-hidden="true">•</span>{a}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
          <div>
            {item.ficha?.length ? (
              <>
                <h4 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Ficha técnica</h4>
                <dl className="mt-3 text-sm">
                  {item.ficha.map(([rotulo, valor]) => (
                    <div key={rotulo} className="flex justify-between gap-4 border-b border-neutral-100 py-2">
                      <dt className="text-neutral-500">{rotulo}</dt>
                      <dd className="font-medium text-right">{valor}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
            {item.naoAcompanha ? (
              <p className="mt-6 text-sm text-neutral-600 border-l-2 border-cofico pl-3">
                <strong className="font-semibold text-neutral-900">Não acompanha:</strong> {item.naoAcompanha}
              </p>
            ) : null}
          </div>

          {/* FAQ: as perguntas que o comercial responde toda semana. Respondidas aqui, o
              orçamento chega mais perto de fechado. */}
          {item.faq?.length ? (
            <div className="lg:col-span-2 border-t border-neutral-200 pt-6">
              <h4 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Perguntas frequentes</h4>
              <div className="mt-3 grid gap-x-10 gap-y-4 md:grid-cols-2">
                {item.faq.map(({ p, r }) => (
                  <div key={p}>
                    <p className="text-sm font-semibold text-neutral-900">{p}</p>
                    <p className="mt-1 text-sm text-neutral-600 leading-relaxed">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {ampliada && createPortal(
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={() => setAmpliada(false)}>
          <button type="button" onClick={() => setAmpliada(false)} aria-label="Fechar"
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"><X className="w-6 h-6" /></button>
          <figure className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <img src={fotos[atual]} alt={item.nome} className="w-full max-h-[80vh] object-contain bg-white" />
            <figcaption className="mt-3 text-center text-sm text-white/80">{item.nome}</figcaption>
            {fotos.length > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                {fotos.map((f, i) => (
                  <button key={f} type="button" onClick={() => setAtual(i)}
                    aria-label={`Foto ${i + 1}`} aria-current={i === atual}
                    className={`w-16 h-16 border p-1 bg-white ${i === atual ? 'border-white' : 'border-white/30 hover:border-white/70'}`}>
                    <img src={f} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </figure>
        </div>,
        document.body,
      )}
    </article>
  );
}
