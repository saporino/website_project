import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, ExternalLink, Globe2, Mail, MapPin, MessageCircle, Phone, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { SEGMENT_LABEL } from '../../constants/segments';

interface ProspectLead {
  id: string;
  prospect_list_id: string;
  representative_id: string | null;
  company_name: string;
  trade_name: string | null;
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
  created_at: string;
  prospect_lists?: { name: string; assigned_representative_id: string | null } | null;
}

interface Props {
  representativeId: string;
  currentLat?: number;
  currentLng?: number;
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
  id, prospect_list_id, representative_id, company_name, trade_name, category, segment,
  address, number, district, city, state, zip_code, lat, lng,
  phone, whatsapp, email, website, raw_data, status, audit_notes, rejection_reason, visited_at, created_at,
  prospect_lists(name, assigned_representative_id)
`;

const SELECT_LIST_FIELDS = `
  id, prospect_list_id, representative_id, company_name, trade_name, category, segment,
  address, number, district, city, state, zip_code, lat, lng,
  phone, whatsapp, email, website, raw_data, status, audit_notes, rejection_reason, visited_at, created_at,
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

export default function RepCoProspection({ representativeId, currentLat, currentLng }: Props) {
  const [leads, setLeads] = useState<ProspectLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rejectingLead, setRejectingLead] = useState<ProspectLead | null>(null);
  const [rejectReason, setRejectReason] = useState(REJECTION_REASONS[0]);
  const [rejectNote, setRejectNote] = useState('');

  useEffect(() => {
    fetchLeads();
  }, [representativeId]);

  async function fetchLeads() {
    setLoading(true);
    const [{ data: directLeads, error: directError }, { data: listLeads, error: listError }] = await Promise.all([
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
    ]);

    if (directError || listError) {
      toast.error('Não foi possível carregar sua prospecção.');
      setLoading(false);
      return;
    }

    const merged = new Map<string, ProspectLead>();
    [...(directLeads || []), ...(listLeads || [])].map(normalizeLeadRelation).forEach(lead => merged.set(lead.id, lead));
    setLeads(Array.from(merged.values()));
    setLoading(false);
  }

  async function updateLead(lead: ProspectLead, updates: Partial<ProspectLead>) {
    setUpdatingId(lead.id);
    const { error } = await supabase.from('prospect_leads').update(updates).eq('id', lead.id);
    setUpdatingId(null);

    if (error) {
      toast.error('Não foi possível atualizar o lead.');
      return;
    }

    setLeads(current => current.map(item => (item.id === lead.id ? { ...item, ...updates } : item)));
    toast.success('Lead atualizado.');
  }

  function openDirections(lead: ProspectLead, app: 'google' | 'waze') {
    if (lead.lat !== null && lead.lng !== null) {
      const url =
        app === 'waze'
          ? `https://waze.com/ul?ll=${lead.lat},${lead.lng}&navigate=yes`
          : `https://www.google.com/maps/dir/?api=1&destination=${lead.lat},${lead.lng}`;
      window.open(url, '_blank');
      return;
    }

    const address = buildAddress(lead) || lead.company_name;
    const encodedAddress = encodeURIComponent(address);
    const url =
      app === 'waze'
        ? `https://waze.com/ul?q=${encodedAddress}&navigate=yes`
        : `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    window.open(url, '_blank');
  }

  function handleCheckIn(lead: ProspectLead) {
    updateLead(lead, { status: 'visited', visited_at: new Date().toISOString() });
  }

  function openRejectModal(lead: ProspectLead) {
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
    const note = 'Voltar depois';
    updateLead(lead, {
      status: 'pending_visit',
      audit_notes: lead.audit_notes ? `${lead.audit_notes}\n${note}` : note,
    });
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

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#a4240e]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">Minha Prospecção</h3>
        <p className="text-sm text-gray-500">{leads.length} lead{leads.length !== 1 ? 's' : ''} atribuídos para visita.</p>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <p className="font-medium text-gray-500">Nenhum lead atribuído ainda.</p>
          <p className="mt-1 text-sm text-gray-400">Quando o admin enviar uma lista, ela aparecerá aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedLeads.map(lead => {
            const address = buildAddress(lead);
            const distance =
              currentLat !== undefined && currentLng !== undefined && lead.lat !== null && lead.lng !== null
                ? distanceKm(currentLat, currentLng, lead.lat, lead.lng)
                : null;
            const statusClass = STATUS_STYLE[lead.status] || 'bg-gray-100 text-gray-600';
            const contactLinks = getContactLinks(lead);
            const phoneDigits = getLeadPhone(lead);
            const email = getLeadEmail(lead);

            return (
              <div key={lead.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{lead.trade_name || lead.company_name}</h4>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>
                        {STATUS_LABEL[lead.status] || lead.status}
                      </span>
                      {distance !== null && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{formatDistance(distance)}</span>}
                    </div>
                    {lead.trade_name && <p className="text-sm text-gray-500">{lead.company_name}</p>}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {lead.category && <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">Categoria: {lead.category}</span>}
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">Segmento: {getSegmentLabel(lead.segment)}</span>
                      {lead.prospect_lists?.name && <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">Lista: {lead.prospect_lists.name}</span>}
                    </div>
                    {address && (
                      <p className="mt-3 flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span>{address}</span>
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {phoneDigits && (
                        <>
                          <a href={`https://wa.me/${toBrazilPhone(phoneDigits)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-green-700 hover:bg-green-100">
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </a>
                          <a href={`tel:${phoneDigits}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50">
                            <Phone className="h-3 w-3" />
                            Ligar
                          </a>
                          <a href={`sms:${phoneDigits}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50">
                            SMS
                          </a>
                        </>
                      )}
                      {email && <a href={`mailto:${email}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50"><Mail className="h-3 w-3" />Email</a>}
                      {contactLinks.map(link => (
                        <a
                          key={link.kind}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 hover:bg-gray-50 ${
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

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:max-w-xs lg:justify-end">
                    <button onClick={() => openDirections(lead, 'google')} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                      <MapPin className="h-3.5 w-3.5" />
                      Google Maps
                    </button>
                    <button onClick={() => openDirections(lead, 'waze')} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100">
                      <MapPin className="h-3.5 w-3.5" />
                      Waze
                    </button>
                    <button onClick={() => handleCheckIn(lead)} disabled={updatingId === lead.id} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Fazer check-in
                    </button>
                    <button onClick={() => handleReject(lead)} disabled={updatingId === lead.id} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Não deu certo
                    </button>
                    <button onClick={() => handleReturnLater(lead)} disabled={updatingId === lead.id} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Voltar depois
                    </button>
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
