import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { guide } from '../../lib/guide';
import { useCompany } from '../../contexts/CompanyContext';
import { AlertTriangle, Plus, MessageCircle } from 'lucide-react';

// Bloco 5 — Ocorrências do promotor: abre manual, vê as próprias e responde na conversa.
// NUNCA vê pedido, valor ou desfecho comercial (view vw_promoter_incidents omite tudo isso).

interface Inc { id: string; category: string; priority: string; description: string | null; status: string; opened_at: string; loja: string | null; product_name: string | null; }
interface StoreOpt { id: string; nome: string; company_id: string | null; }
interface ProdOpt { id: string; name: string; }

const CATS: [string, string][] = [
  ['ruptura_gondola', 'Ruptura de gôndola'], ['sem_etiqueta', 'Sem etiqueta'], ['preco_incorreto', 'Preço incorreto'],
  ['avaria', 'Avaria'], ['vencimento', 'Vencimento'], ['risco_vencimento', 'Risco de vencimento'],
  ['pedido_nao_entregue', 'Pedido não entregue'], ['fora_do_cadastro', 'Fora do cadastro'], ['falta_espaco', 'Falta de espaço'],
  ['concorrente_no_espaco', 'Concorrente no espaço'], ['nao_autorizado', 'Não autorizado'], ['material_ausente', 'Material ausente'],
  ['manutencao', 'Manutenção'], ['outro', 'Outro'],
];
const ST_LABEL: Record<string, string> = { aberta: 'Aberta', em_analise: 'Em análise', aguardando_loja: 'Aguardando loja', aguardando_comercial: 'Aguardando comercial', resolvida: 'Resolvida', cancelada: 'Cancelada' };
const ST_CLS: Record<string, string> = { aberta: 'bg-red-100 text-red-700', em_analise: 'bg-blue-100 text-blue-700', aguardando_loja: 'bg-amber-100 text-amber-700', aguardando_comercial: 'bg-amber-100 text-amber-700', resolvida: 'bg-green-100 text-green-700', cancelada: 'bg-gray-100 text-gray-500' };

export default function PromotorOcorrencias({ promoterId, onOpenChat }: { promoterId: string; onOpenChat: (convId: string) => void }) {
  const { activeCompanyId } = useCompany();
  const [incs, setIncs] = useState<Inc[]>([]);
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [prods, setProds] = useState<ProdOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [f, setF] = useState({ storeId: '', category: '', productId: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    const [{ data: is }, { data: sts }, { data: ps }] = await Promise.all([
      supabase.from('vw_promoter_incidents').select('*').eq('company_id', activeCompanyId).order('opened_at', { ascending: false }).limit(60),
      supabase.from('vw_promoter_stores').select('id,razao_social,nome_fantasia,company_id').eq('company_id', activeCompanyId),
      supabase.from('vw_promoter_products').select('id,name').eq('company_id', activeCompanyId),
    ]);
    setIncs((is as Inc[]) || []);
    setStores(((sts as any[]) || []).map(s => ({ id: s.id, nome: s.nome_fantasia || s.razao_social, company_id: s.company_id })));
    setProds(((ps as any[]) || []));
    setLoading(false);
  }, [activeCompanyId]);
  useEffect(() => { load(); }, [load]);

  async function abrir() {
    if (!f.storeId || !f.category || !f.description.trim()) { setErr('Escolha a loja, a categoria e descreva o problema.'); return; }
    setBusy(true); setErr('');
    // o representante da loja é atribuído automaticamente
    const store = stores.find(s => s.id === f.storeId);
    const { data: sv } = await supabase.from('vw_promoter_stores').select('representative_id').eq('id', f.storeId).maybeSingle();
    const { error } = await supabase.from('promoter_incidents').insert({
      promoter_id: promoterId, representative_client_id: f.storeId,
      assigned_representative_id: (sv as any)?.representative_id ?? null,
      product_id: f.productId || null, company_id: store?.company_id ?? null,
      category: f.category, priority: 'normal', description: f.description.trim(), status: 'aberta',
    });
    setBusy(false);
    if (error) { setErr('Erro: ' + error.message); return; }
    guide('Ocorrência aberta', 'Vai para o Representante da loja (conversa no produto) e para o Admin (sino de notificações)');
    setShowNew(false); setF({ storeId: '', category: '', productId: '', description: '' });
    load();
  }

  async function conversar(inc: Inc) {
    const { data, error } = await supabase.rpc('open_ruptura_chat', { p_incident_id: inc.id });
    if (error || !data) { setErr('Não foi possível abrir a conversa.'); return; }
    onOpenChat(data as string);
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B2214]" /></div>;

  return (
    <div className="space-y-3 pb-6">
      <div className="flex items-center justify-between">
        <p className="font-bold text-gray-900 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-[#8B2214]" /> Ocorrências</p>
        <button onClick={() => setShowNew(o => !o)} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#8B2214] rounded-lg px-3 py-2"><Plus className="w-3.5 h-3.5" /> Abrir ocorrência</button>
      </div>
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
      {showNew && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <select value={f.storeId} onChange={e => setF(p => ({ ...p, storeId: e.target.value }))} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl">
            <option value="">Loja…</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <select value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl">
            <option value="">Categoria…</option>
            {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={f.productId} onChange={e => setF(p => ({ ...p, productId: e.target.value }))} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-xl">
            <option value="">Produto (opcional)…</option>
            {prods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <textarea value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Descreva o problema…" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
          <button onClick={abrir} disabled={busy} className="w-full bg-[#8B2214] text-white font-bold py-3 rounded-xl disabled:opacity-50">{busy ? 'Enviando…' : 'Abrir ocorrência'}</button>
        </div>
      )}
      {incs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">Nenhuma ocorrência. As rupturas totais da auditoria entram aqui sozinhas.</div>
      ) : incs.map(i => (
        <div key={i.id} className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ST_CLS[i.status] || 'bg-gray-100 text-gray-500'}`}>{ST_LABEL[i.status] || i.status}</span>
            <span className="text-[11px] text-gray-400">{new Date(i.opened_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-1">{CATS.find(c => c[0] === i.category)?.[1] || i.category}{i.product_name ? ` — ${i.product_name}` : ''}</p>
          <p className="text-xs text-gray-500">{i.loja}</p>
          {i.description && <p className="text-xs text-gray-500 mt-0.5">{i.description}</p>}
          <button onClick={() => conversar(i)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B2214] border border-[#ddd0cc] bg-[#f8f7f5] rounded-lg px-2.5 py-1.5">
            <MessageCircle className="w-3.5 h-3.5" /> Conversar com o representante
          </button>
        </div>
      ))}
    </div>
  );
}
