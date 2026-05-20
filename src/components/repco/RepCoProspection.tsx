import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, ExternalLink, Mail, MapPin, Phone, RotateCcw } from 'lucide-react';
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

const PROSPECT_SEGMENT_LABEL: Record<string, string> = {
  padaria: 'Padaria',
  cafeteria: 'Cafeteria',
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
  phone, whatsapp, email, website, status, audit_notes, rejection_reason, visited_at, created_at,
  prospect_lists(name, assigned_representative_id)
`;

const SELECT_LIST_FIELDS = `
  id, prospect_list_id, representative_id, company_name, trade_name, category, segment,
  address, number, district, city, state, zip_code, lat, lng,
  phone, whatsapp, email, website, status, audit_notes, rejection_reason, visited_at, created_at,
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

function normalizeLeadRelation(lead: any): ProspectLead {
  const list = Array.isArray(lead.prospect_lists) ? lead.prospect_lists[0] : lead.prospect_lists;
  return { ...lead, prospect_lists: list || null } as ProspectLead;
}

export default function RepCoProspection({ representativeId, currentLat, currentLng }: Props) {
  const [leads, setLeads] = useState<ProspectLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  function openDirections(lead: ProspectLead) {
    if (lead.lat !== null && lead.lng !== null) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lead.lat},${lead.lng}`, '_blank');
      return;
    }

    const address = buildAddress(lead) || lead.company_name;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  }

  function handleCheckIn(lead: ProspectLead) {
    updateLead(lead, { status: 'visited', visited_at: new Date().toISOString() });
  }

  function handleReject(lead: ProspectLead) {
    const reason = window.prompt('Motivo simples para registrar:');
    if (reason === null) return;
    updateLead(lead, {
      status: 'rejected',
      rejection_reason: reason.trim() || 'Não deu certo',
      audit_notes: reason.trim() || lead.audit_notes,
    });
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
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || a.company_name.localeCompare(b.company_name);
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
                      {lead.phone && <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50"><Phone className="h-3 w-3" />{lead.phone}</a>}
                      {lead.whatsapp && <a href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-green-700">WhatsApp</a>}
                      {lead.email && <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50"><Mail className="h-3 w-3" />{lead.email}</a>}
                      {lead.website && <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50"><ExternalLink className="h-3 w-3" />Site</a>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:max-w-xs lg:justify-end">
                    <button onClick={() => openDirections(lead)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                      <MapPin className="h-3.5 w-3.5" />
                      Ir até o local
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
    </div>
  );
}
