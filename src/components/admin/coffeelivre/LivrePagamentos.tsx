// Coffee LiVRE — pagamentos (admin financeiro mínimo da U9.1).
//
// Uma linha por cobrança (um pagamento por subpedido): vendedor, pedido, provedor,
// ids no provedor, valores congelados, taxa estimada × real, status local × remoto,
// última reconciliação, divergência e reembolso. Ações: reconciliar e processar
// reembolsos, sempre pelas Edge Functions (nenhum status é editado à mão).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { processarReembolsos, reconciliar } from '../../../pages/coffeelivre/pagamento/dados';

interface Linha {
  id: string; provedor: string; ambiente: string; metodo: string; status: string; status_remoto: string | null;
  mp_payment_id: string | null; external_reference: string; valor_cents: number; frete_cents: number; comissao_cents: number;
  tarifa_cents: number; application_fee_cents: number; processor_fee_estimada_cents: number | null; processor_fee_real_cents: number | null;
  liquido_seller_estimado_cents: number | null; liquido_seller_real_cents: number | null; reembolsado_cents: number;
  ultima_reconciliacao_em: string | null; divergencia: string | null; precisa_atencao: boolean; ultimo_erro: string | null; criado_em: string;
  lv_seller_orders: { numero: string; loja_nome: string } | null;
  lv_orders: { numero: string; comprador_nome: string } | null;
  lv_refunds: { status: string; valor_cents: number }[];
}

const brl = (c: number | null) => (c == null ? '—' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const quando = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca');

export default function LivrePagamentos() {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [soAtencao, setSoAtencao] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    let q = supabase.from('lv_cobrancas')
      .select('id, provedor, ambiente, metodo, status, status_remoto, mp_payment_id, external_reference, valor_cents, frete_cents, comissao_cents, tarifa_cents, application_fee_cents, processor_fee_estimada_cents, processor_fee_real_cents, liquido_seller_estimado_cents, liquido_seller_real_cents, reembolsado_cents, ultima_reconciliacao_em, divergencia, precisa_atencao, ultimo_erro, criado_em, lv_seller_orders(numero, loja_nome), lv_orders(numero, comprador_nome), lv_refunds(status, valor_cents)')
      .order('criado_em', { ascending: false }).limit(100);
    if (soAtencao) q = q.eq('precisa_atencao', true);
    const { data, error } = await q;
    if (error) toast.error('Não foi possível carregar os pagamentos.');
    setLinhas((data as unknown as Linha[]) ?? []);
    setCarregando(false);
  }, [soAtencao]);

  useEffect(() => { carregar(); }, [carregar]);

  async function acao(chave: string, fn: () => Promise<unknown>, ok: string) {
    setOcupado(chave);
    try { await fn(); toast.success(ok); await carregar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Falhou.'); }
    finally { setOcupado(null); }
  }

  const atencao = linhas.filter(l => l.precisa_atencao).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900">Pagamentos</h3>
          <p className="text-sm text-gray-500">Um pagamento por subpedido (Split 1:1). Valores congelados; taxa do Mercado Pago estimada até a reconciliação.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input type="checkbox" checked={soAtencao} onChange={e => setSoAtencao(e.target.checked)} /> Só os que precisam de atenção
          </label>
          <button type="button" disabled={!!ocupado} onClick={() => acao('todos', () => reconciliar(), 'Reconciliação concluída.')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm">
            <RefreshCw className="h-3.5 w-3.5" /> Reconciliar pendentes
          </button>
          <button type="button" disabled={!!ocupado} onClick={() => acao('reembolsos', () => processarReembolsos(), 'Reembolsos processados.')}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm">Processar reembolsos</button>
        </div>
      </div>
      {atencao > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" /> {atencao} pagamento(s) precisam de atenção.
        </div>
      )}
      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Nenhum pagamento.</div>
      ) : (
        <ul className="space-y-2">
          {linhas.map(l => (
            <li key={l.id} className={`rounded-xl border bg-white p-4 text-sm ${l.precisa_atencao ? 'border-amber-300' : 'border-gray-200'}`} data-cobranca={l.id}>
              <div className="flex flex-wrap items-center gap-2">
                <b>{l.lv_seller_orders?.numero ?? '—'}</b>
                <span className="text-gray-500">{l.lv_seller_orders?.loja_nome} · {l.lv_orders?.comprador_nome}</span>
                <span className="rounded-full bg-[#f5f0ef] px-2 py-0.5 text-xs font-semibold text-[#8B2214]">{l.status.replace(/_/g, ' ')}</span>
                <span className="text-xs text-gray-500">remoto: {l.status_remoto ?? '—'}</span>
                <span className="rounded bg-gray-100 px-1.5 text-[10px] text-gray-600">{l.provedor} · {l.ambiente} · {l.metodo}</span>
                <span className="ml-auto font-semibold">{brl(l.valor_cents)}</span>
              </div>
              <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                <span>Pagamento MP: {l.mp_payment_id ?? '—'}</span>
                <span>Referência: {l.external_reference}</span>
                <span>Frete: {brl(l.frete_cents)}</span>
                <span>Comissão + tarifa: {brl(l.comissao_cents + l.tarifa_cents)}</span>
                <span>application_fee: {brl(l.application_fee_cents)}</span>
                <span>Taxa MP estimada / real: {brl(l.processor_fee_estimada_cents)} / {brl(l.processor_fee_real_cents)}</span>
                <span>Líquido vendedor est. / real: {brl(l.liquido_seller_estimado_cents)} / {brl(l.liquido_seller_real_cents)}</span>
                <span>Reembolsado: {brl(l.reembolsado_cents)}{l.lv_refunds.length ? ` (${l.lv_refunds.map(r => r.status).join(', ')})` : ''}</span>
                <span>Última reconciliação: {quando(l.ultima_reconciliacao_em)}</span>
              </div>
              {(l.divergencia || l.ultimo_erro) && <p className="mt-2 text-xs text-amber-700">{l.divergencia ?? l.ultimo_erro}</p>}
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={!!ocupado || !l.mp_payment_id}
                        onClick={() => acao(l.id, () => reconciliar(l.id), 'Pagamento conferido.')}
                        className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs">{ocupado === l.id ? 'Conferindo…' : 'Reconciliar'}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
