// Coffee LiVRE — oportunidades B2B.
//
// Empresas que pediram cotação: quem é, o que quer, quanto, com que
// frequência e em que pé está. Status simples de propósito — novo, em
// análise, atendido, encerrado — porque nesta fase quem atende é a equipe.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';

interface Solicitacao {
  id: string;
  classificacao: string | null;
  gramatura_g: number | null;
  moagem: string | null;
  consumo_mensal_kg: number | null;
  quantidade_kg: number;
  frequencia: string;
  observacao: string | null;
  status: string;
  is_demo: boolean;
  created_at: string;
  lv_b2b_empresas: {
    nome: string; tipo_negocio: string; cidade: string | null; uf: string | null;
    responsavel: string | null; email: string | null; cnpj: string | null;
  } | null;
}

const STATUS: [string, string][] = [['novo', 'Novo'], ['em_analise', 'Em análise'], ['atendido', 'Atendido'], ['encerrado', 'Encerrado']];
const FREQUENCIA: Record<string, string> = { unica: 'Compra única', semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal' };
const TIPO: Record<string, string> = {
  cafeteria: 'Cafeteria', hotel: 'Hotel', restaurante: 'Restaurante', padaria: 'Padaria', escritorio: 'Escritório',
  cozinha_industrial: 'Cozinha industrial', mercado: 'Mercado', distribuidor: 'Distribuidor', outro: 'Outro',
};
const POR_MES: Record<string, number> = { unica: 0, semanal: 4, quinzenal: 2, mensal: 1 };

export default function LivreB2B() {
  const [lista, setLista] = useState<Solicitacao[] | null>(null);
  const [filtro, setFiltro] = useState('abertas');

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('lv_b2b_solicitacoes')
      .select('id, classificacao, gramatura_g, moagem, consumo_mensal_kg, quantidade_kg, frequencia, observacao, status, is_demo, created_at, lv_b2b_empresas(nome, tipo_negocio, cidade, uf, responsavel, email, cnpj)')
      .order('created_at', { ascending: false });
    if (error) toast.error('Não foi possível ler as solicitações.');
    setLista((data as unknown as Solicitacao[]) ?? []);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function mudarStatus(s: Solicitacao, status: string) {
    const { error } = await supabase.from('lv_b2b_solicitacoes').update({ status, updated_at: new Date().toISOString() }).eq('id', s.id);
    if (error) { toast.error('Não foi possível alterar.'); return; }
    toast.success(`Solicitação de ${s.lv_b2b_empresas?.nome ?? 'empresa'} marcada como ${STATUS.find(x => x[0] === status)?.[1].toLowerCase()}.`);
    carregar();
  }

  const todas = lista ?? [];
  const visiveis = todas.filter(s => filtro === 'todas' ? true : filtro === 'abertas' ? ['novo', 'em_analise'].includes(s.status) : s.status === filtro);
  const empresas = new Set(todas.map(s => s.lv_b2b_empresas?.nome)).size;
  const abertas = todas.filter(s => ['novo', 'em_analise'].includes(s.status));
  const recorrenteKg = abertas.reduce((t, s) => t + s.quantidade_kg * (POR_MES[s.frequencia] ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-gray-900">Empresas (B2B)</h3>
        <p className="mt-0.5 text-sm text-gray-500">Pedidos de cotação feitos em /coffeelivre/empresas. Sem crédito nem cobrança nesta fase.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Empresas interessadas', empresas.toLocaleString('pt-BR')],
          ['Solicitações abertas', abertas.length.toLocaleString('pt-BR')],
          ['Volume recorrente aberto', `${recorrenteKg.toLocaleString('pt-BR')} kg/mês`],
          ['Total de solicitações', todas.length.toLocaleString('pt-BR')],
        ].map(([r, v]) => (
          <div key={r} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{r}</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[['abertas', 'Abertas'], ...STATUS, ['todas', 'Todas']].map(([v, r]) => (
          <button key={v} onClick={() => setFiltro(v)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${filtro === v ? 'border-[#8B2214] bg-[#8B2214] text-white' : 'border-gray-300 bg-white text-gray-600'}`}>
            {r}
          </button>
        ))}
      </div>

      {!lista ? (
        <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <Building2 className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Nenhuma solicitação neste filtro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiveis.map(s => {
            const e = s.lv_b2b_empresas;
            return (
              <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4" data-solicitacao={s.id}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">
                      {e?.nome ?? 'Empresa'} {s.is_demo && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500">demo</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {TIPO[e?.tipo_negocio ?? ''] ?? e?.tipo_negocio} · {[e?.cidade, e?.uf].filter(Boolean).join('/') || 'local não informado'}
                      {e?.responsavel ? ` · ${e.responsavel}` : ''}{e?.email ? ` · ${e.email}` : ''}{e?.cnpj ? ` · CNPJ ${e.cnpj}` : ''}
                    </p>
                    <p className="mt-2 text-sm text-gray-800">
                      <b>{s.quantidade_kg.toLocaleString('pt-BR')} kg</b> · {FREQUENCIA[s.frequencia]}
                      {s.consumo_mensal_kg ? ` · ${s.consumo_mensal_kg.toLocaleString('pt-BR')} kg/mês` : ''}
                      {' · '}{[s.classificacao, s.gramatura_g ? `${s.gramatura_g} g` : null, s.moagem].filter(Boolean).join(' · ') || 'café não especificado'}
                    </p>
                    {s.observacao && <p className="mt-1 text-xs text-gray-500">{s.observacao}</p>}
                    <p className="mt-1 text-[11px] text-gray-400">{new Date(s.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <select value={s.status} onChange={ev => mudarStatus(s, ev.target.value)} aria-label="Status da solicitação"
                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                    {STATUS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
