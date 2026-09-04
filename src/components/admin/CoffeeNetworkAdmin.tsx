// Painel operacional da COFICO — Coffee Network (Vertical Slice 001).
// Ofertas, moderação, solicitações de compra, matches e participantes da rede.
// "Converter em cliente" cria uma relação comercial por empresa, sem duplicar cadastro.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import {
  Coffee, Search, ShoppingCart, Users, Check, X, RefreshCw,
  Clock, AlertTriangle, Building2, Loader2, Plus, Image as ImageIcon, Upload,
} from 'lucide-react';
import { signedUrl } from '../../lib/storageUrl';

type SubTab = 'ofertas' | 'solicitacoes' | 'matches' | 'participantes';

interface Offer {
  id: string; entity_id: string; species: string; harvest_year: number | null;
  quantity_bags: number; bebida: string | null; screen_min: number | null;
  process: string | null; sca_score: number | null; asking_price_brl_bag: number | null;
  origin_municipio: string | null; origin_uf: string | null; region_label: string | null;
  status: string; exclusive_until: string | null; published_at: string | null;
  moderation_note: string | null; created_at: string;
  network_entities?: { legal_name: string; display_name: string | null } | null;
}

interface Request {
  id: string; entity_id: string; species: string; quantity_bags: number;
  bebida_min: string | null; screen_min: number | null; process_accepted: string[];
  target_price_min: number | null; target_price_max: number | null;
  origin_uf: string | null; destination_uf: string | null; status: string; created_at: string;
  network_entities?: { legal_name: string } | null;
}

interface Factor { fator: string; resultado: string; peso: number; ganho: number; detalhe?: string }

interface Match {
  id: string; offer_id: string; request_id: string; score: number;
  factors: Factor[]; status: string; computed_at: string;
}

interface Entity {
  id: string; entity_type: string; legal_name: string; display_name: string | null;
  document_type: string | null; document_number: string | null;
  email: string | null; phone: string | null; municipio: string | null; uf: string | null;
  status: string; created_at: string;
  network_entity_roles?: { role_code: string }[];
  commercial_accounts?: { id: string; company_id: string; relationship_type: string }[];
}

interface Company { id: string; name: string; order_prefix: string | null; is_operator: boolean }

interface Photo {
  id: string; offer_id: string; storage_path: string;
  moderation_status: string; moderation_note: string | null;
}

const ROLE_OPTIONS = [
  'produtor', 'propriedade', 'comprador', 'torrefacao', 'comerciante', 'exportador',
  'fornecedor', 'prestador', 'transportadora', 'anunciante', 'representante',
];
const BEBIDAS = [
  ['estritamente_mole', 'Estritamente mole'], ['mole', 'Mole'], ['apenas_mole', 'Apenas mole'],
  ['duro', 'Duro'], ['riado', 'Riado'], ['rio', 'Rio'], ['rio_zona', 'Rio zona'],
];
const PROCESSOS = [
  ['natural', 'Natural'], ['cd', 'Cereja descascado'], ['lavado', 'Lavado'],
  ['despolpado', 'Despolpado'], ['semi_lavado', 'Semi-lavado'],
];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho', pending_review: 'Aguardando revisão', approved: 'Aprovada',
  active: 'Ativa', paused: 'Pausada', matched: 'Com match', negotiating: 'Em negociação',
  sold: 'Vendida', expired: 'Expirada', rejected: 'Rejeitada', closed: 'Encerrada',
};
const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-gray-100 text-gray-600',
  sold: 'bg-purple-100 text-purple-800',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
};
const PROCESS_LABEL: Record<string, string> = {
  natural: 'Natural', cd: 'Cereja descascado', lavado: 'Lavado',
  despolpado: 'Despolpado', semi_lavado: 'Semi-lavado',
};

const brl = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Badge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Janela({ until }: { until: string | null }) {
  if (!until) return null;
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return <span className="text-xs text-gray-400">janela encerrada</span>;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return (
    <span className="text-xs text-[#8B2214] inline-flex items-center gap-1">
      <Clock className="w-3 h-3" /> exclusividade: {h}h{String(m).padStart(2, '0')}
    </span>
  );
}

export default function CoffeeNetworkAdmin() {
  const [sub, setSub] = useState<SubTab>('ofertas');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [convert, setConvert] = useState<Entity | null>(null);
  const [novoParticipante, setNovoParticipante] = useState(false);
  const [novaOferta, setNovaOferta] = useState(false);
  const [novaSolicitacao, setNovaSolicitacao] = useState(false);
  const [expandida, setExpandida] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, r, m, e, c, p] = await Promise.all([
      supabase.from('coffee_offers')
        .select('*, network_entities(legal_name, display_name)')
        .order('created_at', { ascending: false }),
      supabase.from('coffee_purchase_requests')
        .select('*, network_entities(legal_name)')
        .order('created_at', { ascending: false }),
      supabase.from('coffee_matches').select('*').order('score', { ascending: false }),
      supabase.from('network_entities')
        .select('*, network_entity_roles(role_code), commercial_accounts(id, company_id, relationship_type)')
        .order('created_at', { ascending: false }),
      supabase.from('companies').select('id, name, order_prefix, is_operator').order('name'),
      supabase.from('coffee_offer_photos').select('*').order('created_at'),
    ]);
    if (o.error) toast.error('Falha ao carregar ofertas: ' + o.error.message);
    setOffers((o.data as Offer[]) ?? []);
    setRequests((r.data as Request[]) ?? []);
    setMatches((m.data as Match[]) ?? []);
    setEntities((e.data as Entity[]) ?? []);
    setCompanies((c.data as Company[]) ?? []);
    setPhotos((p.data as Photo[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function moderar(offer: Offer, decision: 'approve' | 'reject' | 'request_changes') {
    const note = decision === 'approve'
      ? window.prompt('Observação da moderação (opcional):') ?? null
      : window.prompt(decision === 'reject' ? 'Motivo da rejeição:' : 'O que precisa ser alterado?');
    if (decision !== 'approve' && !note) return;
    setBusy(offer.id);
    const { error } = await supabase.rpc('coffee_offer_moderate', {
      p_offer_id: offer.id, p_decision: decision, p_note: note,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(decision === 'approve' ? 'Oferta aprovada.' : 'Decisão registrada.');
    load();
  }

  async function publicar(offer: Offer) {
    setBusy(offer.id);
    const { error } = await supabase.rpc('coffee_offer_publish', { p_offer_id: offer.id, p_hours: 24 });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success('Oferta publicada com janela de 24 horas.');
    load();
  }

  async function darBaixa(offer: Offer) {
    const note = window.prompt('Observação da baixa (ex.: vendida por fora, para quem, quando):');
    if (note === null) return;
    setBusy(offer.id);
    const { error } = await supabase.rpc('coffee_offer_mark_sold', {
      p_offer_id: offer.id, p_externally: true, p_note: note,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success('Baixa registrada.');
    load();
  }

  async function pausar(offer: Offer, novo: 'paused' | 'active') {
    setBusy(offer.id);
    const { error } = await supabase.from('coffee_offers')
      .update({ status: novo, updated_at: new Date().toISOString() }).eq('id', offer.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    load();
  }

  async function recalcular(req: Request) {
    setBusy(req.id);
    const { data, error } = await supabase.rpc('coffee_compute_matches', {
      p_request_id: req.id, p_min_score: 50,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`${data ?? 0} match(es) encontrados.`);
    setSub('matches');
    load();
  }

  async function converter(entity: Entity, companyId: string, tipo: string) {
    setBusy(entity.id);
    const { error } = await supabase.rpc('network_convert_to_client', {
      p_entity_id: entity.id, p_company_id: companyId, p_relationship_type: tipo,
      p_reason: 'Conversão pelo painel COFICO',
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    const empresa = companies.find(c => c.id === companyId)?.name ?? 'empresa';
    toast.success(`Relação comercial criada com ${empresa}. O cadastro não foi duplicado.`);
    setConvert(null);
    load();
  }

  async function enviarParaRevisao(offer: Offer) {
    setBusy(offer.id);
    const { error } = await supabase.from('coffee_offers')
      .update({ status: 'pending_review', updated_at: new Date().toISOString() }).eq('id', offer.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success('Oferta enviada para revisão da COFICO.');
    load();
  }

  async function subirFoto(offer: Offer, file: File) {
    setBusy(offer.id);
    const nome = file.name.replace(/[^\w.\-]+/g, '_').slice(-60);
    const path = `${offer.id}/${Date.now()}-${nome}`;
    const up = await supabase.storage.from('offer-photos').upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(null); return toast.error(up.error.message); }
    const { error } = await supabase.from('coffee_offer_photos')
      .insert({ offer_id: offer.id, storage_path: path, kind: 'lote' });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success('Foto enviada. Fica pendente até a COFICO aprovar.');
    load();
  }

  async function moderarFoto(photo: Photo, decision: 'approve' | 'reject') {
    const note = decision === 'reject' ? window.prompt('Motivo da reprovação da foto:') : null;
    if (decision === 'reject' && !note) return;
    setBusy(photo.id);
    const { error } = await supabase.rpc('coffee_offer_photo_moderate', {
      p_photo_id: photo.id, p_decision: decision, p_note: note,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(decision === 'approve' ? 'Foto aprovada.' : 'Foto reprovada.');
    load();
  }

  const pendentes = offers.filter(o => o.status === 'pending_review');
  const SUBS: { id: SubTab; label: string; icon: typeof Coffee; count: number }[] = [
    { id: 'ofertas', label: 'Ofertas', icon: Coffee, count: offers.length },
    { id: 'solicitacoes', label: 'Solicitações', icon: ShoppingCart, count: requests.length },
    { id: 'matches', label: 'Matches', icon: Search, count: matches.length },
    { id: 'participantes', label: 'Participantes', icon: Users, count: entities.length },
  ];

  return (
    <div className="min-h-screen bg-[#f8f7f5] p-4 md:p-6">
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">COFICO Coffee Network</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Oferta de café, solicitação de compra e match. A COFICO intermedia: as partes não
            trocam contato entre si.
          </p>
        </div>
        <div className="flex gap-2">
          {sub === 'ofertas' && (
            <button onClick={() => setNovaOferta(true)}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-[#8B2214] text-white hover:bg-[#6d1a10]">
              <Plus className="w-4 h-4" /> Nova oferta
            </button>
          )}
          {sub === 'solicitacoes' && (
            <button onClick={() => setNovaSolicitacao(true)}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-[#8B2214] text-white hover:bg-[#6d1a10]">
              <Plus className="w-4 h-4" /> Nova solicitação
            </button>
          )}
          {sub === 'participantes' && (
            <button onClick={() => setNovoParticipante(true)}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-[#8B2214] text-white hover:bg-[#6d1a10]">
              <Plus className="w-4 h-4" /> Novo participante
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </div>

      {pendentes.length > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {pendentes.length} oferta(s) aguardando revisão da COFICO. Nada é publicado sem gate humano.
        </div>
      )}

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {SUBS.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition ${
              sub === s.id ? 'bg-[#8B2214] text-white border-[#8B2214]'
                           : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
            <s.icon className="w-4 h-4" /> {s.label}
            <span className={`text-xs px-1.5 rounded-full ${sub === s.id ? 'bg-white/20' : 'bg-gray-100'}`}>{s.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : (
        <>
          {sub === 'ofertas' && (
            <div className="space-y-3">
              {offers.length === 0 && <p className="text-sm text-gray-500">Nenhuma oferta cadastrada.</p>}
              {offers.map(o => (
                <div key={o.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">
                          {o.quantity_bags} sacas · {o.species === 'arabica' ? 'Arábica' : 'Conilon'}
                        </span>
                        <Badge status={o.status} />
                        <Janela until={o.status === 'active' ? o.exclusive_until : null} />
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {o.network_entities?.legal_name ?? '—'} · {o.origin_municipio}/{o.origin_uf}
                        {o.region_label ? ` · ${o.region_label}` : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Safra {o.harvest_year ?? '—'} · bebida {o.bebida ?? '—'} · peneira {o.screen_min ?? '—'}+
                        {o.process ? ` · ${PROCESS_LABEL[o.process] ?? o.process}` : ''}
                        {o.sca_score ? ` · SCA ${o.sca_score}` : ''} · pedido {brl(o.asking_price_brl_bag)}/saca
                      </p>
                      {o.moderation_note && (
                        <p className="text-xs text-gray-500 mt-1 italic">Moderação: {o.moderation_note}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {o.status === 'pending_review' && (
                        <>
                          <button onClick={() => moderar(o, 'approve')} disabled={busy === o.id}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#8B2214] text-white hover:bg-[#6d1a10] disabled:opacity-50">
                            <Check className="w-3.5 h-3.5" /> Aprovar
                          </button>
                          <button onClick={() => moderar(o, 'request_changes')} disabled={busy === o.id}
                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                            Pedir alteração
                          </button>
                          <button onClick={() => moderar(o, 'reject')} disabled={busy === o.id}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50">
                            <X className="w-3.5 h-3.5" /> Rejeitar
                          </button>
                        </>
                      )}
                      {o.status === 'approved' && (
                        <button onClick={() => publicar(o)} disabled={busy === o.id}
                          className="text-xs px-3 py-1.5 rounded-lg bg-[#8B2214] text-white hover:bg-[#6d1a10] disabled:opacity-50">
                          Publicar (24h)
                        </button>
                      )}
                      {o.status === 'active' && (
                        <>
                          <button onClick={() => pausar(o, 'paused')} disabled={busy === o.id}
                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">Pausar</button>
                          <button onClick={() => darBaixa(o)} disabled={busy === o.id}
                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">Marcar vendida</button>
                        </>
                      )}
                      {o.status === 'paused' && (
                        <button onClick={() => pausar(o, 'active')} disabled={busy === o.id}
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">Reativar</button>
                      )}
                      {o.status === 'draft' && (
                        <button onClick={() => enviarParaRevisao(o)} disabled={busy === o.id}
                          className="text-xs px-3 py-1.5 rounded-lg bg-[#8B2214] text-white hover:bg-[#6d1a10] disabled:opacity-50">
                          Enviar para revisão
                        </button>
                      )}
                      <button onClick={() => setExpandida(expandida === o.id ? null : o.id)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                        <ImageIcon className="w-3.5 h-3.5" />
                        Fotos ({photos.filter(p => p.offer_id === o.id).length})
                      </button>
                    </div>
                  </div>

                  {expandida === o.id && (
                    <OfferPhotos offer={o} photos={photos.filter(p => p.offer_id === o.id)}
                      busy={busy} onUpload={subirFoto} onModerate={moderarFoto} />
                  )}
                </div>
              ))}
            </div>
          )}

          {sub === 'solicitacoes' && (
            <div className="space-y-3">
              {requests.length === 0 && <p className="text-sm text-gray-500">Nenhuma solicitação de compra.</p>}
              {requests.map(r => (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-start gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        {r.quantity_bags} sacas · {r.species === 'arabica' ? 'Arábica' : 'Conilon'}
                      </span>
                      <Badge status={r.status} />
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{r.network_entities?.legal_name ?? '—'}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      bebida mín. {r.bebida_min ?? '—'} · peneira {r.screen_min ?? '—'}+
                      {r.process_accepted?.length ? ` · processos: ${r.process_accepted.map(p => PROCESS_LABEL[p] ?? p).join(', ')}` : ''}
                      {r.origin_uf ? ` · origem ${r.origin_uf}` : ''}
                      {r.destination_uf ? ` · destino ${r.destination_uf}` : ''}
                      {r.target_price_max ? ` · até ${brl(r.target_price_max)}/saca` : ''}
                    </p>
                  </div>
                  <button onClick={() => recalcular(r)} disabled={busy === r.id}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#8B2214] text-white hover:bg-[#6d1a10] disabled:opacity-50">
                    {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Buscar matches
                  </button>
                </div>
              ))}
            </div>
          )}

          {sub === 'matches' && (
            <div className="space-y-3">
              {matches.length === 0 && (
                <p className="text-sm text-gray-500">
                  Nenhum match. Abra uma solicitação e use “Buscar matches”.
                </p>
              )}
              {matches.map(m => {
                const o = offers.find(x => x.id === m.offer_id);
                const r = requests.find(x => x.id === m.request_id);
                return (
                  <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <span className="text-2xl font-bold text-[#8B2214]">{Math.round(m.score)}%</span>
                      <span className="text-sm text-gray-700">compatível</span>
                      <Badge status={m.status} />
                    </div>
                    <p className="text-sm text-gray-600">
                      Oferta: {o ? `${o.quantity_bags} sacas de ${o.network_entities?.legal_name ?? '—'} (${o.origin_municipio}/${o.origin_uf})` : m.offer_id}
                    </p>
                    <p className="text-sm text-gray-600 mb-3">
                      Solicitação: {r ? `${r.quantity_bags} sacas para ${r.network_entities?.legal_name ?? '—'} (${r.destination_uf ?? '—'})` : m.request_id}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(m.factors ?? []).map((f, i) => (
                        <span key={i}
                          className={`text-xs px-2 py-1 rounded-lg border ${
                            f.ganho === f.peso ? 'bg-green-50 border-green-200 text-green-800'
                              : f.ganho > 0 ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          {f.fator}: {f.resultado}{f.detalhe ? ` (${f.detalhe})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sub === 'participantes' && (
            <div className="space-y-3">
              {entities.length === 0 && <p className="text-sm text-gray-500">Nenhum participante cadastrado.</p>}
              {entities.map(e => (
                <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-start gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{e.legal_name}</span>
                      <Badge status={e.status} />
                      <span className="text-xs text-gray-500">
                        {e.entity_type === 'organization' ? 'Organização' : 'Pessoa'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {e.document_type ? `${e.document_type.toUpperCase()} ${e.document_number}` : 'sem documento'}
                      {e.municipio ? ` · ${e.municipio}/${e.uf}` : ''}
                      {e.email ? ` · ${e.email}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(e.network_entity_roles ?? []).map(r => (
                        <span key={r.role_code} className="text-xs px-2 py-0.5 rounded-lg bg-[#f5f0ef] text-[#8B2214]">
                          {r.role_code}
                        </span>
                      ))}
                      {(e.commercial_accounts ?? []).map(a => {
                        const comp = companies.find(c => c.id === a.company_id);
                        return (
                          <span key={a.id} className="text-xs px-2 py-0.5 rounded-lg bg-green-50 text-green-800 border border-green-200 inline-flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {a.relationship_type} · {comp?.name ?? a.company_id}
                          </span>
                        );
                      })}
                      {(e.commercial_accounts ?? []).length === 0 && (
                        <span className="text-xs text-gray-400">só participante da rede — não é cliente de ninguém</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setConvert(e)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#8B2214] text-white hover:bg-[#6d1a10]">
                    Converter em cliente
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {convert && (
        <ConvertModal entity={convert} companies={companies} busy={busy === convert.id}
          onClose={() => setConvert(null)} onConfirm={converter} />
      )}
      {novoParticipante && (
        <NovoParticipanteModal onClose={() => setNovoParticipante(false)} onSaved={() => { setNovoParticipante(false); load(); }} />
      )}
      {novaOferta && (
        <NovaOfertaModal entities={entities} onClose={() => setNovaOferta(false)}
          onSaved={() => { setNovaOferta(false); load(); }} />
      )}
      {novaSolicitacao && (
        <NovaSolicitacaoModal entities={entities} onClose={() => setNovaSolicitacao(false)}
          onSaved={() => { setNovaSolicitacao(false); load(); }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fotos da oferta — bucket privado, exibidas por signed URL. Gate humano da COFICO.
// ---------------------------------------------------------------------------
function OfferPhotos({ offer, photos, busy, onUpload, onModerate }: {
  offer: Offer; photos: Photo[]; busy: string | null;
  onUpload: (o: Offer, f: File) => void;
  onModerate: (p: Photo, d: 'approve' | 'reject') => void;
}) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  useEffect(() => {
    let alive = true;
    Promise.all(photos.map(async p => [p.id, await signedUrl('offer-photos', p.storage_path)] as const))
      .then(pairs => { if (alive) setUrls(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [photos.map(p => p.id).join(',')]);

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="text-xs text-gray-500">
          Toda foto passa por aprovação humana da COFICO antes de circular. Bucket privado.
        </p>
        <label className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> Enviar foto
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            disabled={busy === offer.id}
            onChange={ev => { const f = ev.target.files?.[0]; if (f) onUpload(offer, f); ev.target.value = ''; }} />
        </label>
      </div>
      {photos.length === 0 ? (
        <p className="text-xs text-gray-400">Nenhuma foto enviada.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map(p => (
            <div key={p.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {urls[p.id]
                ? <img src={urls[p.id]!} alt="Foto do lote" className="w-full h-28 object-cover" />
                : <div className="w-full h-28 bg-gray-100 animate-pulse" />}
              <div className="p-2">
                <Badge status={p.moderation_status === 'approved' ? 'approved'
                  : p.moderation_status === 'rejected' ? 'rejected' : 'pending_review'} />
                {p.moderation_note && <p className="text-[11px] text-gray-500 mt-1">{p.moderation_note}</p>}
                {p.moderation_status === 'pending' && (
                  <div className="flex gap-1 mt-2">
                    <button onClick={() => onModerate(p, 'approve')} disabled={busy === p.id}
                      className="flex-1 text-[11px] px-2 py-1 rounded bg-[#8B2214] text-white hover:bg-[#6d1a10]">Aprovar</button>
                    <button onClick={() => onModerate(p, 'reject')} disabled={busy === p.id}
                      className="flex-1 text-[11px] px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50">Reprovar</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cadastros guiados (oferta assistida pela COFICO)
// ---------------------------------------------------------------------------
const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium text-gray-700 mb-1';

function Modal({ title, subtitle, children, onClose, onSave, busy, saveLabel = 'Salvar' }: {
  title: string; subtitle?: string; children: React.ReactNode;
  onClose: () => void; onSave: () => void; busy: boolean; saveLabel?: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={ev => ev.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onSave} disabled={busy}
            className="text-sm px-4 py-2 rounded-lg bg-[#8B2214] text-white hover:bg-[#6d1a10] disabled:opacity-50 inline-flex items-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function NovoParticipanteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    entity_type: 'person', legal_name: '', display_name: '', document_type: 'cpf',
    document_number: '', email: '', phone: '', municipio: '', uf: '', status: 'pending',
  });
  const [papeis, setPapeis] = useState<string[]>(['produtor']);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function salvar() {
    if (!f.legal_name.trim()) return toast.error('Informe o nome ou a razão social.');
    setBusy(true);
    const { data, error } = await supabase.from('network_entities').insert({
      ...f,
      display_name: f.display_name || null,
      document_number: f.document_number || null,
      email: f.email || null, phone: f.phone || null, whatsapp: f.phone || null,
      municipio: f.municipio || null, uf: f.uf ? f.uf.toUpperCase() : null,
      verified_at: f.status === 'verified' ? new Date().toISOString() : null,
    }).select('id').single();
    if (error) { setBusy(false); return toast.error(error.message); }
    if (papeis.length) {
      await supabase.from('network_entity_roles')
        .insert(papeis.map(role_code => ({ entity_id: data.id, role_code })));
    }
    setBusy(false);
    toast.success('Participante cadastrado. Ele NÃO é cliente de nenhuma empresa ainda.');
    onSaved();
  }

  return (
    <Modal title="Novo participante da rede" busy={busy} onClose={onClose} onSave={salvar}
      subtitle="Cadastro na rede não cria relação comercial. Para isso existe o botão “Converter em cliente”.">
      <div>
        <label className={labelCls}>Tipo</label>
        <select className={inputCls} value={f.entity_type} onChange={e => set('entity_type', e.target.value)}>
          <option value="person">Pessoa</option>
          <option value="organization">Organização</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Situação do cadastro</label>
        <select className={inputCls} value={f.status} onChange={e => set('status', e.target.value)}>
          <option value="pending">Pendente</option>
          <option value="verified">Verificado</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className={labelCls}>Nome completo / razão social *</label>
        <input className={inputCls} value={f.legal_name} onChange={e => set('legal_name', e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <label className={labelCls}>Nome de exibição (fantasia)</label>
        <input className={inputCls} value={f.display_name} onChange={e => set('display_name', e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Documento</label>
        <select className={inputCls} value={f.document_type} onChange={e => set('document_type', e.target.value)}>
          <option value="cpf">CPF</option>
          <option value="cnpj">CNPJ</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Número do documento</label>
        <input className={inputCls} value={f.document_number} onChange={e => set('document_number', e.target.value)} />
      </div>
      <div><label className={labelCls}>E-mail</label>
        <input className={inputCls} value={f.email} onChange={e => set('email', e.target.value)} /></div>
      <div><label className={labelCls}>Telefone / WhatsApp</label>
        <input className={inputCls} value={f.phone} onChange={e => set('phone', e.target.value)} /></div>
      <div><label className={labelCls}>Município</label>
        <input className={inputCls} value={f.municipio} onChange={e => set('municipio', e.target.value)} /></div>
      <div><label className={labelCls}>UF</label>
        <input className={inputCls} maxLength={2} value={f.uf} onChange={e => set('uf', e.target.value)} /></div>
      <div className="md:col-span-2">
        <label className={labelCls}>Papéis na rede</label>
        <div className="flex flex-wrap gap-1.5">
          {ROLE_OPTIONS.map(r => (
            <button key={r} type="button"
              onClick={() => setPapeis(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])}
              className={`text-xs px-2 py-1 rounded-lg border ${papeis.includes(r)
                ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white border-gray-200 text-gray-600'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function NovaOfertaModal({ entities, onClose, onSaved }: {
  entities: Entity[]; onClose: () => void; onSaved: () => void;
}) {
  const produtores = entities.filter(e =>
    (e.network_entity_roles ?? []).some(r => ['produtor', 'comerciante', 'exportador'].includes(r.role_code)));
  const [f, setF] = useState({
    entity_id: produtores[0]?.id ?? '', species: 'arabica', harvest_year: String(new Date().getFullYear()),
    quantity_bags: '', bebida: 'mole', screen_min: '16', process: 'cd', moisture_pct: '',
    defect_type: '', sca_score: '', asking_price_brl_bag: '', origin_municipio: '', origin_uf: '',
    region_label: '', sensory_notes: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  async function salvar() {
    if (!f.entity_id) return toast.error('Selecione o produtor.');
    if (!f.quantity_bags) return toast.error('Informe a quantidade em sacas.');
    setBusy(true);
    const { error } = await supabase.from('coffee_offers').insert({
      entity_id: f.entity_id, species: f.species,
      harvest_year: num(f.harvest_year), quantity_bags: Number(f.quantity_bags),
      bebida: f.bebida || null, screen_min: num(f.screen_min), process: f.process || null,
      moisture_pct: num(f.moisture_pct), defect_type: num(f.defect_type), sca_score: num(f.sca_score),
      asking_price_brl_bag: num(f.asking_price_brl_bag),
      origin_municipio: f.origin_municipio || null,
      origin_uf: f.origin_uf ? f.origin_uf.toUpperCase() : null,
      region_label: f.region_label || null, sensory_notes: f.sensory_notes || null,
      status: 'draft',
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Oferta criada como rascunho. Envie para revisão quando estiver completa.');
    onSaved();
  }

  return (
    <Modal title="Nova oferta de café" busy={busy} onClose={onClose} onSave={salvar} saveLabel="Criar rascunho"
      subtitle="Oferta assistida pela COFICO. Nasce como rascunho e só vai ao ar depois da moderação.">
      <div className="md:col-span-2">
        <label className={labelCls}>Produtor *</label>
        <select className={inputCls} value={f.entity_id} onChange={e => set('entity_id', e.target.value)}>
          {produtores.length === 0 && <option value="">Cadastre um participante com papel de produtor</option>}
          {produtores.map(p => <option key={p.id} value={p.id}>{p.legal_name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Espécie</label>
        <select className={inputCls} value={f.species} onChange={e => set('species', e.target.value)}>
          <option value="arabica">Arábica</option>
          <option value="conilon">Conilon</option>
        </select>
      </div>
      <div><label className={labelCls}>Safra</label>
        <input className={inputCls} value={f.harvest_year} onChange={e => set('harvest_year', e.target.value)} /></div>
      <div><label className={labelCls}>Quantidade (sacas de 60 kg) *</label>
        <input className={inputCls} value={f.quantity_bags} onChange={e => set('quantity_bags', e.target.value)} /></div>
      <div>
        <label className={labelCls}>Bebida</label>
        <select className={inputCls} value={f.bebida} onChange={e => set('bebida', e.target.value)}>
          {BEBIDAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div><label className={labelCls}>Peneira mínima</label>
        <input className={inputCls} value={f.screen_min} onChange={e => set('screen_min', e.target.value)} /></div>
      <div>
        <label className={labelCls}>Processo</label>
        <select className={inputCls} value={f.process} onChange={e => set('process', e.target.value)}>
          {PROCESSOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div><label className={labelCls}>Umidade (%)</label>
        <input className={inputCls} value={f.moisture_pct} onChange={e => set('moisture_pct', e.target.value)} /></div>
      <div><label className={labelCls}>Tipo / classificação</label>
        <input className={inputCls} value={f.defect_type} onChange={e => set('defect_type', e.target.value)} /></div>
      <div><label className={labelCls}>Pontuação SCA</label>
        <input className={inputCls} value={f.sca_score} onChange={e => set('sca_score', e.target.value)} /></div>
      <div><label className={labelCls}>Preço pedido (R$/saca)</label>
        <input className={inputCls} value={f.asking_price_brl_bag} onChange={e => set('asking_price_brl_bag', e.target.value)} /></div>
      <div><label className={labelCls}>Município de origem</label>
        <input className={inputCls} value={f.origin_municipio} onChange={e => set('origin_municipio', e.target.value)} /></div>
      <div><label className={labelCls}>UF de origem</label>
        <input className={inputCls} maxLength={2} value={f.origin_uf} onChange={e => set('origin_uf', e.target.value)} /></div>
      <div><label className={labelCls}>Região</label>
        <input className={inputCls} value={f.region_label} onChange={e => set('region_label', e.target.value)} /></div>
      <div className="md:col-span-2"><label className={labelCls}>Notas sensoriais</label>
        <textarea className={inputCls} rows={2} value={f.sensory_notes} onChange={e => set('sensory_notes', e.target.value)} /></div>
    </Modal>
  );
}

function NovaSolicitacaoModal({ entities, onClose, onSaved }: {
  entities: Entity[]; onClose: () => void; onSaved: () => void;
}) {
  const compradores = entities.filter(e =>
    (e.network_entity_roles ?? []).some(r => ['comprador', 'torrefacao', 'comerciante', 'exportador'].includes(r.role_code)));
  const [f, setF] = useState({
    entity_id: compradores[0]?.id ?? '', species: 'arabica', harvest_year: String(new Date().getFullYear()),
    quantity_bags: '', bebida_min: 'mole', screen_min: '16', moisture_max: '', defect_type_max: '',
    sca_min: '', target_price_min: '', target_price_max: '', origin_uf: '', destination_uf: '',
    destination_municipio: '', freight_terms: 'cif', sample_required: 'sim', notes: '',
  });
  const [processos, setProcessos] = useState<string[]>(['cd', 'lavado']);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  async function salvar() {
    if (!f.entity_id) return toast.error('Selecione o comprador.');
    if (!f.quantity_bags) return toast.error('Informe a quantidade desejada.');
    setBusy(true);
    const { error } = await supabase.from('coffee_purchase_requests').insert({
      entity_id: f.entity_id, species: f.species, harvest_year: num(f.harvest_year),
      quantity_bags: Number(f.quantity_bags), bebida_min: f.bebida_min || null,
      screen_min: num(f.screen_min), process_accepted: processos,
      moisture_max: num(f.moisture_max), defect_type_max: num(f.defect_type_max),
      sca_min: num(f.sca_min), target_price_min: num(f.target_price_min),
      target_price_max: num(f.target_price_max),
      origin_uf: f.origin_uf ? f.origin_uf.toUpperCase() : null,
      destination_uf: f.destination_uf ? f.destination_uf.toUpperCase() : null,
      destination_municipio: f.destination_municipio || null,
      freight_terms: f.freight_terms, sample_required: f.sample_required === 'sim',
      notes: f.notes || null, status: 'active',
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Solicitação criada e ativa. Use “Buscar matches”.');
    onSaved();
  }

  return (
    <Modal title="Nova solicitação de compra" busy={busy} onClose={onClose} onSave={salvar} saveLabel="Criar solicitação"
      subtitle="Ficha de Arábica comercial/especial. Café de escolha (Conilon/Robusta) tem ficha própria, ainda não implementada.">
      <div className="md:col-span-2">
        <label className={labelCls}>Comprador *</label>
        <select className={inputCls} value={f.entity_id} onChange={e => set('entity_id', e.target.value)}>
          {compradores.length === 0 && <option value="">Cadastre um participante com papel de comprador</option>}
          {compradores.map(p => <option key={p.id} value={p.id}>{p.legal_name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Espécie</label>
        <select className={inputCls} value={f.species} onChange={e => set('species', e.target.value)}>
          <option value="arabica">Arábica</option>
          <option value="conilon">Conilon</option>
        </select>
      </div>
      <div><label className={labelCls}>Safra</label>
        <input className={inputCls} value={f.harvest_year} onChange={e => set('harvest_year', e.target.value)} /></div>
      <div><label className={labelCls}>Volume desejado (sacas) *</label>
        <input className={inputCls} value={f.quantity_bags} onChange={e => set('quantity_bags', e.target.value)} /></div>
      <div>
        <label className={labelCls}>Bebida mínima</label>
        <select className={inputCls} value={f.bebida_min} onChange={e => set('bebida_min', e.target.value)}>
          {BEBIDAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div><label className={labelCls}>Peneira mínima</label>
        <input className={inputCls} value={f.screen_min} onChange={e => set('screen_min', e.target.value)} /></div>
      <div><label className={labelCls}>Umidade máxima (%)</label>
        <input className={inputCls} value={f.moisture_max} onChange={e => set('moisture_max', e.target.value)} /></div>
      <div><label className={labelCls}>Tipo máximo aceito</label>
        <input className={inputCls} value={f.defect_type_max} onChange={e => set('defect_type_max', e.target.value)} /></div>
      <div><label className={labelCls}>SCA mínimo</label>
        <input className={inputCls} value={f.sca_min} onChange={e => set('sca_min', e.target.value)} /></div>
      <div><label className={labelCls}>Preço alvo mínimo (R$/saca)</label>
        <input className={inputCls} value={f.target_price_min} onChange={e => set('target_price_min', e.target.value)} /></div>
      <div><label className={labelCls}>Preço alvo máximo (R$/saca)</label>
        <input className={inputCls} value={f.target_price_max} onChange={e => set('target_price_max', e.target.value)} /></div>
      <div><label className={labelCls}>UF de origem desejada</label>
        <input className={inputCls} maxLength={2} value={f.origin_uf} onChange={e => set('origin_uf', e.target.value)} /></div>
      <div><label className={labelCls}>UF de destino</label>
        <input className={inputCls} maxLength={2} value={f.destination_uf} onChange={e => set('destination_uf', e.target.value)} /></div>
      <div><label className={labelCls}>Município de destino</label>
        <input className={inputCls} value={f.destination_municipio} onChange={e => set('destination_municipio', e.target.value)} /></div>
      <div>
        <label className={labelCls}>Frete</label>
        <select className={inputCls} value={f.freight_terms} onChange={e => set('freight_terms', e.target.value)}>
          <option value="cif">CIF</option><option value="fob">FOB</option><option value="a_combinar">A combinar</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Exige amostra?</label>
        <select className={inputCls} value={f.sample_required} onChange={e => set('sample_required', e.target.value)}>
          <option value="sim">Sim</option><option value="nao">Não</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className={labelCls}>Processos aceitos</label>
        <div className="flex flex-wrap gap-1.5">
          {PROCESSOS.map(([v, l]) => (
            <button key={v} type="button"
              onClick={() => setProcessos(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
              className={`text-xs px-2 py-1 rounded-lg border ${processos.includes(v)
                ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white border-gray-200 text-gray-600'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="md:col-span-2"><label className={labelCls}>Observações</label>
        <textarea className={inputCls} rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
    </Modal>
  );
}

function ConvertModal({ entity, companies, busy, onClose, onConfirm }: {
  entity: Entity; companies: Company[]; busy: boolean;
  onClose: () => void; onConfirm: (e: Entity, companyId: string, tipo: string) => void;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? '');
  const [tipo, setTipo] = useState('cliente');
  const jaTem = (entity.commercial_accounts ?? []).some(a => a.company_id === companyId && a.relationship_type === tipo);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 w-full max-w-md" onClick={ev => ev.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-1">Converter em cliente</h3>
        <p className="text-sm text-gray-500 mb-4">
          {entity.legal_name}. O cadastro não é copiado: cria-se uma relação comercial ligada à
          mesma identidade. Condição comercial nunca é herdada de outra empresa.
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-1">Cliente de qual empresa?</label>
        <select value={companyId} onChange={ev => setCompanyId(ev.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3">
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.is_operator ? ' (operador)' : ''}</option>
          ))}
        </select>

        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de relação</label>
        <select value={tipo} onChange={ev => setTipo(ev.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4">
          <option value="cliente">Cliente</option>
          <option value="fornecedor">Fornecedor</option>
          <option value="prestador">Prestador</option>
          <option value="transportadora">Transportadora</option>
        </select>

        {jaTem && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            Já existe essa relação para esta empresa. Nada será duplicado.
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={() => onConfirm(entity, companyId, tipo)} disabled={busy || !companyId}
            className="text-sm px-4 py-2 rounded-lg bg-[#8B2214] text-white hover:bg-[#6d1a10] disabled:opacity-50 inline-flex items-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
