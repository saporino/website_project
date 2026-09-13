// Coffee LiVRE — regras da Calculadora de Economia.
//
// Tarifa muda. Esta tela existe para que reajuste da Shopee ou tabela nova
// do Mercado Livre seja uma edição, não um deploy. Cada linha guarda valor,
// vigência, fonte e confiabilidade; o que não é público fica VAZIO, e a
// calculadora mostra "não disponível" em vez de inventar zero.
//
// CMS mínimo de propósito: editar o que já existe. Criar regra nova ainda é
// migration, porque exige pensar a faixa inteira.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { paraCentavos, deCentavos, paraBps, deBps } from '../../../pages/coffeelivre/vendedor/dinheiro';

interface Linha {
  id: string;
  plataforma: string;
  modalidade: string | null;
  componente: string;
  cenario: string | null;
  percentual_bps: number | null;
  valor_cents: number | null;
  valor_micros: number | null;
  preco_min_cents: number | null;
  preco_max_cents: number | null;
  peso_sobre: string | null;
  peso_min_g: number | null;
  peso_max_g: number | null;
  confiabilidade: string;
  natureza: string;
  rotulo: string | null;
  fonte: string | null;
  verificado_em: string | null;
  vigencia_fim: string | null;
  observacao: string | null;
}

interface Premissa { chave: string; valor: number; rotulo: string; unidade: string | null }

const PLATAFORMAS: [string, string][] = [
  ['mercado_livre', 'Mercado Livre'], ['shopee', 'Shopee'], ['amazon', 'Amazon'], ['magalu', 'Magalu'], ['ifood', 'iFood (delivery)'], ['coffeelivre', 'Coffee LiVRE'],
];

const CONFIABILIDADES: [string, string][] = [
  ['verificado', 'Fonte oficial'], ['fonte_secundaria', 'Fonte secundária'], ['calculado', 'Calculado'],
  ['premissa', 'Premissa do estudo'], ['conflitante', 'Fontes divergem'], ['nao_publico', 'Não público'],
  ['em_estudo', 'Em estudo'], ['desatualizado', 'Desatualizado'], ['nao_se_aplica', 'Não entra na conta'],
];

const ehPercentual = (l: Linha) => l.componente === 'comissao' || l.componente === 'pagamento';
const reais = (c: number | null) => (c == null ? '∞' : `R$ ${deCentavos(c)}`);

function faixa(l: Linha): string {
  const partes: string[] = [];
  if (l.preco_min_cents != null || l.preco_max_cents != null) partes.push(`pedido ${reais(l.preco_min_cents ?? 0)}–${reais(l.preco_max_cents)}`);
  if (l.peso_sobre) partes.push(`${l.peso_sobre === 'envio' ? 'envio' : 'pacote'} ${l.peso_min_g ?? 0}–${l.peso_max_g ?? '∞'} g`);
  return partes.join(' · ') || 'qualquer pedido';
}

/** Micros ("0,085680") ↔ inteiro, sem ponto flutuante. */
function paraMicros(t: string): number | null {
  const limpo = t.trim().replace(/\s|R\$/g, '').replace(',', '.');
  if (!limpo) return null;
  if (!/^\d+(\.\d{0,6})?$/.test(limpo)) return null;
  const [i, f = ''] = limpo.split('.');
  return Number(i) * 1_000_000 + Number((f + '000000').slice(0, 6));
}
const deMicros = (m: number | null) => (m == null ? '' : `${Math.floor(m / 1_000_000)},${String(m % 1_000_000).padStart(6, '0')}`);

function valorEditavel(l: Linha): string {
  if (ehPercentual(l)) return deBps(l.percentual_bps);
  if (l.valor_micros != null) return deMicros(l.valor_micros);
  return deCentavos(l.valor_cents);
}

function LinhaEditavel({ linha, aoSalvar }: { linha: Linha; aoSalvar: () => void }) {
  const [valor, setValor] = useState(valorEditavel(linha));
  const [confiabilidade, setConfiabilidade] = useState(linha.confiabilidade);
  const [fonte, setFonte] = useState(linha.fonte ?? '');
  const [verificadoEm, setVerificadoEm] = useState(linha.verificado_em ?? '');
  const [vigenciaFim, setVigenciaFim] = useState(linha.vigencia_fim ?? '');
  const [observacao, setObservacao] = useState(linha.observacao ?? '');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const mudanca: Record<string, unknown> = {
      confiabilidade, fonte: fonte.trim() || null, verificado_em: verificadoEm || null,
      vigencia_fim: vigenciaFim || null, observacao: observacao.trim() || null, updated_at: new Date().toISOString(),
    };
    // Vazio grava NULO — "não disponível" — e nunca zero.
    if (ehPercentual(linha)) {
      const bps = valor.trim() ? paraBps(valor) : null;
      if (valor.trim() && bps == null) { toast.error('Percentual inválido.'); return; }
      mudanca.percentual_bps = bps;
    } else if (linha.valor_micros != null) {
      const m = valor.trim() ? paraMicros(valor) : null;
      if (valor.trim() && m == null) { toast.error('Valor inválido.'); return; }
      mudanca.valor_micros = m;
    } else {
      const c = valor.trim() ? paraCentavos(valor) : null;
      if (valor.trim() && c == null) { toast.error('Valor inválido.'); return; }
      mudanca.valor_cents = c;
    }
    setSalvando(true);
    const { error } = await supabase.from('lv_tarifas_simulacao').update(mudanca).eq('id', linha.id);
    setSalvando(false);
    if (error) { toast.error('Não foi possível salvar: ' + error.message); return; }
    toast.success('Regra salva. A calculadora já usa o novo valor.');
    aoSalvar();
  }

  return (
    <tr className="align-top">
      <td className="py-2 pr-3">
        <p className="font-medium text-gray-900">{linha.rotulo ?? linha.componente}</p>
        <p className="text-xs text-gray-500">
          {[linha.modalidade, linha.cenario].filter(Boolean).join(' · ') || 'todas as modalidades'} · {faixa(linha)}
        </p>
        {linha.natureza === 'hipotese_livre' && <span className="text-[10px] font-semibold uppercase text-amber-700">Hipótese em estudo</span>}
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1">
          {!ehPercentual(linha) && <span className="text-xs text-gray-500">R$</span>}
          <input value={valor} onChange={e => setValor(e.target.value)} placeholder="não público"
                 className="w-24 rounded border border-gray-300 px-2 py-1 text-sm" />
          {ehPercentual(linha) && <span className="text-xs text-gray-500">%</span>}
        </div>
      </td>
      <td className="py-2 pr-3">
        <select value={confiabilidade} onChange={e => setConfiabilidade(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm">
          {CONFIABILIDADES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </td>
      <td className="py-2 pr-3">
        <input type="date" value={verificadoEm} onChange={e => setVerificadoEm(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm" aria-label="Verificado em" />
        <input type="date" value={vigenciaFim} onChange={e => setVigenciaFim(e.target.value)} className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm" aria-label="Vigência até" title="Vigência até" />
      </td>
      <td className="py-2 pr-3">
        <input value={fonte} onChange={e => setFonte(e.target.value)} placeholder="Fonte" className="w-56 rounded border border-gray-300 px-2 py-1 text-sm" />
        <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} placeholder="Observação"
                  className="mt-1 w-56 rounded border border-gray-300 px-2 py-1 text-xs" />
      </td>
      <td className="py-2">
        <button onClick={salvar} disabled={salvando}
                className="inline-flex items-center gap-1 rounded-lg bg-[#8B2214] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6d1a10] disabled:opacity-50">
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
        </button>
      </td>
    </tr>
  );
}

export default function LivreTarifas() {
  const [plataforma, setPlataforma] = useState('mercado_livre');
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [premissas, setPremissas] = useState<Premissa[]>([]);

  const carregar = useCallback(async () => {
    const [r, p] = await Promise.all([
      supabase.from('lv_tarifas_simulacao')
        .select('id, plataforma, modalidade, componente, cenario, percentual_bps, valor_cents, valor_micros, preco_min_cents, preco_max_cents, peso_sobre, peso_min_g, peso_max_g, confiabilidade, natureza, rotulo, fonte, verificado_em, vigencia_fim, observacao')
        .order('ordem').order('modalidade').order('peso_min_g').order('preco_min_cents'),
      supabase.from('lv_simulacao_premissas').select('chave, valor, rotulo, unidade'),
    ]);
    if (r.error) toast.error('Não foi possível ler as regras.');
    setLinhas((r.data as Linha[]) ?? []);
    setPremissas((p.data as Premissa[]) ?? []);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvarPremissa(chave: string, texto: string) {
    const valor = Number(texto.replace(/\D/g, ''));
    if (!Number.isInteger(valor)) { toast.error('Valor inválido.'); return; }
    const { error } = await supabase.from('lv_simulacao_premissas').update({ valor, updated_at: new Date().toISOString() }).eq('chave', chave);
    if (error) toast.error('Não foi possível salvar.'); else toast.success('Premissa salva.');
  }

  const daPlataforma = (linhas ?? []).filter(l => l.plataforma === plataforma);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-gray-900">Calculadora de Economia</h3>
        <p className="mt-0.5 max-w-3xl text-sm text-gray-500">
          Regras que a calculadora de /coffeelivre/vender usa. Deixe o valor vazio quando o custo não for público:
          a calculadora mostra "não disponível" e nunca trata como zero. Valores do Coffee LiVRE são hipóteses em estudo.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">Premissas</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {premissas.map(p => (
            <label key={p.chave} className="text-sm text-gray-600">
              {p.rotulo}
              <input defaultValue={p.valor} onBlur={e => salvarPremissa(p.chave, e.target.value)}
                     className="ml-2 w-20 rounded border border-gray-300 px-2 py-1 text-sm" />
              <span className="ml-1 text-xs text-gray-400">{p.unidade}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PLATAFORMAS.map(([v, r]) => (
          <button key={v} onClick={() => setPlataforma(v)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${plataforma === v ? 'border-[#8B2214] bg-[#8B2214] text-white' : 'border-gray-300 bg-white text-gray-600'}`}>
            {r}
          </button>
        ))}
      </div>

      {!linhas ? (
        <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr><th className="pb-2">Regra</th><th className="pb-2">Valor</th><th className="pb-2">Confiabilidade</th><th className="pb-2">Verificado / vigência</th><th className="pb-2">Fonte e observação</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {daPlataforma.map(l => <LinhaEditavel key={l.id} linha={l} aoSalvar={carregar} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
