/**
 * CASA COFICO — preço de mercado nos marketplaces.
 *
 * ================== O QUE ESTA TELA É, E O QUE NÃO É ==================
 *
 * CASA COFICO é o nome comercial das nossas lojas em marketplace. Não é um
 * sistema à parte: é uma leitura dentro da Inteligência do RepCo.
 *
 * Esta tela responde UMA pergunta: **por quanto o mercado vende café, para eu
 * decidir o meu preço?** Ela não opera marketplace nenhum, não altera anúncio,
 * não muda preço. Só lê.
 *
 * ================== TRÊS AVISOS QUE FICAM NA TELA ==================
 *
 * 1. **É preço ANUNCIADO, não vendido.** A API do Mercado Livre não entrega
 *    quantidade vendida por oferta, então nenhuma conta aqui é ponderada por
 *    volume. A mediana descreve a oferta, não a demanda — e dizer "preço médio
 *    pago" seria inventar.
 *
 * 2. **Nenhum concorrente é excluído.** Ele foi explícito depois de eu errar
 *    três vezes: "não podemos tirar ninguém da pesquisa, nem uma marca pode
 *    passar despercebida, mesmo se tiver 1 pacote de café". Cápsula, solúvel e
 *    grão aparecem no grupo próprio, nunca somem.
 *
 * 3. **A data da coleta fica à vista.** Preço de três meses atrás apresentado
 *    como se fosse de hoje é pior do que não ter painel.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  avaliar, resumir, type Produto, type Oferta, type Comparavel,
} from '../../lib/precoCafe';
import {
  Store, AlertTriangle, RefreshCw, Clock, CheckCircle2, XCircle, Ban, TrendingUp,
} from 'lucide-react';

const PRIMARY = '#8B2214';
const brl = (v: number | null) =>
  v == null ? '—' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** O nosso, para a comparação ter referência. Vem de `products`. */
const NOSSO_PADRAO = { nome: 'Tropeiro Paulista Tradicional 500 g', precoKg: 47.8 };

interface Linha {
  listing_sku: string | null; title: string | null; price: number;
  weight_g: number | null; unit_type: string | null; price_per_kg: number | null;
  captured_at: string; search_term: string | null; raw: Record<string, unknown> | null;
}

interface Coleta {
  id: string; via: string; marketplace: string; rota: string;
  resultado: string; itens: number; erro: string | null;
  custo_usd: number | null; executado_em: string;
}

export default function CasaCoficoPanel() {
  const [busy, setBusy] = useState(true);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [verTudo, setVerTudo] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setBusy(true);
      const [p, c] = await Promise.all([
        supabase.from('ecommerce_price_snapshots')
          .select('listing_sku, title, price, weight_g, unit_type, price_per_kg, captured_at, search_term, raw')
          .eq('marketplace', 'mercadolivre')
          .order('captured_at', { ascending: false })
          .limit(2000),
        supabase.from('marketplace_coletas')
          .select('id, via, marketplace, rota, resultado, itens, erro, custo_usd, executado_em')
          .order('executado_em', { ascending: false }).limit(20),
      ]);
      if (!vivo) return;
      setLinhas((p.data as Linha[]) ?? []);
      setColetas((c.data as Coleta[]) ?? []);
      setBusy(false);
    })();
    return () => { vivo = false; };
  }, []);

  /**
   * Reagrupa por FICHA. Cada linha do banco é uma OFERTA; dezenas de
   * revendedores de um mesmo produto não podem contar como dezenas de
   * produtos — foi esse o defeito que produziu mediana de R$ 96/kg num
   * mercado que vende a 35.
   */
  const { resumo, maisRecente } = useMemo(() => {
    const porFicha = new Map<string, Linha[]>();
    for (const l of linhas) {
      const ficha = String((l.raw as any)?.ficha ?? l.listing_sku ?? l.title ?? '?');
      if (!porFicha.has(ficha)) porFicha.set(ficha, []);
      porFicha.get(ficha)!.push(l);
    }
    const itens: Comparavel[] = [];
    for (const [ficha, ofs] of porFicha) {
      const r = (ofs[0].raw ?? {}) as any;
      const kg = ofs[0].weight_g ? ofs[0].weight_g / 1000 : null;
      const p: Produto = {
        ficha, titulo: ofs[0].title, marca: r.marca ?? null,
        tipo: r.tipo ?? null, torra: r.torra ?? null,
        kgUnidade: kg, unidades: 1,
      };
      const ofertas: Oferta[] = ofs.map(o => ({ preco: o.price, condicao: 'new', minCompra: 1 }));
      itens.push(avaliar(p, ofertas));
    }
    const data = linhas.length ? linhas[0].captured_at : new Date().toISOString();
    return { resumo: resumir(itens, data), maisRecente: data };
  }, [linhas]);

  if (busy) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-4" style={{ borderColor: PRIMARY }} />
      </div>
    );
  }

  if (!linhas.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <Store className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="font-semibold text-gray-700">Nenhuma coleta ainda</p>
        <p className="text-sm text-gray-500 mt-1">
          Rode <code className="bg-gray-100 px-1.5 py-0.5 rounded">node scripts/ml-coleta-cafe.mjs --gravar</code> para
          trazer os preços do Mercado Livre.
        </p>
      </div>
    );
  }

  const r = resumo;
  const diasAtras = Math.floor((Date.now() - new Date(maisRecente).getTime()) / 86400000);
  const velho = diasAtras > 7;
  const prateleira = r.todos.filter(i => i.grupo === 'p500');
  const nossoFica = prateleira.filter(i => (i.reaisPorKg ?? 0) < NOSSO_PADRAO.precoKg).length;

  return (
    <div className="space-y-5">
      {/* ---- quando foi coletado: o primeiro número que ele tem de ver ---- */}
      <div className={`rounded-xl p-4 flex items-start gap-3 border ${
        velho ? 'bg-amber-50 border-amber-200' : 'bg-[#f5f0ef] border-[#ddd0cc]'}`}>
        <Clock className={`w-5 h-5 flex-shrink-0 mt-0.5 ${velho ? 'text-amber-700' : 'text-[#8B2214]'}`} />
        <div className="text-sm">
          <p className={`font-semibold ${velho ? 'text-amber-900' : 'text-[#8B2214]'}`}>
            Coleta de {new Date(maisRecente).toLocaleDateString('pt-BR')}
            {diasAtras > 0 && ` — ${diasAtras} dia(s) atrás`}
            {velho && ' · pode estar desatualizada'}
          </p>
          <p className={velho ? 'text-amber-800' : 'text-gray-600'}>
            {r.totais.coletados} produtos · {linhas.length} ofertas · Mercado Livre, pela API oficial
          </p>
        </div>
      </div>

      {/* ---- a régua ---- */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" style={{ color: PRIMARY }} />
          Prateleira de 500 g — todas as marcas, todas as linhas
        </h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">
          Preço <strong>anunciado</strong>, não vendido. A API não entrega quantidade vendida,
          então nada aqui é ponderado por volume.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([['Mais barato', r.principal.min], ['25% abaixo de', r.principal.p25],
             ['Mediana', r.principal.mediana], ['25% acima de', r.principal.p75]] as const)
            .map(([rotulo, v], i) => (
            <div key={rotulo} className={`rounded-lg p-3 border ${
              i === 2 ? 'bg-[#f5f0ef] border-[#ddd0cc]' : 'bg-white border-gray-200'}`}>
              <p className="text-[11px] text-gray-500">{rotulo}</p>
              <p className={`text-lg font-bold ${i === 2 ? 'text-[#8B2214]' : 'text-gray-900'}`}>
                {brl(v)}<span className="text-xs font-normal text-gray-500">/kg</span>
              </p>
            </div>
          ))}
        </div>

        {/* onde nós estamos */}
        <div className="mt-4 rounded-lg border-l-4 border-l-[#8B2214] bg-[#f5f0ef] p-4">
          <p className="text-sm font-semibold text-[#8B2214]">{NOSSO_PADRAO.nome}</p>
          <p className="text-sm text-gray-700 mt-0.5">
            <strong>{brl(NOSSO_PADRAO.precoKg)}/kg</strong> ·{' '}
            {nossoFica} de {prateleira.length} produtos estão mais baratos que nós
            {r.principal.mediana && (
              <> · {NOSSO_PADRAO.precoKg < r.principal.mediana ? 'abaixo' : 'acima'} da mediana</>
            )}
          </p>
        </div>
      </div>

      {/* ---- todos os produtos, sem corte ---- */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-gray-900">Concorrentes ({r.totais.coletados})</h3>
          <button onClick={() => setVerTudo(v => !v)}
            className="text-xs font-semibold text-[#8B2214] hover:underline">
            {verTudo ? 'mostrar menos' : 'ver todos'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Nenhuma marca é excluída. Cápsula, solúvel e grão aparecem no grupo próprio.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">Marca</th>
                <th className="py-2 pr-3">Produto</th>
                <th className="py-2 pr-3">Grupo</th>
                <th className="py-2 pr-3 text-right">Preço</th>
                <th className="py-2 pr-3 text-right tabular-nums">R$/kg</th>
                <th className="py-2 text-right">Ofertas</th>
              </tr>
            </thead>
            <tbody>
              {(verTudo ? r.todos : r.todos.slice(0, 15)).map(i => {
                const nosso = i.reaisPorKg != null && i.reaisPorKg > NOSSO_PADRAO.precoKg;
                return (
                  <tr key={i.ficha} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-900">{i.marca ?? '—'}</td>
                    <td className="py-2 pr-3 text-gray-600 max-w-xs truncate" title={i.titulo ?? ''}>
                      {i.titulo ?? '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="text-[10px] uppercase tracking-wide text-gray-500">{i.grupo}</span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{brl(i.precoRepresentativo)}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums font-semibold ${
                      nosso ? 'text-gray-900' : 'text-[#8B2214]'}`}>
                      {i.reaisPorKg == null ? '—' : i.reaisPorKg.toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-gray-500 tabular-nums">{i.ofertasNaFicha}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- o histórico de coletas: a pergunta dele, "onde vejo cada puxada?" ---- */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-1">
          <RefreshCw className="w-4 h-4" style={{ color: PRIMARY }} /> Coletas
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Cada vez que puxamos dado, fica registrado aqui — inclusive o que falhou.
        </p>
        {coletas.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma coleta registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {coletas.map(c => (
              <div key={c.id} className="flex items-start gap-2 text-sm border border-gray-100 rounded-lg p-2.5">
                {c.resultado === 'ok' ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  : c.resultado === 'sem_permissao' ? <Ban className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900">
                    {new Date(c.executado_em).toLocaleString('pt-BR')} ·{' '}
                    <strong>{c.marketplace}</strong> ·{' '}
                    <span className="uppercase text-[11px] tracking-wide text-gray-500">{c.via}</span>
                  </p>
                  <p className="text-xs text-gray-500 truncate" title={c.rota}>{c.rota}</p>
                  {c.erro && <p className="text-xs text-red-700 mt-0.5">{c.erro}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-gray-900 tabular-nums">{c.itens}</p>
                  <p className="text-[11px] text-gray-500">
                    {c.custo_usd != null ? `US$ ${c.custo_usd}` : 'sem custo'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- o que a API NÃO dá: dito, não escondido ---- */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" /> O que estes números não dizem
        </h3>
        <ul className="text-sm text-gray-600 space-y-1.5 list-disc pl-5">
          {r.limitacoes.map((l, i) => <li key={i}>{l}</li>)}
          <li>
            A busca por texto da API (<code className="text-xs bg-gray-100 px-1 rounded">/sites/MLB/search</code>) responde{' '}
            <strong>403</strong> para a nossa aplicação. Não é permissão faltando — foi restrição do
            Mercado Livre, confirmada com todos os escopos de leitura concedidos. A coleta usa o
            catálogo, que entrega o mesmo.
          </li>
        </ul>
      </div>
    </div>
  );
}
