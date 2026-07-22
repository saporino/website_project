import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { subscribeVisitLive } from '../../lib/promoterVisit';
import { toast } from 'sonner';
import { AlertTriangle, MessageCircle, ShoppingCart, CheckCircle, Store } from 'lucide-react';

// Bloco 5 — Rupturas: o promotor marca a falta às 9h, o representante vê às 9h01,
// com foto, último pedido e volume médio — e converte em pedido dali mesmo.

interface Alerta {
  id: string; visit_id: string | null; representative_client_id: string; product_id: string | null;
  category: string; priority: string; status: string; description: string | null;
  opened_at: string; converted_to_order_id: string | null;
  loja: string | null; product_name: string | null; product_image: string | null;
  promoter_name: string | null; na_loja_agora: boolean;
  ultimo_pedido_em: string | null; volume_medio: number | null;
  fotos: { url: string; kind: string }[] | null;
}
interface Props {
  repId?: string; // a view vw_ruptura_alerts já filtra pelo rep logado (my_rep_id)
  onOpenChat: (conversationId: string) => void;
  onGenerateOrder: (incident: { id: string; clientId: string; productId: string | null; productName: string | null }) => void;
}

const CAT_LABEL: Record<string, string> = {
  ruptura_total: 'RUPTURA TOTAL', ruptura_gondola: 'Ruptura de gôndola', sem_etiqueta: 'Sem etiqueta',
  preco_incorreto: 'Preço incorreto', avaria: 'Avaria', vencimento: 'Vencimento', risco_vencimento: 'Risco de vencimento',
  pedido_nao_entregue: 'Pedido não entregue', fora_do_cadastro: 'Fora do cadastro', falta_espaco: 'Falta de espaço',
  concorrente_no_espaco: 'Concorrente no espaço', nao_autorizado: 'Não autorizado', material_ausente: 'Material ausente',
  manutencao: 'Manutenção', outro: 'Outro',
};

export default function RepCoRupturas({ onOpenChat, onGenerateOrder }: Props) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'abertas' | 'resolvidas'>('abertas');
  const [busy, setBusy] = useState<string | null>(null);
  const [liveStores, setLiveStores] = useState<Set<string>>(new Set());
  const { activeCompanyId } = useCompany();

  const load = useCallback(async () => {
    let q = supabase.from('vw_ruptura_alerts').select('*').order('opened_at', { ascending: false }).limit(100);
    if (activeCompanyId) q = q.eq('company_id', activeCompanyId);
    const { data } = await q;
    setAlertas((data as Alerta[]) || []);
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  // alerta chega em tempo real (RLS: só as do rep)
  useEffect(() => {
    const ch = supabase.channel('rupturas-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'promoter_incidents' }, () => {
        toast.error('🚨 Nova ocorrência do promotor!', { duration: 6000 });
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // selo "na loja agora" atualiza ao vivo pelo broadcast do promotor
  useEffect(() => subscribeVisitLive(p => {
    setLiveStores(prev => { const n = new Set(prev); if (p.type === 'checkin') n.add(p.clientId); else n.delete(p.clientId); return n; });
  }), []);

  async function abrirConversa(a: Alerta) {
    setBusy(a.id);
    const { data, error } = await supabase.rpc('open_ruptura_chat', { p_incident_id: a.id });
    setBusy(null);
    if (error || !data) { toast.error('Não foi possível abrir a conversa: ' + (error?.message || '')); return; }
    onOpenChat(data as string);
  }

  async function marcarResolvida(a: Alerta) {
    setBusy(a.id);
    const { error } = await supabase.from('promoter_incidents').update({ status: 'resolvida', closed_at: new Date().toISOString() }).eq('id', a.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    load();
  }

  const abertas = alertas.filter(a => !['resolvida', 'cancelada'].includes(a.status));
  const resolvidas = alertas.filter(a => ['resolvida', 'cancelada'].includes(a.status));
  const shown = tab === 'abertas' ? abertas : resolvidas;

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a4240e]" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-[#a4240e]" /> Rupturas</h2>
        <div className="flex bg-white border border-gray-200 rounded-xl text-sm font-semibold overflow-hidden">
          {(['abertas', 'resolvidas'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 ${tab === t ? 'bg-[#a4240e] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {t === 'abertas' ? `Abertas (${abertas.length})` : `Resolvidas (${resolvidas.length})`}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          <Store className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">{tab === 'abertas' ? 'Nenhuma ruptura aberta. Quando o promotor encontrar falta total na gôndola, o alerta chega aqui na hora.' : 'Nenhuma resolvida ainda.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(a => {
            const naLoja = a.na_loja_agora || liveStores.has(a.representative_client_id);
            const fotos = (a.fotos || []).slice(0, 4);
            return (
              <div key={a.id} className={`bg-white border rounded-xl p-4 ${a.category === 'ruptura_total' && tab === 'abertas' ? 'border-red-300' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  <img src={a.product_image || '/saporino-logo.png'} className="w-14 h-14 object-cover rounded-lg border border-gray-100 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${a.category === 'ruptura_total' ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800'}`}>{CAT_LABEL[a.category] || a.category}</span>
                      {naLoja && tab === 'abertas' && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> promotor está na loja agora</span>}
                      {a.status === 'resolvida' && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ resolvida{a.converted_to_order_id ? ' — virou pedido' : ''}</span>}
                    </div>
                    <p className="font-semibold text-gray-900 text-sm mt-1 truncate">{a.product_name || 'Ocorrência'} · {a.loja}</p>
                    <p className="text-xs text-gray-500">{a.promoter_name ? `por ${a.promoter_name} · ` : ''}{new Date(a.opened_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                    {a.description && <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                      <span className="text-gray-600">Último pedido deste SKU: <strong>{a.ultimo_pedido_em ? new Date(a.ultimo_pedido_em).toLocaleDateString('pt-BR') : 'nunca'}</strong></span>
                      <span className="text-gray-600">Volume médio: <strong>{a.volume_medio != null ? `${a.volume_medio} un.` : '—'}</strong></span>
                    </div>
                  </div>
                </div>
                {fotos.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {fotos.map((f, i) => (
                      <a key={i} href={f.url} target="_blank" rel="noreferrer"><img src={f.url} className="w-20 h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0" title={f.kind} /></a>
                    ))}
                  </div>
                )}
                {tab === 'abertas' && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={() => abrirConversa(a)} disabled={busy === a.id}
                      className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 bg-white border-2 border-[#a4240e] text-[#a4240e] text-sm font-bold py-2.5 rounded-xl disabled:opacity-50">
                      <MessageCircle className="w-4 h-4" /> Abrir conversa
                    </button>
                    <button onClick={() => onGenerateOrder({ id: a.id, clientId: a.representative_client_id, productId: a.product_id, productName: a.product_name })}
                      className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 bg-[#a4240e] hover:bg-[#8a1f0c] text-white text-sm font-bold py-2.5 rounded-xl">
                      <ShoppingCart className="w-4 h-4" /> Gerar pedido
                    </button>
                    <button onClick={() => marcarResolvida(a)} disabled={busy === a.id} title="Marcar como resolvida sem pedido"
                      className="inline-flex items-center justify-center gap-1 text-xs text-gray-500 border border-gray-200 px-3 rounded-xl hover:bg-gray-50 disabled:opacity-50">
                      <CheckCircle className="w-3.5 h-3.5" /> resolver
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
