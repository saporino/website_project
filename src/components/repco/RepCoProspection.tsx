import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, ExternalLink, Globe2, Mail, MapPin, MessageCircle, Phone, RotateCcw, UserPlus, ChevronLeft, List } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { SEGMENT_LABEL } from '../../constants/segments';

interface ProspectLead {
  id: string;
  prospect_list_id: string;
  representative_id: string | null;
  representative_client_id: string | null;
  company_name: string;
  trade_name: string | null;
  cnpj: string | null;
  cpf: string | null;
  category: string | null;
  segment: string | null;
  address: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  raw_data: Record<string, unknown> | null;
  status: string;
  audit_notes: string | null;
  rejection_reason: string | null;
  visited_at: string | null;
  converted_at: string | null;
  created_at: string;
  prospect_lists?: { name: string; assigned_representative_id: string | null } | null;
}

interface Props {
  representativeId: string;
  currentLat?: number;
  currentLng?: number;
  previewMode?: boolean;
  refreshKey?: number;
}

interface ProspectListSummary {
  id: string;
  name: string;
  segment: string | null;
  pending_count: number;
  total_count: number;
  categories: string[];
}

interface ConvertForm {
  document: string;
  cnpj: string;
  cpf: string;
  razao_social: string;
  nome_fantasia: string;
  endereco_completo: string;
  whatsapp_comprador: string;
  email_comprador: string;
  segment: string;
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Novo',
  assigned: 'Atribuído',
  pending_visit: 'Voltar depois',
  in_progress: 'Em andamento',
  visited: 'Visitado',
  qualified: 'Qualificado',
  converted: 'Convertido',
  rejected: 'Não deu certo',
  duplicate: 'Duplicado',
  invalid: 'Inválido',
};

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  assigned: 'bg-amber-100 text-amber-700',
  pending_visit: 'bg-purple-100 text-purple-700',
  in_progress: 'bg-sky-100 text-sky-700',
  visited: 'bg-green-100 text-green-700',
  qualified: 'bg-emerald-100 text-emerald-700',
  converted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  duplicate: 'bg-gray-100 text-gray-600',
  invalid: 'bg-red-100 text-red-700',
};

const REJECTION_REASONS = [
  'Não existe no endereço',
  'Fechou',
  'Não é o mesmo negócio',
  'Gerente não estava',
  'Pediu para voltar depois',
  'Não tem interesse',
  'Já compra de outro fornecedor',
  'Telefone/endereço incorreto',
  'Outro',
];

const PROSPECT_SEGMENT_LABEL: Record<string, string> = {
  padaria: 'Padaria',
  cafeteria: 'cafeteria',
  food_service: 'Food service',
  hotelaria: 'Hotelaria',
  alimentacao_coletiva: 'Alimentação coletiva',
  distribuicao: 'Distribuição',
  varejo: 'Varejo',
  confeitaria: 'Confeitaria',
  institucional: 'Institucional',
  corporativo: 'Corporativo',
  outros: 'Outros',
};

const SELECT_FIELDS = `
  id, prospect_list_id, representative_id, representative_client_id, company_name, trade_name, cnpj, cpf, category, segment,
  address, number, district, city, state, zip_code, lat, lng,
  phone, whatsapp, email, website, raw_data, status, audit_notes, rejection_reason, visited_at, converted_at, created_at,
  prospect_lists(name, assigned_representative_id)
`;

const SELECT_LIST_FIELDS = `
  id, prospect_list_id, representative_id, representative_client_id, company_name, trade_name, cnpj, cpf, category, segment,
  address, number, district, city, state, zip_code, lat, lng,
  phone, whatsapp, email, website, raw_data, status, audit_notes, rejection_reason, visited_at, converted_at, created_at,
  prospect_lists!inner(name, assigned_representative_id)
`;

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildAddress(lead: ProspectLead) {
  return [lead.address, lead.number, lead.district, lead.city, lead.state].filter(Boolean).join(', ');
}

function formatDistance(km: number | null) {
  if (km === null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function getSegmentLabel(segment: string | null) {
  if (!segment) return '-';
  return PROSPECT_SEGMENT_LABEL[segment] || SEGMENT_LABEL[segment] || segment;
}

function normalizeKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalizeUrl(value: string | null) {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith('@')) return `https://instagram.com/${text.slice(1)}`;
  return `https://${text}`;
}

function cleanPhone(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

function digitsOnly(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
}

function toBrazilPhone(digits: string) {
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function getRawValue(rawData: Record<string, unknown> | null, aliases: string[]) {
  if (!rawData) return null;
  const normalizedAliases = aliases.map(normalizeKey);
  for (const [key, value] of Object.entries(rawData)) {
    if (!normalizedAliases.includes(normalizeKey(key))) continue;
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function collectRawUrls(rawData: Record<string, unknown> | null) {
  if (!rawData) return [];
  return Object.entries(rawData)
    .filter(([key]) => {
      const normalized = normalizeKey(key);
      return normalized.includes('url') || normalized.includes('website') || normalized.includes('site') || normalized.includes('instagram') || normalized.includes('facebook');
    })
    .map(([, value]) => (value === null || value === undefined ? '' : String(value).trim()))
    .filter(Boolean);
}

function getContactLinks(lead: ProspectLead) {
  const rawUrls = collectRawUrls(lead.raw_data);
  const websiteCandidates = [
    lead.website,
    getRawValue(lead.raw_data, ['website', 'site', 'url']),
    getRawValue(lead.raw_data, ['instagram', 'instagramUrl', 'instagram_url', 'socialLinks/instagram', 'sociallinks_instagram']),
    getRawValue(lead.raw_data, ['facebook', 'facebookUrl', 'facebook_url', 'socialLinks/facebook', 'sociallinks_facebook']),
    ...rawUrls,
  ].filter(Boolean) as string[];
  const links = new Map<string, { label: string; href: string; kind: 'instagram' | 'facebook' | 'site' }>();

  websiteCandidates.forEach(candidate => {
    const href = normalizeUrl(candidate);
    if (!href) return;
    const lower = href.toLowerCase();
    if (lower.includes('instagram.com')) {
      links.set('instagram', { label: 'Instagram', href, kind: 'instagram' });
    } else if (lower.includes('facebook.com') || lower.includes('fb.com')) {
      links.set('facebook', { label: 'Facebook', href, kind: 'facebook' });
    } else if (!links.has('site')) {
      links.set('site', { label: 'Site', href, kind: 'site' });
    }
  });

  return Array.from(links.values());
}

function getLeadPhone(lead: ProspectLead) {
  return (
    cleanPhone(lead.whatsapp) ||
    cleanPhone(lead.phone) ||
    cleanPhone(getRawValue(lead.raw_data, ['whatsapp', 'phone', 'phones/0', 'telefone', 'tel', 'mobile']))
  );
}

function getLeadEmail(lead: ProspectLead) {
  return lead.email || getRawValue(lead.raw_data, ['email', 'emails/0', 'e_mail']);
}

function getSortKey(lead: ProspectLead) {
  return [lead.city, lead.zip_code, lead.address, lead.company_name].filter(Boolean).join('|').toLowerCase();
}

function normalizeLeadRelation(lead: any): ProspectLead {
  const list = Array.isArray(lead.prospect_lists) ? lead.prospect_lists[0] : lead.prospect_lists;
  return { ...lead, prospect_lists: list || null } as ProspectLead;
}

function buildConvertForm(lead: ProspectLead): ConvertForm {
  const initialDocument = lead.cnpj || lead.cpf || '';
  return {
    document: initialDocument,
    cnpj: lead.cnpj || '',
    cpf: lead.cpf || '',
    razao_social: lead.company_name || lead.trade_name || '',
    nome_fantasia: lead.trade_name || '',
    endereco_completo: buildAddress(lead),
    whatsapp_comprador:
      lead.whatsapp ||
      lead.phone ||
      getRawValue(lead.raw_data, ['whatsapp', 'phone', 'phones/0', 'telefone', 'tel', 'mobile']) ||
      '',
    email_comprador: lead.email || getLeadEmail(lead) || '',
    segment: lead.segment || '',
  };
}

function classifyDocument(value: string) {
  const digits = digitsOnly(value);
  if (digits.length === 14) return { type: 'cnpj' as const, cnpj: digits, cpf: '' };
  if (digits.length === 11) return { type: 'cpf' as const, cnpj: '', cpf: digits };
  return { type: null, cnpj: '', cpf: '', digits };
}

export default function RepCoProspection({ representativeId, currentLat, currentLng, previewMode = false, refreshKey = 0 }: Props) {
  const [leads, setLeads] = useState<ProspectLead[]>([]);
  const [lists, setLists] = useState<ProspectListSummary[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rejectingLead, setRejectingLead] = useState<ProspectLead | null>(null);
  const [rejectReason, setRejectReason] = useState(REJECTION_REASONS[0]);
  const [rejectNote, setRejectNote] = useState('');
  const [convertingLead, setConvertingLead] = useState<ProspectLead | null>(null);
  const [convertForm, setConvertForm] = useState<ConvertForm | null>(null);
  const [converting, setConverting] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  // Seleção para "Planejar para Hoje"
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, [representativeId, refreshKey]);

  useEffect(() => {
    function handleProspectionUpdated(event: Event) {
      const detail = (event as CustomEvent<{ representativeId?: string }>).detail;
      if (!detail?.representativeId || detail.representativeId === representativeId) {
        fetchLeads();
      }
    }

    window.addEventListener('repco:prospection-updated', handleProspectionUpdated);
    window.addEventListener('focus', handleProspectionUpdated);
    return () => {
      window.removeEventListener('repco:prospection-updated', handleProspectionUpdated);
      window.removeEventListener('focus', handleProspectionUpdated);
    };
  }, [representativeId]);

  async function fetchLeads() {
    setLoading(true);
    const [
      { data: directLeads, error: directError },
      { data: listLeads, error: listError },
      { data: assignedLists },
    ] = await Promise.all([
      supabase
        .from('prospect_leads')
        .select(SELECT_FIELDS)
        .eq('representative_id', representativeId)
        .order('created_at', { ascending: false }),
      supabase
        .from('prospect_leads')
        .select(SELECT_LIST_FIELDS)
        .eq('prospect_lists.assigned_representative_id', representativeId)
        .order('created_at', { ascending: false }),
      supabase
        .from('prospect_lists')
        .select('id,name,segment,pending_count,total_count')
        .eq('assigned_representative_id', representativeId)
        .order('created_at', { ascending: false }),
    ]);

    if (directError || listError) {
      toast.error('Não foi possível carregar sua prospecção.');
      setLoading(false);
      return;
    }

    const merged = new Map<string, ProspectLead>();
    const allLeads = [...(directLeads || []), ...(listLeads || [])].map(normalizeLeadRelation);
    allLeads.forEach(lead => merged.set(lead.id, lead));
    const mergedLeads = Array.from(merged.values());
    setLeads(mergedLeads);

    // Montar sumário de listas com as categorias reais dos leads
    const listMap = new Map<string, Set<string>>();
    mergedLeads.forEach(l => {
      if (!l.prospect_list_id) return;
      if (!listMap.has(l.prospect_list_id)) listMap.set(l.prospect_list_id, new Set());
      if (l.category) listMap.get(l.prospect_list_id)!.add(l.category);
    });
    setLists(
      (assignedLists || []).map(pl => ({
        id: pl.id, name: pl.name, segment: pl.segment,
        pending_count: pl.pending_count ?? 0, total_count: pl.total_count ?? 0,
        categories: Array.from(listMap.get(pl.id) || []).slice(0, 4),
      }))
    );
    setLoading(false);
  }

  async function updateLead(lead: ProspectLead, updates: Partial<ProspectLead>) {
    if (previewMode) {
      toast.info('Ação desativada no espelho.');
      return;
    }
    setUpdatingId(lead.id);
    const { error } = await supabase.from('prospect_leads').update(updates).eq('id', lead.id);
    setUpdatingId(null);

    if (error) {
      toast.error('Não foi possível atualizar o lead.');
      return;
    }

    setLeads(current => current.map(item => (item.id === lead.id ? { ...item, ...updates } : item)));
    window.dispatchEvent(new CustomEvent('repco:prospection-updated', { detail: { representativeId, leadIds: [lead.id] } }));
    toast.success('Lead atualizado.');
  }

  function openDirections(lead: ProspectLead, app: 'google' | 'waze') {
    // Navega pelo NOME + endereço — mais confiável que coordenadas brutas do Apify,
    // que às vezes apontam para outro negócio na mesma quadra.
    const address = buildAddress(lead);
    const query = [lead.company_name || lead.trade_name, address].filter(Boolean).join(', ');
    const encoded = encodeURIComponent(query);
    const url =
      app === 'waze'
        ? `https://waze.com/ul?q=${encoded}&navigate=yes`
        : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    window.open(url, '_blank');
  }

  function handleCheckIn(lead: ProspectLead) {
    if (previewMode) {
      toast.info('Ação desativada no espelho.');
      return;
    }
    updateLead(lead, { status: 'visited', visited_at: new Date().toISOString() });
  }

  function openRejectModal(lead: ProspectLead) {
    if (previewMode) {
      toast.info('Ação desativada no espelho.');
      return;
    }
    setRejectingLead(lead);
    setRejectReason(REJECTION_REASONS[0]);
    setRejectNote('');
  }

  async function handleRejectSubmit() {
    if (!rejectingLead) return;
    const reason = rejectReason || REJECTION_REASONS[0];

    if (reason === 'Pediu para voltar depois') {
      await updateLead(rejectingLead, {
        status: 'pending_visit',
        audit_notes: rejectNote.trim()
          ? `${rejectingLead.audit_notes ? `${rejectingLead.audit_notes}\n` : ''}${reason}: ${rejectNote.trim()}`
          : `${rejectingLead.audit_notes ? `${rejectingLead.audit_notes}\n` : ''}${reason}`,
      });
      setRejectingLead(null);
      return;
    }

    await updateLead(rejectingLead, {
      status: 'rejected',
      rejection_reason: reason,
      audit_notes: rejectNote.trim() || rejectingLead.audit_notes,
    });
    setRejectingLead(null);
  }

  function handleReject(lead: ProspectLead) {
    openRejectModal(lead);
  }

  function handleReturnLater(lead: ProspectLead) {
    if (previewMode) {
      toast.info('Ação desativada no espelho.');
      return;
    }
    const note = 'Voltar depois';
    updateLead(lead, {
      status: 'pending_visit',
      audit_notes: lead.audit_notes ? `${lead.audit_notes}\n${note}` : note,
    });
  }

  function openConvertModal(lead: ProspectLead) {
    if (previewMode) {
      toast.info('Ação desativada no espelho.');
      return;
    }
    setConvertingLead(lead);
    setConvertForm(buildConvertForm(lead));
  }

  async function handleConvertSubmit() {
    if (!convertingLead || !convertForm) return;
    if (convertingLead.status === 'converted') {
      toast.info('Este lead já foi convertido.');
      return;
    }

    const parsedDocument = classifyDocument(convertForm.document);
    const cnpj = parsedDocument.cnpj || digitsOnly(convertForm.cnpj);
    const cpf = parsedDocument.cpf || digitsOnly(convertForm.cpf);

    if (!cnpj && !cpf) {
      toast.error('Informe um CNPJ ou CPF válido para converter em cliente.');
      return;
    }

    setConverting(true);
    let clientId: string | null = null;

    try {
      if (cnpj) {
        const { data: existingClient, error: existingError } = await supabase
          .from('representative_clients')
          .select('id')
          .eq('representative_id', representativeId)
          .eq('cnpj', cnpj)
          .maybeSingle();

        if (existingError) throw existingError;
        clientId = existingClient?.id || null;
      }

      if (!clientId && cpf) {
        const { data: existingClient, error: existingError } = await supabase
          .from('representative_clients')
          .select('id')
          .eq('representative_id', representativeId)
          .eq('cpf', cpf)
          .maybeSingle();

        if (existingError) throw existingError;
        clientId = existingClient?.id || null;
      }

      if (!clientId) {
        const payload = {
          representative_id: representativeId,
          cnpj: cnpj || null,
          cpf: cpf || null,
          nome_completo: cpf ? convertForm.razao_social || convertForm.nome_fantasia || null : null,
          razao_social: convertForm.razao_social || convertingLead.company_name || null,
          nome_fantasia: convertForm.nome_fantasia || convertingLead.trade_name || null,
          endereco_completo: convertForm.endereco_completo || null,
          whatsapp_comprador: digitsOnly(convertForm.whatsapp_comprador) || null,
          email_comprador: convertForm.email_comprador || null,
          segment: convertForm.segment || null,
          status: 'active',
          is_active_client: true,
        };

        const { data: createdClient, error: createError } = await supabase
          .from('representative_clients')
          .insert(payload)
          .select('id')
          .single();

        if (createError) throw createError;
        clientId = createdClient.id;
      }

      const convertedAt = new Date().toISOString();
      const { error: leadError } = await supabase
        .from('prospect_leads')
        .update({
          status: 'converted',
          representative_client_id: clientId,
          converted_at: convertedAt,
        })
        .eq('id', convertingLead.id);

      if (leadError) throw leadError;

      setLeads(current =>
        current.map(lead =>
          lead.id === convertingLead.id
            ? { ...lead, status: 'converted', representative_client_id: clientId, converted_at: convertedAt }
            : lead
        )
      );
      window.dispatchEvent(new CustomEvent('repco:clients-updated', { detail: { representativeId } }));
      window.dispatchEvent(new CustomEvent('repco:prospection-updated', { detail: { representativeId, leadIds: [convertingLead.id] } }));
      toast.success('Lead convertido em cliente.');
      setConvertingLead(null);
      setConvertForm(null);
    } catch (error: any) {
      toast.error(error?.message ? `Não foi possível converter: ${error.message}` : 'Não foi possível converter o lead.');
    } finally {
      setConverting(false);
    }
  }

  async function planForToday() {
    if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
    if (selectedIds.size === 0) return;
    setPlanning(true);
    const today = new Date().toISOString().split('T')[0];
    const rows = Array.from(selectedIds).map(lead_id => ({ representative_id: representativeId, lead_id, plan_date: today }));
    const { error } = await supabase.from('rep_daily_plans').upsert(rows, { onConflict: 'representative_id,lead_id,plan_date' });
    setPlanning(false);
    if (error) { toast.error('Erro ao planejar visitas'); return; }
    toast.success(`${selectedIds.size} visita${selectedIds.size>1?'s':''} adicionada${selectedIds.size>1?'s':''} ao mapa de hoje!`);
    setSelectedIds(new Set());
    window.dispatchEvent(new CustomEvent('repco:map-updated', { detail: { representativeId } }));
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  }

  const sortedLeads = useMemo(() => {
    const hasCurrentLocation = currentLat !== undefined && currentLng !== undefined;
    return [...leads].sort((a, b) => {
      if (hasCurrentLocation) {
        const aDistance = a.lat !== null && a.lng !== null ? distanceKm(currentLat!, currentLng!, a.lat, a.lng) : null;
        const bDistance = b.lat !== null && b.lng !== null ? distanceKm(currentLat!, currentLng!, b.lat, b.lng) : null;
        if (aDistance !== null && bDistance !== null) return aDistance - bDistance;
        if (aDistance !== null) return -1;
        if (bDistance !== null) return 1;
      }
      return getSortKey(a).localeCompare(getSortKey(b)) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [currentLat, currentLng, leads]);

  const leadsInSelectedList = useMemo(
    () => selectedListId ? sortedLeads.filter(l => l.prospect_list_id === selectedListId) : sortedLeads,
    [sortedLeads, selectedListId]
  );
  const cities = Array.from(new Set(leadsInSelectedList.map(l => l.city).filter(Boolean))).sort() as string[];
  const categories = Array.from(new Set(leadsInSelectedList.map(l => l.category).filter(Boolean))).sort() as string[];
  const visibleLeads = leadsInSelectedList.filter(l =>
    (!cityFilter || l.city === cityFilter) && (!categoryFilter || l.category === categoryFilter)
  );

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#a4240e]" /></div>;
  }

  return (
    <div className="space-y-3">
      {/* ── SELETOR DE LISTAS ── */}
      {!selectedListId && lists.length > 0 && (
        <div className="space-y-2">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Minhas Listas de Prospecção</h3>
            <p className="text-xs text-gray-500">{lists.length} lista{lists.length !== 1 ? 's' : ''} atribuída{lists.length !== 1 ? 's' : ''} · toque para trabalhar</p>
          </div>
          {lists.map(list => {
            const listLeadCount = leads.filter(l => l.prospect_list_id === list.id && !['converted','rejected'].includes(l.status)).length;
            return (
              <button key={list.id} onClick={() => { setSelectedListId(list.id); setCityFilter(''); setCategoryFilter(''); }}
                className="w-full text-left rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-[#8B2214] hover:shadow-md transition-all active:scale-[0.99]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{list.name}</p>
                    {list.categories.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {list.categories.map(cat => (
                          <span key={cat} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{cat}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f0ef] px-2.5 py-1 text-sm font-bold text-[#8B2214]">
                      <List className="w-3.5 h-3.5"/>{listLeadCount}
                    </span>
                    <p className="mt-1 text-[11px] text-gray-400">pendentes</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── LEADS DA LISTA SELECIONADA ── */}
      {(selectedListId || lists.length === 0) && (
      <div className="space-y-3">
      {selectedListId && (
        <div className="flex items-center gap-2">
          <button onClick={() => { setSelectedListId(null); setCityFilter(''); setCategoryFilter(''); }}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            <ChevronLeft className="w-3.5 h-3.5"/>Listas
          </button>
          <span className="text-sm font-semibold text-gray-800 truncate">
            {lists.find(l => l.id === selectedListId)?.name || 'Lista'}
          </span>
        </div>
      )}
      <div>
        <h3 className="text-base font-semibold text-gray-800">{selectedListId ? 'Leads desta lista' : 'Minha Prospecção'}</h3>
        <p className="text-xs text-gray-500">
          {visibleLeads.length} de {leadsInSelectedList.length} lead{leadsInSelectedList.length !== 1 ? 's' : ''}
          {currentLat !== undefined && currentLng !== undefined ? ' · do mais perto ao mais longe' : ''}.
        </p>
      </div>

      {leadsInSelectedList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="h-9 rounded-lg border border-gray-300 px-3 text-sm">
            <option value="">Todas as cidades</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-9 rounded-lg border border-gray-300 px-3 text-sm">
            <option value="">Todas as categorias</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(cityFilter || categoryFilter) && (
            <button onClick={() => { setCityFilter(''); setCategoryFilter(''); }} className="h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-600 hover:bg-gray-50">Limpar</button>
          )}
        </div>
      )}

      {/* Barra "Planejar para Hoje" — aparece quando leads são selecionados */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 z-30 flex items-center justify-between gap-2 rounded-xl border border-[#8B2214] bg-[#8B2214] px-3 py-2.5 shadow-xl">
          <div className="text-sm text-white font-medium">
            {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''} para o mapa
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10">Limpar</button>
            <button disabled={planning} onClick={planForToday}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#8B2214] hover:bg-red-50 disabled:opacity-60">
              {planning ? '...' : '🗺️ Planejar para Hoje'}
            </button>
          </div>
        </div>
      )}

      {leads.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <p className="font-medium text-gray-500">Nenhum lead atribuído ainda.</p>
          <p className="mt-1 text-sm text-gray-400">Quando o admin enviar uma lista, ela aparecerá aqui.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleLeads.length === 0 && <p className="rounded-xl border border-gray-200 bg-white py-8 text-center text-sm text-gray-400">Nenhum lead com esses filtros.</p>}
          {visibleLeads.map(lead => {
            const address = buildAddress(lead);
            const distance =
              currentLat !== undefined && currentLng !== undefined && lead.lat !== null && lead.lng !== null
                ? distanceKm(currentLat, currentLng, lead.lat, lead.lng)
                : null;
            const statusClass = STATUS_STYLE[lead.status] || 'bg-gray-100 text-gray-600';
            const contactLinks = getContactLinks(lead);
            const phoneDigits = getLeadPhone(lead);
            const email = getLeadEmail(lead);
            const isSelected = selectedIds.has(lead.id);
            const canSelect = lead.lat !== null && !['visited','converted'].includes(lead.status);

            return (
              <div key={lead.id}
                onClick={() => canSelect && toggleSelect(lead.id)}
                className={`rounded-xl border bg-white p-2.5 shadow-sm transition-all cursor-pointer ${
                  isSelected ? 'border-[#8B2214] ring-1 ring-[#8B2214]' : 'border-gray-200'
                }`}>
                <div className="min-w-0">
                  {/* Checkbox de seleção */}
                  {canSelect && (
                    <div className="float-right ml-2 mt-0.5 flex-shrink-0">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-[#8B2214] border-[#8B2214]' : 'border-gray-300'
                      }`}>
                        {isSelected && <span className="text-white text-[10px]">✓</span>}
                      </div>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="min-w-0 flex-1 text-[13px] font-semibold text-gray-900">{lead.trade_name || lead.company_name}</h4>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                        {STATUS_LABEL[lead.status] || lead.status}
                      </span>
                      {distance !== null && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">{formatDistance(distance)}</span>}
                    </div>
                    {lead.trade_name && <p className="truncate text-xs text-gray-500">{lead.company_name}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                      {lead.category && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-700">{lead.category}</span>}
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-700">{getSegmentLabel(lead.segment)}</span>
                      {!selectedListId && lead.prospect_lists?.name && <span className="max-w-full truncate rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-700">Lista: {lead.prospect_lists.name}</span>}
                    </div>
                    {address && (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-600">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        <span>{address}</span>
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                      {phoneDigits && (
                        <>
                          <a href={`https://wa.me/${toBrazilPhone(phoneDigits)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-green-700 hover:bg-green-100">
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </a>
                          <a href={`tel:${phoneDigits}`} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-0.5 text-gray-600 hover:bg-gray-50">
                            <Phone className="h-3 w-3" />
                            Ligar
                          </a>
                        </>
                      )}
                      {email && <a href={`mailto:${email}`} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-0.5 text-gray-600 hover:bg-gray-50"><Mail className="h-3 w-3" />Email</a>}
                      {contactLinks.map(link => (
                        <a
                          key={link.kind}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 hover:bg-gray-50 ${
                            link.kind === 'instagram'
                              ? 'border-pink-200 bg-pink-50 text-pink-700'
                              : link.kind === 'facebook'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-gray-200 text-gray-600'
                          }`}
                        >
                          {link.kind === 'site' ? <Globe2 className="h-3 w-3" /> : <ExternalLink className="h-3 w-3" />}
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button onClick={() => openDirections(lead, 'google')} className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-50 px-2 py-1.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100">
                        <MapPin className="h-3.5 w-3.5" />
                        Google Maps
                      </button>
                      <button onClick={() => openDirections(lead, 'waze')} className="inline-flex items-center justify-center gap-1 rounded-md bg-sky-50 px-2 py-1.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-100">
                        <MapPin className="h-3.5 w-3.5" />
                        Waze
                      </button>
                      <button onClick={() => handleCheckIn(lead)} disabled={updatingId === lead.id} className="inline-flex items-center justify-center gap-1 rounded-md bg-green-50 px-2 py-1.5 text-[10px] font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Fazer check-in
                      </button>
                      <button onClick={() => openConvertModal(lead)} disabled={updatingId === lead.id || lead.status === 'converted'} className="inline-flex items-center justify-center gap-1 rounded-md bg-[#8B2214] px-2 py-1.5 text-[10px] font-semibold leading-tight text-white hover:bg-[#6d1a10] disabled:cursor-not-allowed disabled:opacity-50">
                        <UserPlus className="h-3.5 w-3.5" />
                        {lead.status === 'converted' ? 'Cliente criado' : 'Converter em cliente'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button onClick={() => handleReject(lead)} disabled={updatingId === lead.id} className="inline-flex items-center justify-center gap-1 rounded-md bg-red-50 px-2 py-1.5 text-[10px] font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Não deu certo
                      </button>
                      <button onClick={() => handleReturnLater(lead)} disabled={updatingId === lead.id} className="inline-flex items-center justify-center gap-1 rounded-md bg-purple-50 px-2 py-1.5 text-[10px] font-semibold text-purple-700 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Voltar depois
                      </button>
                    </div>
                  </div>
                </div>

                {lead.visited_at && (
                  <p className="mt-3 flex items-center gap-1 text-xs text-green-700">
                    <Clock className="h-3 w-3" />
                    Visitado em {new Date(lead.visited_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
      )}
      {convertingLead && convertForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold text-gray-900">Converter em cliente</h4>
            <p className="mt-1 text-sm text-gray-500">{convertingLead.trade_name || convertingLead.company_name}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
                CNPJ/CPF
                <input
                  value={convertForm.document}
                  onChange={event => {
                    const parsed = classifyDocument(event.target.value);
                    setConvertForm(current =>
                      current
                        ? { ...current, document: event.target.value, cnpj: parsed.cnpj || current.cnpj, cpf: parsed.cpf || current.cpf }
                        : current
                    );
                  }}
                  placeholder="Digite CNPJ ou CPF"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
                />
              </label>
              <label className="block text-xs font-medium text-gray-600">
                CNPJ detectado
                <input
                  value={convertForm.cnpj}
                  onChange={event => setConvertForm(current => current ? { ...current, cnpj: event.target.value } : current)}
                  placeholder="00.000.000/0000-00"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
                />
              </label>
              <label className="block text-xs font-medium text-gray-600">
                CPF detectado
                <input
                  value={convertForm.cpf}
                  onChange={event => setConvertForm(current => current ? { ...current, cpf: event.target.value } : current)}
                  placeholder="000.000.000-00"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
                />
              </label>
              <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
                Razão social / nome
                <input
                  value={convertForm.razao_social}
                  onChange={event => setConvertForm(current => current ? { ...current, razao_social: event.target.value } : current)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
                />
              </label>
              <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
                Nome fantasia
                <input
                  value={convertForm.nome_fantasia}
                  onChange={event => setConvertForm(current => current ? { ...current, nome_fantasia: event.target.value } : current)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
                />
              </label>
              <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
                Endereço
                <textarea
                  value={convertForm.endereco_completo}
                  onChange={event => setConvertForm(current => current ? { ...current, endereco_completo: event.target.value } : current)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
                />
              </label>
              <label className="block text-xs font-medium text-gray-600">
                WhatsApp / telefone
                <input
                  value={convertForm.whatsapp_comprador}
                  onChange={event => setConvertForm(current => current ? { ...current, whatsapp_comprador: event.target.value } : current)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
                />
              </label>
              <label className="block text-xs font-medium text-gray-600">
                Email
                <input
                  value={convertForm.email_comprador}
                  onChange={event => setConvertForm(current => current ? { ...current, email_comprador: event.target.value } : current)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
                />
              </label>
              <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
                Segmento
                <input
                  value={convertForm.segment}
                  onChange={event => setConvertForm(current => current ? { ...current, segment: event.target.value } : current)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setConvertingLead(null);
                  setConvertForm(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConvertSubmit}
                disabled={converting}
                className="rounded-lg bg-[#a4240e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8a1f0c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {converting ? 'Convertendo...' : 'Converter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold text-gray-900">Registrar motivo</h4>
            <p className="mt-1 text-sm text-gray-500">{rejectingLead.trade_name || rejectingLead.company_name}</p>
            <label className="mt-4 block text-xs font-medium text-gray-600">Motivo</label>
            <select
              value={rejectReason}
              onChange={event => setRejectReason(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
            >
              {REJECTION_REASONS.map(reason => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
            {(rejectReason === 'Outro' || rejectReason === 'Pediu para voltar depois') && (
              <>
                <label className="mt-3 block text-xs font-medium text-gray-600">Observação</label>
                <textarea
                  value={rejectNote}
                  onChange={event => setRejectNote(event.target.value)}
                  rows={3}
                  maxLength={240}
                  placeholder="Detalhe rápido para o admin"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
                />
              </>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setRejectingLead(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={updatingId === rejectingLead.id}
                className="rounded-lg bg-[#a4240e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8a1f0c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Salvar motivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
