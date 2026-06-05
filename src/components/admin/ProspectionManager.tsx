import { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, ExternalLink, FileText, Mail, MessageCircle, Phone, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SEGMENT_LABEL } from '../../constants/segments';

interface Representative {
  id: string;
  full_name: string;
  status: string;
}

interface ProspectList {
  id: string;
  name: string;
  segment: string | null;
  source_type: string;
  source_name: string | null;
  status: string;
  assigned_representative_id: string | null;
  total_count: number;
  pending_count: number;
  converted_count: number;
  rejected_count: number;
  duplicate_count: number;
  invalid_count: number;
  created_at: string;
  completed_at: string | null;
  representatives?: { full_name: string } | null;
}

interface ProspectLeadCategory {
  prospect_list_id: string;
  category: string | null;
  segment: string | null;
}

interface RepresentativeClient {
  id: string;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  nome_completo: string | null;
  endereco_completo: string | null;
}

interface ParsedLead {
  rowNumber: number;
  company_name: string;
  trade_name: string | null;
  cnpj: string | null;
  cpf: string | null;
  segment: string | null;
  category: string | null;
  source: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  lat: number | null;
  lng: number | null;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  raw_data: Record<string, unknown>;
  isValid: boolean;
  error: string | null;
  duplicate_of_client_id: string | null;
  duplicateReason: string | null;
}

interface StoredProspectLead extends Omit<ParsedLead, 'rowNumber' | 'isValid' | 'error' | 'duplicateReason'> {
  id: string;
  status: string;
  audit_notes: string | null;
  rejection_reason: string | null;
  rowNumber?: number;
  isValid?: boolean;
  error?: string | null;
  duplicateReason?: string | null;
}

type AuditTarget =
  | { type: 'preview'; lead: ParsedLead }
  | { type: 'stored'; lead: StoredProspectLead };

const MAX_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;
const DANGEROUS_RAW_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PREVIEW_PAGE_SIZE = 100;

const APIFY_DEFAULT_CATEGORIES = [
  'padaria',
  'padaria e confeitaria',
  'panificadora',
  'padaria artesanal',
  'padaria gourmet',
  'cafetaria',
  'cafetaria artesanal',
  'café especial',
  'specialty coffee',
  'coffee shop',
  'restaurante',
  'restaurante por quilo',
  'lanchonete',
  'bistrot',
  'buffet',
  'self service',
  'almoço executivo',
  'hotel',
  'pousada',
  'resort',
  'hotel fazenda',
  'cozinha industrial',
  'refeitório',
  'alimentação coletiva',
  'empresa de alimentação',
  'food service',
  'distribuidora de alimentos',
  'distribuidora de café',
  'atacado de alimentos',
  'distribuidora food service',
  'distribuidora de produtos para padaria',
  'empório',
  'supermercado atacado',
  'cash and carry',
  'confeitaria',
  'doceria',
  'bolo artesanal',
  'mercado',
  'mini mercado',
  'conveniência',
  'posto de gasolina',
  'academia',
  'mercadinho de condomínio',
  'pizzaria',
  'hospital',
  'churrascaria',
  'coworking',
];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  imported: 'Importada',
  assigned: 'Atribuída',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

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

const CATEGORY_SEGMENT_MAP: Record<string, string> = {
  padaria: 'padaria',
  padaria_e_confeitaria: 'padaria',
  panificadora: 'padaria',
  padaria_artesanal: 'padaria',
  padaria_gourmet: 'padaria',
  cafeteria: 'cafeteria',
  cafeteria_artesanal: 'cafeteria',
  cafetaria: 'cafeteria',
  cafetaria_artesanal: 'cafeteria',
  cafe_especial: 'cafeteria',
  cafes_especiais: 'cafeteria',
  cafe: 'cafeteria',
  specialty_coffee: 'cafeteria',
  coffee_shop: 'cafeteria',
  restaurante: 'food_service',
  restaurante_por_quilo: 'food_service',
  lanchonete: 'food_service',
  bistrot: 'food_service',
  buffet: 'food_service',
  self_service: 'food_service',
  almoco_executivo: 'food_service',
  food_service: 'food_service',
  pizzaria: 'food_service',
  churrascaria: 'food_service',
  hotel: 'hotelaria',
  pousada: 'hotelaria',
  resort: 'hotelaria',
  hotel_fazenda: 'hotelaria',
  cozinha_industrial: 'alimentacao_coletiva',
  refeitorio: 'alimentacao_coletiva',
  alimentacao_coletiva: 'alimentacao_coletiva',
  empresa_de_alimentacao: 'alimentacao_coletiva',
  distribuidora_de_alimentos: 'distribuicao',
  distribuidora_de_cafe: 'distribuicao',
  atacado_de_alimentos: 'distribuicao',
  distribuidora_food_service: 'distribuicao',
  distribuidora_de_produtos_para_padaria: 'distribuicao',
  emporio: 'varejo',
  supermercado_atacado: 'varejo',
  cash_and_carry: 'varejo',
  mercado: 'varejo',
  mini_mercado: 'varejo',
  conveniencia: 'varejo',
  posto_de_gasolina: 'varejo',
  mercadinho_de_condominio: 'varejo',
  confeitaria: 'confeitaria',
  doceria: 'confeitaria',
  bolo_artesanal: 'confeitaria',
  hospital: 'institucional',
  academia: 'outros',
  coworking: 'corporativo',
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  imported: 'bg-blue-100 text-blue-700',
  assigned: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function normalizeKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\u0000/g, '').trim();
  return text.length > 0 ? text : null;
}

function onlyDigits(value: unknown) {
  const text = normalizeValue(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

function normalizeComparableText(value: unknown) {
  const text = normalizeValue(value);
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(ltda|me|eireli|sa|s\/a|epp|mei)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function getFilterTokens(value: unknown) {
  const key = normalizeKey(String(value || ''));
  if (!key) return new Set<string>();
  const tokens = new Set<string>([key]);
  const mappedSegment = CATEGORY_SEGMENT_MAP[key];
  if (mappedSegment) tokens.add(mappedSegment);
  const prospectLabel = PROSPECT_SEGMENT_LABEL[key];
  if (prospectLabel) tokens.add(normalizeKey(prospectLabel));
  const segmentLabel = SEGMENT_LABEL[key];
  if (segmentLabel) tokens.add(normalizeKey(segmentLabel));
  return tokens;
}

function matchesCategoryOrSegment(filterValue: string, values: Array<string | null | undefined>) {
  if (!filterValue) return true;
  const filterTokens = getFilterTokens(filterValue);
  const valueTokens = values.reduce<Set<string>>((acc, value) => {
    getFilterTokens(value).forEach(token => acc.add(token));
    return acc;
  }, new Set<string>());
  return Array.from(filterTokens).some(token => valueTokens.has(token));
}

function cleanPhone(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

function toBrazilPhone(digits: string) {
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function formatPhone(digits: string) {
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return digits;
}

function looksLikeBrazilMobile(digits: string | null) {
  if (!digits) return false;
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  return local.length === 11 && local[2] === '9';
}

function normalizeUrl(value: string | null) {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith('@')) return `https://instagram.com/${text.slice(1)}`;
  return `https://${text}`;
}

function getUrlKind(url: string | null) {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('instagram.com')) return 'instagram';
  if (lower.includes('facebook.com') || lower.includes('fb.com')) return 'facebook';
  return 'site';
}

function parseNumber(value: unknown) {
  const text = normalizeValue(value);
  if (!text) return null;
  const normalized = text.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getField(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    const normalized = normalizeValue(value);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeCategorySegment(category: string | null, fallbackSegment: string) {
  if (!category) return fallbackSegment || null;
  return CATEGORY_SEGMENT_MAP[normalizeKey(category)] || 'outros';
}

function getCategoryField(row: Record<string, unknown>) {
  return getField(row, ['categoryname', 'categories_0', 'categories_1', 'categories', 'category', 'categoria', 'tipo', 'segmento']);
}

function getRawValue(rawData: Record<string, unknown>, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeKey);
  for (const [key, value] of Object.entries(rawData)) {
    if (!normalizedAliases.includes(normalizeKey(key))) continue;
    const normalized = normalizeValue(value);
    if (normalized) return normalized;
  }
  return null;
}

function sanitizeRawData(row: Record<string, unknown>) {
  return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (DANGEROUS_RAW_KEYS.has(key) || DANGEROUS_RAW_KEYS.has(normalizeKey(key))) return acc;
    if (value === null || value === undefined) {
      acc[key] = value;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      acc[key] = String(value).replace(/\u0000/g, '');
    } else {
      try {
        acc[key] = JSON.parse(JSON.stringify(value));
      } catch {
        acc[key] = String(value).replace(/\u0000/g, '');
      }
    }
    return acc;
  }, {});
}

function namesMatch(leadName: string, clientName: string) {
  if (!leadName || !clientName) return false;
  if (leadName === clientName) return true;
  if (leadName.length < 6 || clientName.length < 6) return false;
  return leadName.includes(clientName) || clientName.includes(leadName);
}

function findExistingClient(lead: ParsedLead, clients: RepresentativeClient[]) {
  if (lead.cnpj) {
    const clientByCnpj = clients.find(client => onlyDigits(client.cnpj) === lead.cnpj);
    if (clientByCnpj) return { clientId: clientByCnpj.id, reason: 'Já é cliente: CNPJ encontrado na carteira.' };
  }

  if (!lead.city) return null;
  const leadCity = normalizeComparableText(lead.city);
  const leadNames = [lead.company_name, lead.trade_name].map(normalizeComparableText).filter(Boolean);
  if (leadNames.length === 0) return null;

  const clientByNameAndCity = clients.find(client => {
    const clientAddress = normalizeComparableText(client.endereco_completo);
    if (!clientAddress || !clientAddress.includes(leadCity)) return false;
    const clientNames = [client.razao_social, client.nome_fantasia, client.nome_completo].map(normalizeComparableText).filter(Boolean);
    return leadNames.some(leadName => clientNames.some(clientName => namesMatch(leadName, clientName)));
  });

  return clientByNameAndCity
    ? { clientId: clientByNameAndCity.id, reason: 'Já é cliente: nome e cidade encontrados na carteira.' }
    : null;
}

function markExistingClient(lead: ParsedLead, clients: RepresentativeClient[]): ParsedLead {
  if (!lead.isValid) return lead;
  const match = findExistingClient(lead, clients);
  if (!match) return lead;
  return {
    ...lead,
    duplicate_of_client_id: match.clientId,
    duplicateReason: match.reason,
  };
}

function isLeadAssignable(lead: Pick<ParsedLead, 'isValid' | 'duplicate_of_client_id'>) {
  return lead.isValid && !lead.duplicate_of_client_id;
}

function getContactLinks(lead: Pick<ParsedLead, 'phone' | 'whatsapp' | 'email' | 'website' | 'raw_data'>) {
  const explicitWhatsapp = cleanPhone(lead.whatsapp) || cleanPhone(getRawValue(lead.raw_data, ['whatsapp', 'whats', 'mobile', 'celular']));
  const rawPhone = cleanPhone(lead.phone) || cleanPhone(getRawValue(lead.raw_data, ['phone', 'phones/0', 'telefone', 'tel']));
  const whatsappDigits = explicitWhatsapp || (looksLikeBrazilMobile(rawPhone) ? rawPhone : null);
  const phoneDigits = rawPhone && rawPhone !== whatsappDigits ? rawPhone : null;
  const email = lead.email || getRawValue(lead.raw_data, ['email', 'emails/0', 'e_mail']);
  const urlCandidates = [
    normalizeUrl(lead.website),
    normalizeUrl(getRawValue(lead.raw_data, ['website', 'site', 'url'])),
    normalizeUrl(getRawValue(lead.raw_data, ['instagram', 'instagramUrl', 'instagram_url', 'socialLinks/instagram', 'sociallinks_instagram'])),
    normalizeUrl(getRawValue(lead.raw_data, ['facebook', 'facebookUrl', 'facebook_url', 'socialLinks/facebook', 'sociallinks_facebook'])),
  ].filter(Boolean) as string[];

  const links = urlCandidates.reduce<{ instagram: string | null; facebook: string | null; site: string | null }>(
    (acc, url) => {
      const kind = getUrlKind(url);
      if (kind === 'instagram' && !acc.instagram) acc.instagram = url;
      if (kind === 'facebook' && !acc.facebook) acc.facebook = url;
      if (kind === 'site' && !acc.site) acc.site = url;
      return acc;
    },
    { instagram: null, facebook: null, site: null }
  );

  return {
    whatsappDigits,
    phoneDigits,
    email,
    site: links.site,
    instagram: links.instagram,
    facebook: links.facebook,
  };
}

function getBaseFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_\s]+dataset.*$/i, '')
    .replace(/[-_\s]+apify.*$/i, '')
    .trim();
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function parseProspectFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new Error('Arquivo grande demais. Envie um arquivo de até 10 MB.');
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('Planilha inválida: nenhuma aba encontrada.');
    const sheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  }

  const text = await file.text();
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: header => header.trim(),
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message || 'Não foi possível ler o arquivo.');
  }

  return result.data;
}

function normalizeRow(row: Record<string, unknown>, rowNumber: number, fallbackSegment: string): ParsedLead {
  const normalizedRow = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (!DANGEROUS_RAW_KEYS.has(key) && !DANGEROUS_RAW_KEYS.has(normalizeKey(key))) {
      acc[normalizeKey(key)] = value;
    }
    return acc;
  }, {});

  const companyName =
    getField(normalizedRow, ['title', 'name', 'nome_empresa', 'companyname', 'businessname', 'empresa', 'razao_social', 'razao', 'nome', 'nome_fantasia']) || '';
  const tradeName = getField(normalizedRow, ['trade_name', 'nome_fantasia', 'fantasia', 'businessname']);
  const category = getCategoryField(normalizedRow);
  const segment = normalizeCategorySegment(category, getField(normalizedRow, ['segment', 'segmento', 'setor']) || fallbackSegment);
  const lat = parseNumber(getField(normalizedRow, ['location_lat', 'lat', 'latitude']));
  const lng = parseNumber(getField(normalizedRow, ['location_lng', 'lng', 'lon', 'long', 'longitude']));
  const isValid = companyName.trim().length > 0;

  return {
    rowNumber,
    company_name: companyName.trim(),
    trade_name: tradeName,
    cnpj: onlyDigits(getField(normalizedRow, ['cnpj'])),
    cpf: onlyDigits(getField(normalizedRow, ['cpf'])),
    segment,
    category,
    source: getField(normalizedRow, ['source', 'origem', 'fonte']),
    address: getField(normalizedRow, ['address', 'endereco', 'street', 'logradouro', 'rua']),
    number: getField(normalizedRow, ['number', 'numero', 'num']),
    complement: getField(normalizedRow, ['complement', 'complemento']),
    district: getField(normalizedRow, ['district', 'neighborhood', 'bairro']),
    city: getField(normalizedRow, ['city', 'cidade', 'municipio']),
    state: getField(normalizedRow, ['state', 'estado', 'uf']),
    zip_code: onlyDigits(getField(normalizedRow, ['zip_code', 'postalcode', 'cep', 'postal_code'])),
    lat,
    lng,
    contact_name: getField(normalizedRow, ['contact_name', 'contato', 'nome_contato', 'responsavel']),
    phone: getField(normalizedRow, ['phone', 'phones_0', 'telefone', 'tel']),
    whatsapp: getField(normalizedRow, ['whatsapp', 'whats']),
    email: getField(normalizedRow, ['email', 'emails_0', 'e_mail']),
    website: getField(normalizedRow, ['website', 'site', 'url']),
    raw_data: sanitizeRawData(row),
    isValid,
    error: isValid ? null : 'Nome da empresa ausente',
    duplicate_of_client_id: null,
    duplicateReason: null,
  };
}

export default function ProspectionManager({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [listName, setListName] = useState('');
  const [listNameEdited, setListNameEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [selectedRep, setSelectedRep] = useState('');
  const [parseError, setParseError] = useState('');
  const [importCategoryFilter, setImportCategoryFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAcceptedColumns, setShowAcceptedColumns] = useState(false);
  const [listCategories, setListCategories] = useState<Record<string, string[]>>({});
  const [listFilterValues, setListFilterValues] = useState<Record<string, string[]>>({});
  const [assignmentDraft, setAssignmentDraft] = useState<Record<string, string>>({});
  const [assigningListId, setAssigningListId] = useState<string | null>(null);
  const [assigningFilteredKey, setAssigningFilteredKey] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [previewVisibleCount, setPreviewVisibleCount] = useState(PREVIEW_PAGE_SIZE);
  const [openedList, setOpenedList] = useState<ProspectList | null>(null);
  const [openedListLeads, setOpenedListLeads] = useState<StoredProspectLead[]>([]);
  const [loadingOpenedList, setLoadingOpenedList] = useState(false);
  const [auditTarget, setAuditTarget] = useState<AuditTarget | null>(null);
  const [auditReason, setAuditReason] = useState('Site inválido');
  const [auditSiteValue, setAuditSiteValue] = useState('');
  const [savingAudit, setSavingAudit] = useState(false);

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  useEffect(() => {
    function handleRefresh() {
      fetchData();
    }
    window.addEventListener('admin:prospection-updated', handleRefresh);
    window.addEventListener('repco:prospection-updated', handleRefresh);
    window.addEventListener('repco:clients-updated', handleRefresh);
    // REMOVIDO: 'focus' -> fetchData interferia com o upload de arquivo:
    // quando o seletor de arquivo fecha, o browser dispara focus, que chamava
    // fetchData() -> setLoading(true) ao mesmo tempo que o parse rodava,
    // causando race condition que impedia o preview de aparecer.
    return () => {
      window.removeEventListener('admin:prospection-updated', handleRefresh);
      window.removeEventListener('repco:prospection-updated', handleRefresh);
      window.removeEventListener('repco:clients-updated', handleRefresh);
    };
  }, []);

  function notifyProspectionUpdated() {
    window.dispatchEvent(new CustomEvent('admin:prospection-updated'));
    window.dispatchEvent(new CustomEvent('repco:prospection-updated'));
  }

  useEffect(() => {
    setPreviewVisibleCount(PREVIEW_PAGE_SIZE);
  }, [importCategoryFilter, parsedLeads.length]);

  useEffect(() => {
    if (!parsedLeads.length || listNameEdited) return;
    const suggested = getSuggestedListName();
    if (suggested) setListName(suggested);
  }, [importCategoryFilter, parsedLeads.length, selectedFileName, listNameEdited]);

  async function fetchData() {
    setLoading(true);
    const [{ data: reps }, { data: prospectLists }, { data: leadCategories }] = await Promise.all([
      supabase.from('representatives').select('id,full_name,status').eq('status', 'active').order('full_name'),
      supabase
        .from('prospect_lists')
        .select('*, representatives(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('prospect_leads').select('prospect_list_id,category,segment'),
    ]);
    setRepresentatives(reps || []);
    setLists((prospectLists || []) as ProspectList[]);
    const categoriesByList = ((leadCategories || []) as ProspectLeadCategory[]).reduce<Record<string, Set<string>>>((acc, lead) => {
      if (!lead.category) return acc;
      if (!acc[lead.prospect_list_id]) acc[lead.prospect_list_id] = new Set<string>();
      acc[lead.prospect_list_id].add(lead.category);
      return acc;
    }, {});
    const filterValuesByList = ((leadCategories || []) as ProspectLeadCategory[]).reduce<Record<string, Set<string>>>((acc, lead) => {
      if (!acc[lead.prospect_list_id]) acc[lead.prospect_list_id] = new Set<string>();
      [lead.category, lead.segment, lead.segment ? PROSPECT_SEGMENT_LABEL[lead.segment] || SEGMENT_LABEL[lead.segment] : null]
        .filter(Boolean)
        .forEach(value => acc[lead.prospect_list_id].add(value as string));
      return acc;
    }, {});
    setListCategories(
      Object.fromEntries(Object.entries(categoriesByList).map(([listId, categories]) => [listId, Array.from(categories).sort()]))
    );
    setListFilterValues(
      Object.fromEntries(Object.entries(filterValuesByList).map(([listId, values]) => [listId, Array.from(values).sort()]))
    );
    setLoading(false);
  }

  const categoryOptions = useMemo(
    () => Array.from(new Set([...APIFY_DEFAULT_CATEGORIES, ...Object.values(listCategories).flat()])).sort(),
    [listCategories]
  );
  const filteredLists = useMemo(
    () =>
      lists.filter(list => {
        const matchesCategory = categoryFilter ? matchesCategoryOrSegment(categoryFilter, listFilterValues[list.id] || []) : true;
        return matchesCategory;
      }),
    [categoryFilter, listFilterValues, lists]
  );
  const importCategoryOptions = useMemo(
    () => Array.from(new Set([...APIFY_DEFAULT_CATEGORIES, ...(parsedLeads.map(lead => lead.category).filter(Boolean) as string[])])).sort(),
    [parsedLeads]
  );
  const filteredParsedLeads = useMemo(
    () =>
      parsedLeads.filter(lead => {
        const matchesCategory = importCategoryFilter ? matchesCategoryOrSegment(importCategoryFilter, [lead.category, lead.segment]) : true;
        return matchesCategory;
      }),
    [importCategoryFilter, parsedLeads]
  );
  const filteredValidLeads = useMemo(() => filteredParsedLeads.filter(lead => lead.isValid), [filteredParsedLeads]);
  const filteredInvalidLeads = useMemo(() => filteredParsedLeads.filter(lead => !lead.isValid), [filteredParsedLeads]);
  const filteredDuplicateLeads = useMemo(() => filteredValidLeads.filter(lead => lead.duplicate_of_client_id), [filteredValidLeads]);
  const filteredAssignableLeads = useMemo(() => filteredValidLeads.filter(isLeadAssignable), [filteredValidLeads]);
  const filteredLeadsWithCoords = useMemo(
    () => filteredValidLeads.filter(lead => lead.lat !== null && lead.lng !== null).length,
    [filteredValidLeads]
  );
  const hasImportFilter = Boolean(importCategoryFilter);
  const visiblePreviewLeads = useMemo(
    () => filteredParsedLeads.slice(0, previewVisibleCount),
    [filteredParsedLeads, previewVisibleCount]
  );

  function getSuggestedListName() {
    const baseName = getBaseFileName(selectedFileName || listName).replace(/[-_]+/g, ' ').trim();
    const categoryLabel = importCategoryFilter || null;
    const filterLabel = categoryLabel;

    if (!filterLabel) return baseName;
    return [baseName, titleCase(filterLabel)].filter(Boolean).join(' - ');
  }

  async function fetchExistingClients() {
    const { data, error } = await supabase
      .from('representative_clients')
      .select('id,cnpj,razao_social,nome_fantasia,nome_completo,endereco_completo');

    if (error) {
      toast.warning('Não foi possível comparar com clientes existentes agora.');
      return [];
    }

    return (data || []) as RepresentativeClient[];
  }

  async function handleProspectFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    // Feedback imediato — garante que NUNCA "não acontece nada" sem explicação.
    toast.info(`Lendo "${file.name}"...`);
    setParseError('');
    setSelectedFileName(file.name);
    setParsedLeads([]);
    setListNameEdited(false);
    if (!listName.trim()) {
      setListName(getBaseFileName(file.name));
    }

    let parsedRows: Record<string, unknown>[];
    try {
      parsedRows = await parseProspectFile(file);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Não foi possível ler o arquivo.';
      setParseError(msg);
      toast.error(msg);
      input.value = '';
      return;
    }
    const rows = parsedRows.filter(row => Object.values(row).some(value => normalizeValue(value)));
    if (rows.length === 0) {
      setParseError('Arquivo vazio ou sem cabeçalho reconhecido.');
      toast.error('Arquivo vazio ou sem cabeçalho reconhecido.');
      input.value = '';
      return;
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      const msg = `Arquivo com muitas linhas. O limite atual é de ${MAX_IMPORT_ROWS.toLocaleString('pt-BR')} linhas por importação.`;
      setParseError(msg);
      toast.error(msg);
      input.value = '';
      return;
    }

    const clients = await fetchExistingClients();
    const leads = rows.map((row, index) => markExistingClient(normalizeRow(row, index + 2, ''), clients));
    setParsedLeads(leads);
    const validCount = leads.filter(lead => lead.isValid).length;
    if (validCount === 0) {
      toast.warning(`${rows.length} linha(s) lida(s), mas nenhuma tem o nome da empresa numa coluna reconhecida. Veja "Ver colunas aceitas".`);
    } else {
      toast.success(`${rows.length} linha(s) lida(s) · ${validCount} válida(s). Revise abaixo e clique em "Criar lista".`);
    }
    // Reseta o input para permitir reselecionar o MESMO arquivo (o navegador não dispara change com valor igual).
    input.value = '';
  }

  async function handleCreateList() {
    if (!listName.trim()) {
      toast.error('Informe um nome para a lista.');
      return;
    }
    if (filteredValidLeads.length === 0) {
      toast.error('Importe um arquivo com pelo menos uma linha válida.');
      return;
    }

    setSaving(true);
    const hasNonAssignableLeads = filteredValidLeads.some(lead => !isLeadAssignable(lead));
    const canAssignByList = Boolean(selectedRep && !hasNonAssignableLeads);
    const listStatus = selectedRep && filteredAssignableLeads.length > 0 ? 'assigned' : 'imported';
    const uniqueSegments = Array.from(new Set(filteredValidLeads.map(lead => lead.segment).filter(Boolean)));
    const listSegment = uniqueSegments.length === 1 ? uniqueSegments[0] : null;
    const { data: list, error: listError } = await supabase
      .from('prospect_lists')
      .insert({
        name: listName.trim(),
        description: description.trim() || null,
        segment: listSegment,
        source_type: 'csv',
        source_name: selectedFileName || null,
        status: listStatus,
        assigned_representative_id: canAssignByList ? selectedRep : null,
        total_count: filteredParsedLeads.length,
        pending_count: filteredAssignableLeads.length,
        duplicate_count: filteredDuplicateLeads.length,
        invalid_count: filteredInvalidLeads.length,
        created_by: user?.id || null,
      })
      .select('id')
      .single();

    if (listError || !list) {
      toast.error('Erro ao criar lista de prospecção.');
      setSaving(false);
      return;
    }

    const payload = filteredValidLeads.map(lead => ({
      prospect_list_id: list.id,
      representative_id: selectedRep && isLeadAssignable(lead) ? selectedRep : null,
      company_name: lead.company_name,
      trade_name: lead.trade_name,
      cnpj: lead.cnpj,
      cpf: lead.cpf,
      segment: lead.segment,
      category: lead.category,
      source: lead.source || 'csv',
      address: lead.address,
      number: lead.number,
      complement: lead.complement,
      district: lead.district,
      city: lead.city,
      state: lead.state,
      zip_code: lead.zip_code,
      lat: lead.lat,
      lng: lead.lng,
      geocode_status: lead.lat !== null && lead.lng !== null ? 'success' : 'pending',
      geocode_source: lead.lat !== null && lead.lng !== null ? 'csv' : null,
      geocoded_at: lead.lat !== null && lead.lng !== null ? new Date().toISOString() : null,
      contact_name: lead.contact_name,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      email: lead.email,
      website: lead.website,
      raw_data: lead.raw_data,
      status: lead.duplicate_of_client_id ? 'duplicate' : selectedRep ? 'assigned' : 'new',
      rejection_reason: lead.duplicateReason,
      duplicate_of_client_id: lead.duplicate_of_client_id,
      created_by: user?.id || null,
    }));

    const { error: leadsError } = await supabase.from('prospect_leads').insert(payload);
    if (leadsError) {
      await supabase.from('prospect_lists').delete().eq('id', list.id);
      toast.error('Não foi possível salvar os leads. A lista criada foi removida para evitar cadastro incompleto.');
      setSaving(false);
      return;
    }

    toast.success(`Lista criada com ${filteredAssignableLeads.length} lead${filteredAssignableLeads.length !== 1 ? 's' : ''} para visita${filteredDuplicateLeads.length ? ` e ${filteredDuplicateLeads.length} já cliente/duplicado` : ''}.`);
    setSaving(false);
    if (hasImportFilter) {
      const createdRows = new Set(filteredParsedLeads.map(lead => lead.rowNumber));
      setParsedLeads(current => current.filter(lead => !createdRows.has(lead.rowNumber)));
      setImportCategoryFilter('');
      setListName('');
      setListNameEdited(false);
      setDescription('');
      setSelectedRep('');
    } else {
      resetImportForm();
    }
    fetchData();
    notifyProspectionUpdated();
  }

  async function handleAssignList(list: ProspectList, overrideRepresentativeId?: string) {
    const representativeId = overrideRepresentativeId ?? assignmentDraft[list.id] ?? list.assigned_representative_id ?? '';
    setAssigningListId(list.id);

    if (!representativeId) {
      const [{ error: listError }, { error: leadsError }] = await Promise.all([
        supabase
          .from('prospect_lists')
          .update({
            assigned_representative_id: null,
            status: 'imported',
          })
          .eq('id', list.id),
        supabase.from('prospect_leads').update({ representative_id: null }).eq('prospect_list_id', list.id),
      ]);

      setAssigningListId(null);
      if (listError || leadsError) {
        toast.error('Não foi possível remover a atribuição.');
        return;
      }

      toast.success('Atribuição removida da lista e dos leads.');
      fetchData();
      notifyProspectionUpdated();
      return;
    }

    const { data: leads, error: leadsFetchError } = await supabase
      .from('prospect_leads')
      .select('id,status,duplicate_of_client_id')
      .eq('prospect_list_id', list.id);

    if (leadsFetchError) {
      setAssigningListId(null);
      toast.error('Não foi possível verificar duplicados antes da atribuição.');
      return;
    }

    const safeToAssignByList = (leads || []).every(lead => lead.status !== 'duplicate' && lead.status !== 'invalid' && !lead.duplicate_of_client_id);

    const { error: listError } = await supabase
      .from('prospect_lists')
      .update({
        assigned_representative_id: safeToAssignByList ? representativeId : null,
        status: 'assigned',
      })
      .eq('id', list.id);

    const { error: leadsError } = await supabase
      .from('prospect_leads')
      .update({ representative_id: representativeId, status: 'assigned' })
      .eq('prospect_list_id', list.id)
      .is('duplicate_of_client_id', null)
      .not('status', 'in', '(duplicate,invalid,converted)');

    setAssigningListId(null);
    if (listError || leadsError) {
      toast.error('Não foi possível atribuir a lista.');
      return;
    }

    toast.success(safeToAssignByList ? 'Lista atribuída ao representante.' : 'Leads elegíveis atribuídos. Já clientes/duplicados não foram enviados para visita.');
    fetchData();
    notifyProspectionUpdated();
  }

  async function handleAssignFilteredLeads(list: ProspectList, remove = false) {
    if (!categoryFilter) {
      toast.error('Escolha uma categoria para aplicar nos leads filtrados.');
      return;
    }

    const representativeId = assignmentDraft[list.id] ?? list.assigned_representative_id ?? '';
    if (!remove && !representativeId) {
      toast.error('Escolha um representante para receber os leads filtrados.');
      return;
    }

    const actionKey = `${list.id}-${remove ? 'remove' : 'assign'}`;
    setAssigningFilteredKey(actionKey);
    let query = supabase.from('prospect_leads').update({ representative_id: remove ? null : representativeId });

    if (!remove) {
      query = query
        .is('duplicate_of_client_id', null)
        .not('status', 'in', '(duplicate,invalid,converted)');
    }

    query = query.eq('prospect_list_id', list.id);

    if (categoryFilter) query = query.eq('category', categoryFilter);

    const { error } = await query;
    setAssigningFilteredKey(null);

    if (error) {
      toast.error(remove ? 'Não foi possível remover o representante dos leads filtrados.' : 'Não foi possível atribuir os leads filtrados.');
      return;
    }

    toast.success(remove ? 'Representante removido dos leads filtrados.' : 'Leads filtrados atribuídos ao representante. Já clientes/duplicados ficaram fora da visita.');
    fetchData();
    notifyProspectionUpdated();
  }
  async function handleDeleteList(list: ProspectList) {
    const confirmed = window.confirm(`Deletar a lista "${list.name}"? Os leads de prospecção serão removidos, mas clientes reais não serão apagados.`);
    if (!confirmed) return;

    setDeletingListId(list.id);
    const { error } = await supabase.from('prospect_lists').delete().eq('id', list.id);
    setDeletingListId(null);

    if (error) {
      toast.error('Não foi possível deletar a lista.');
      return;
    }

    toast.success('Lista de prospecção deletada. Clientes reais foram preservados.');
    if (openedList?.id === list.id) {
      setOpenedList(null);
      setOpenedListLeads([]);
    }
    fetchData();
    notifyProspectionUpdated();
  }
  async function handleOpenList(list: ProspectList) {
    setOpenedList(list);
    setLoadingOpenedList(true);
    const { data, error } = await supabase
      .from('prospect_leads')
      .select('*')
      .eq('prospect_list_id', list.id)
      .order('company_name', { ascending: true });

    setLoadingOpenedList(false);
    if (error) {
      toast.error('Não foi possível carregar os leads da lista.');
      return;
    }

    setOpenedListLeads(((data || []) as StoredProspectLead[]).map(lead => ({ ...lead, raw_data: lead.raw_data || {} })));
  }

  function openAudit(target: AuditTarget) {
    setAuditTarget(target);
    setAuditReason('Site inválido');
    setAuditSiteValue(target.lead.website || '');
  }

  async function handleSaveAudit() {
    if (!auditTarget) return;
    setSavingAudit(true);
    const nextWebsite =
      auditReason === 'Corrigir/remover link do site'
        ? normalizeValue(auditSiteValue)
        : auditReason === 'É Instagram' || auditReason === 'É Facebook'
          ? normalizeValue(auditSiteValue || auditTarget.lead.website)
          : null;
    const note = `Auditoria do site: ${auditReason}${nextWebsite ? ` (${nextWebsite})` : ''}`;

    if (auditTarget.type === 'preview') {
      setParsedLeads(current =>
        current.map(lead =>
          lead.rowNumber === auditTarget.lead.rowNumber
            ? { ...lead, website: nextWebsite, raw_data: { ...lead.raw_data, website: nextWebsite, site_audit: note } }
            : lead
        )
      );
    } else {
      const previousNotes = auditTarget.lead.audit_notes || '';
      const auditNotes = [previousNotes, note].filter(Boolean).join('\n');
      const { error } = await supabase
        .from('prospect_leads')
        .update({ website: nextWebsite, audit_notes: auditNotes })
        .eq('id', auditTarget.lead.id);

      if (error) {
        setSavingAudit(false);
      toast.error('Não foi possível salvar a edição do site.');
        return;
      }

      setOpenedListLeads(current =>
        current.map(lead => (lead.id === auditTarget.lead.id ? { ...lead, website: nextWebsite, audit_notes: auditNotes } : lead))
      );
    }

    setSavingAudit(false);
    setAuditTarget(null);
    if (auditTarget.type === 'stored') notifyProspectionUpdated();
    toast.success('Edição do site salva.');
  }
  function getActiveFilterLabel() {
    const parts = [
      categoryFilter ? `categoria ${categoryFilter}` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' + ') : '';
  }

  function resetImportForm() {
    setSelectedFileName('');
    setParsedLeads([]);
    setListName('');
    setListNameEdited(false);
    setDescription('');
    setSelectedRep('');
    setParseError('');
    setImportCategoryFilter('');
    if (fileRef.current) fileRef.current.value = '';
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#a4240e]" />
      </div>
    );
  }

  return (
    <div className={`space-y-6${parsedLeads.length > 0 ? ' pb-24' : ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Prospecção RepCo</h3>
          <p className="text-sm text-gray-500">Importe CSVs e transforme linhas em leads para representantes.</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#a4240e] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#8a1f0c]"
        >
          <Upload className="h-4 w-4" />
          Importar CSV/XLSX
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleProspectFileUpload} className="hidden" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#a4240e]" />
          <h4 className="font-semibold text-gray-900">Nova lista por CSV/XLSX</h4>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Nome da lista *</label>
            <input
              value={listName}
              onChange={event => {
                setListName(event.target.value);
                setListNameEdited(true);
              }}
              placeholder="Ex: Padarias Zona Sul - Maio"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Representante</label>
            <select
              value={selectedRep}
              onChange={event => setSelectedRep(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
            >
              <option value="">Sem atribuição agora</option>
              {representatives.map(rep => (
                <option key={rep.id} value={rep.id}>
                  {rep.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Descrição</label>
            <input
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Origem, região, observações"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowAcceptedColumns(current => !current)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#a4240e] hover:underline"
          >
            {showAcceptedColumns ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAcceptedColumns ? 'Ocultar colunas aceitas' : 'Ver colunas aceitas'}
          </button>
          {showAcceptedColumns && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-semibold">Colunas aceitas</p>
              <p className="mt-1 font-mono text-[11px]">
                title, name, nome_empresa, companyName, businessName, categoryName, categories/0, categories/1,
                categories, address, street, city, state, postalCode, location/lat, location/lng, phone, phones/0,
                email, emails/0, website, instagramUrl, facebookUrl
              </p>
            </div>
          )}
        </div>

        {parseError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {parseError}
          </div>
        )}

        {parsedLeads.length > 0 && (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Filtro para criar esta lista</p>
                  <p className="text-xs text-gray-500">Use a categoria do arquivo para criar uma lista menor a partir do mesmo arquivo.</p>
                </div>
                {hasImportFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setImportCategoryFilter('');
                    }}
                    className="text-xs font-semibold text-[#a4240e] hover:underline"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Categoria do arquivo</label>
                  <select
                    value={importCategoryFilter}
                    onChange={event => setImportCategoryFilter(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
                  >
                    <option value="">Todas as categorias</option>
                    {importCategoryOptions.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="No filtro" value={filteredParsedLeads.length} />
              <Metric label="Para visita" value={filteredAssignableLeads.length} tone="green" />
              <Metric label="Já clientes" value={filteredDuplicateLeads.length} tone={filteredDuplicateLeads.length > 0 ? 'amber' : 'gray'} />
              <Metric label="Inválidas" value={filteredInvalidLeads.length} tone={filteredInvalidLeads.length > 0 ? 'red' : 'gray'} />
              <Metric label="Com coordenada" value={filteredLeadsWithCoords} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <p className="text-sm font-semibold text-gray-900">Preview dos leads</p>
                <p className="text-xs text-gray-500">
                  Mostrando {Math.min(visiblePreviewLeads.length, filteredParsedLeads.length)} de {filteredParsedLeads.length} registros filtrados
                </p>
              </div>

              {visiblePreviewLeads.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
                  Nenhum lead encontrado para este filtro.
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {visiblePreviewLeads.map(lead => (
                    <PreviewLeadCard key={lead.rowNumber} lead={lead} onAudit={openAudit} />
                  ))}
                </div>
              )}

              {filteredParsedLeads.length > previewVisibleCount && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setPreviewVisibleCount(current => current + PREVIEW_PAGE_SIZE)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Mostrar mais {Math.min(PREVIEW_PAGE_SIZE, filteredParsedLeads.length - previewVisibleCount)}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={resetImportForm}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Limpar
              </button>
              <button
                onClick={handleCreateList}
                disabled={saving || filteredValidLeads.length === 0}
                className="rounded-lg bg-[#a4240e] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#8a1f0c] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Criando...' : `Criar lista ${listName.trim() || getSuggestedListName()} com ${filteredAssignableLeads.length} leads`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BARRA FIXA NO RODAPÉ — aparece assim que o arquivo é lido, impossível de perder */}
      {parsedLeads.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#8B2214] bg-[#8B2214] px-4 py-3 shadow-2xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="min-w-0 text-white">
              <p className="truncate text-sm font-semibold">
                📋 {filteredAssignableLeads.length} lead{filteredAssignableLeads.length !== 1 ? 's' : ''} prontos
                {filteredDuplicateLeads.length > 0 && ` · ${filteredDuplicateLeads.length} já cliente`}
                {filteredInvalidLeads.length > 0 && ` · ${filteredInvalidLeads.length} inválido`}
              </p>
              <p className="text-xs text-red-200">
                {listName.trim() || 'Dê um nome à lista'} · role a página para revisar os leads
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={resetImportForm}
                className="rounded-lg border border-red-300 bg-transparent px-3 py-2 text-sm font-medium text-white hover:bg-[#6d1a10]"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateList}
                disabled={saving || filteredValidLeads.length === 0 || !listName.trim()}
                className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-[#8B2214] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Criando...' : `✓ Criar lista (${filteredAssignableLeads.length} leads)`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">Listas de prospecção</h4>
            <p className="text-xs text-gray-500">{filteredLists.length} de {lists.length} lista{lists.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-1 lg:w-[280px]">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Filtrar por categoria</label>
              <select
                value={categoryFilter}
                onChange={event => setCategoryFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
              >
                <option value="">Todas as categorias</option>
                {categoryOptions.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {lists.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">Nenhuma lista de prospecção criada ainda.</div>
        ) : filteredLists.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">Nenhuma lista encontrada para esta categoria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1140px] text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Lista</th>
                  <th className="px-4 py-3 text-left">Categorias</th>
                  <th className="px-4 py-3 text-left">Representante</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Leads</th>
                  <th className="px-4 py-3 text-left">Criada em</th>
                  <th className="px-4 py-3 text-left">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLists.map(list => (
                  <tr key={list.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{list.name}</p>
                      <button
                        type="button"
                        onClick={() => handleOpenList(list)}
                        className="mt-1 text-xs font-semibold text-[#a4240e] hover:underline"
                      >
                        Ver lista
                      </button>
                      <p className="text-xs text-gray-500">
                        {[list.source_name, list.segment ? PROSPECT_SEGMENT_LABEL[list.segment] || SEGMENT_LABEL[list.segment] || list.segment : null].filter(Boolean).join(' | ') || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {(listCategories[list.id] || []).slice(0, 4).map(category => (
                          <span key={category} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                            {category}
                          </span>
                        ))}
                        {(listCategories[list.id] || []).length > 4 && (
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
                            +{(listCategories[list.id] || []).length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-64 items-center gap-2">
                        <select
                          value={assignmentDraft[list.id] ?? list.assigned_representative_id ?? ''}
                          onChange={event => setAssignmentDraft(current => ({ ...current, [list.id]: event.target.value }))}
                          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#a4240e]"
                        >
                          <option value="">Sem representante</option>
                          {representatives.map(rep => (
                            <option key={rep.id} value={rep.id}>
                              {rep.full_name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssignList(list)}
                          disabled={assigningListId === list.id}
                          className="rounded-lg border border-[#a4240e] px-3 py-1.5 text-xs font-semibold text-[#a4240e] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {assigningListId === list.id ? 'Atribuindo...' : 'Atribuir lista inteira'}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {list.assigned_representative_id && (
                          <button
                            onClick={() => {
                              setAssignmentDraft(current => ({ ...current, [list.id]: '' }));
                              handleAssignList(list, '');
                            }}
                            disabled={assigningListId === list.id}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Remover representante da lista
                          </button>
                        )}
                        {categoryFilter && (
                          <>
                            <button
                              onClick={() => handleAssignFilteredLeads(list)}
                              disabled={assigningFilteredKey === `${list.id}-assign`}
                              className="rounded-lg bg-[#a4240e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#8a1f0c] disabled:cursor-not-allowed disabled:opacity-50"
                              title={`Aplicar em leads filtrados por ${getActiveFilterLabel()}`}
                            >
                              {assigningFilteredKey === `${list.id}-assign` ? 'Atribuindo...' : 'Atribuir filtro atual'}
                            </button>
                            <button
                              onClick={() => handleAssignFilteredLeads(list, true)}
                              disabled={assigningFilteredKey === `${list.id}-remove`}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                              title={`Remover dos leads filtrados por ${getActiveFilterLabel()}`}
                            >
                              {assigningFilteredKey === `${list.id}-remove` ? 'Removendo...' : 'Remover representante do filtro'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLE[list.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[list.status] || list.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 text-xs">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{list.total_count} total</span>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">{list.pending_count} pendentes</span>
                        {list.converted_count > 0 && <span className="rounded-full bg-green-100 px-2 py-1 text-green-700">{list.converted_count} convertidos</span>}
                        {list.invalid_count > 0 && <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">{list.invalid_count} inválidos</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(list.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteList(list)}
                        disabled={deletingListId === list.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingListId === list.id ? 'Deletando...' : 'Deletar lista'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openedList && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">{openedList.name}</h4>
              <p className="text-xs text-gray-500">{openedListLeads.length} lead{openedListLeads.length !== 1 ? 's' : ''} nesta lista</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpenedList(null);
                setOpenedListLeads([]);
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Fechar lista
            </button>
          </div>
          <div className="p-5">
            {loadingOpenedList ? (
              <div className="py-8 text-center text-sm text-gray-500">Carregando leads...</div>
            ) : openedListLeads.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">Nenhum lead encontrado nesta lista.</div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {openedListLeads.map(lead => (
                  <PreviewLeadCard key={lead.id} lead={{ ...lead, rowNumber: lead.rowNumber || 0, isValid: true, error: null }} onAudit={openAudit} stored />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {auditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold text-gray-900">Editar site</h4>
            <p className="mt-1 text-sm text-gray-500">{auditTarget.lead.trade_name || auditTarget.lead.company_name}</p>

            <label className="mt-4 block text-xs font-medium text-gray-600">Situação</label>
            <select
              value={auditReason}
              onChange={event => setAuditReason(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
            >
              <option>Site inválido</option>
              <option>Certificado vencido</option>
              <option>Não tem site</option>
              <option>É Instagram</option>
              <option>É Facebook</option>
              <option>Corrigir/remover link do site</option>
            </select>

            {(auditReason === 'Corrigir/remover link do site' || auditReason === 'É Instagram' || auditReason === 'É Facebook') && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600">Link do site/perfil</label>
                <input
                  value={auditSiteValue}
                  onChange={event => setAuditSiteValue(event.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
                />
                <p className="mt-1 text-xs text-gray-500">Deixe em branco para remover o link.</p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAuditTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAudit}
                disabled={savingAudit}
                className="rounded-lg bg-[#a4240e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8a1f0c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingAudit ? 'Salvando...' : 'Salvar edição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewLeadCard({ lead, onAudit, stored = false }: { lead: ParsedLead | StoredProspectLead; onAudit: (target: AuditTarget) => void; stored?: boolean }) {
  const status = !lead.isValid
    ? { label: lead.error || 'Inválida', className: 'bg-red-100 text-red-700', icon: <AlertCircle className="h-3.5 w-3.5" /> }
    : lead.duplicate_of_client_id
      ? { label: 'Já é cliente', className: 'bg-amber-100 text-amber-700', icon: <AlertCircle className="h-3.5 w-3.5" /> }
      : { label: 'Para visita', className: 'bg-green-100 text-green-700', icon: <CheckCircle className="h-3.5 w-3.5" /> };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{lead.company_name || '-'}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${status.className}`} title={lead.duplicateReason || undefined}>
              {status.icon}
              {status.label}
            </span>
          </div>
          {lead.trade_name && <p className="mt-0.5 text-xs text-gray-500">{lead.trade_name}</p>}
          {(lead.cnpj || lead.cpf) && <p className="mt-1 text-xs text-gray-500">{lead.cnpj || lead.cpf}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lead.rowNumber ? <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">Linha {lead.rowNumber}</span> : null}
          <button
            type="button"
            onClick={() => onAudit(stored ? { type: 'stored', lead: lead as StoredProspectLead } : { type: 'preview', lead: lead as ParsedLead })}
            className="rounded-full border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            Editar
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {lead.category && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{lead.category}</span>}
        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
          {lead.segment ? PROSPECT_SEGMENT_LABEL[lead.segment] || SEGMENT_LABEL[lead.segment] || lead.segment : 'Sem segmento'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Endereço</p>
          <AddressPreview lead={lead} />
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Contatos</p>
          <ContactPreview lead={lead} />
        </div>
      </div>
    </div>
  );
}

function ContactPreview({ lead }: { lead: ParsedLead | StoredProspectLead }) {
  const links = getContactLinks(lead);

  if (!links.whatsappDigits && !links.phoneDigits && !links.email && !links.site && !links.instagram && !links.facebook) {
    return <span>-</span>;
  }

  return (
    <div className="flex max-w-sm flex-wrap gap-1.5">
      {links.whatsappDigits && (
        <a href={`https://wa.me/${toBrazilPhone(links.whatsappDigits)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
          <MessageCircle className="h-3 w-3" />
          WhatsApp · {formatPhone(links.whatsappDigits)}
        </a>
      )}
      {links.phoneDigits && links.phoneDigits !== links.whatsappDigits && (
        <a href={`tel:${links.phoneDigits}`} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
          <Phone className="h-3 w-3" />
          Telefone · {formatPhone(links.phoneDigits)}
        </a>
      )}
      {links.email && (
        <a href={`mailto:${links.email}`} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
          <Mail className="h-3 w-3" />
          Email
        </a>
      )}
      {links.instagram && <ExternalContactLink href={links.instagram} label="Instagram" />}
      {links.facebook && <ExternalContactLink href={links.facebook} label="Facebook" />}
      {links.site && <ExternalContactLink href={links.site} label="Site" />}
    </div>
  );
}

function AddressPreview({ lead }: { lead: ParsedLead | StoredProspectLead }) {
  const address = [lead.address, lead.number, lead.district].filter(Boolean).join(', ');
  const city = [lead.city, lead.state].filter(Boolean).join('/');
  const zipCode = lead.zip_code ? `CEP ${lead.zip_code}` : null;

  if (!address && !city && !zipCode) return <span>-</span>;

  return (
    <div className="max-w-xs leading-snug">
      {address && <p className="text-gray-700">{address}</p>}
      {(city || zipCode) && <p className="text-gray-500">{[city, zipCode].filter(Boolean).join(' - ')}</p>}
    </div>
  );
}

function ExternalContactLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
      <ExternalLink className="h-3 w-3" />
      {label}
    </a>
  );
}

function Metric({ label, value, tone = 'gray' }: { label: string; value: number; tone?: 'gray' | 'green' | 'red' | 'amber' }) {
  const toneClass = {
    gray: 'text-gray-900',
    green: 'text-green-700',
    red: 'text-red-700',
    amber: 'text-amber-700',
  }[tone];

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
