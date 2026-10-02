import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import CardEmbalagem from './CardEmbalagem';
import { MINIMO_PADRAO, type GrupoEmbalagem } from './embalagens';

// Uma linha de embalagem = um produto com seletor de gramatura. O cliente não quer rolar uma
// lista de cards quase iguais: ele sabe o peso do pacote dele e quer ver AQUELE.
// Gramatura sem ficha fechada aparece no seletor assim mesmo, marcada como sob consulta —
// esconder faz a linha parecer menor do que é.
export default function GrupoEmbalagens({ grupo, waOrcamento }: { grupo: GrupoEmbalagem; waOrcamento: string }) {
  const primeiraComFicha = Math.max(0, grupo.itens.findIndex(i => !i.sobConsulta));
  const [atual, setAtual] = useState(primeiraComFicha);
  const item = grupo.itens[atual];

  return (
    <section id={grupo.id} className="border-t border-neutral-200">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{grupo.titulo}</h2>
        {grupo.resumo && <p className="mt-3 text-neutral-600 max-w-3xl">{grupo.resumo}</p>}

        {grupo.itens.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-600 border border-neutral-200 px-5 py-4">
            Medidas e cores conforme a sua necessidade, a partir de {MINIMO_PADRAO} por pedido.{' '}
            <a href={waOrcamento} target="_blank" rel="noopener noreferrer" className="font-semibold text-cofico-ink hover:underline">Peça o orçamento</a> com o tamanho do seu pacote.
          </p>
        ) : (
          <>
            {grupo.itens.length > 1 && (
              <div className="mt-8">
                <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Gramatura</span>
                <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label={`Gramatura — ${grupo.titulo}`}>
                  {grupo.itens.map((i, idx) => (
                    <button key={i.nome} type="button" role="tab" aria-selected={idx === atual}
                      onClick={() => setAtual(idx)}
                      className={`px-4 py-2 text-sm font-semibold border-2 transition-colors ${
                        idx === atual
                          ? 'bg-cofico-ink text-white border-cofico-ink'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:border-cofico-ink hover:text-cofico-ink'
                      }`}>
                      {i.capacidade ?? i.nome}
                      {i.sobConsulta && <span className={`ml-1.5 text-[11px] font-medium ${idx === atual ? 'text-white/80' : 'text-neutral-400'}`}>sob consulta</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {item.sobConsulta ? (
              <div className="mt-8 border border-neutral-200 p-8">
                <h3 className="text-lg font-semibold">{item.nome}</h3>
                <p className="mt-3 text-sm text-neutral-600 max-w-2xl">
                  Essa gramatura faz parte da linha, mas ainda não está com medida, cor e preço fechados no site.
                  Diga o volume que você precisa e a gente cota — pedido a partir de {MINIMO_PADRAO}.
                </p>
                <a href={waOrcamento} target="_blank" rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 hover:bg-cofico-dark transition-colors">
                  Pedir orçamento desta gramatura <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            ) : (
              <div className="mt-8">
                <CardEmbalagem key={item.nome} item={item} ancora={grupo.id} />
              </div>
            )}
          </>
        )}

        {/* Aviso de preço: embalagem depende de matéria-prima e muda sem aviso. Dito aqui,
            evita cobrança de preço antigo no fechamento do pedido. */}
        <p className="mt-6 text-xs text-neutral-500 border-l-2 border-neutral-300 pl-3">
          Os preços de embalagem valem para negociação de curto prazo e <strong>não são fixos</strong>. Podem mudar sem
          aviso, conforme o custo de matéria-prima, insumos e produção. Confirme o valor atualizado no fechamento do pedido.
        </p>
      </div>
    </section>
  );
}
