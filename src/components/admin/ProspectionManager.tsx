import { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { AlertCircle, CheckCircle, FileText, Upload } from 'lucide-react';
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
}

const MAX_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;
const DANGEROUS_RAW_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

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

const CATEGORY_SEGMENT_MAP: Record<string, string> = {
  padaria: 'padaria',
  padaria_e_confeitaria: 'padaria',
  panificadora: 'padaria',
  padaria_artesanal: 'padaria',
  padaria_gourmet: 'padaria',
  cafetaria: 'cafeteria',
  cafetaria_artesanal: 'cafeteria',
  cafe_especial: 'cafeteria',
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
  };
}

export default function ProspectionManager() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [listName, setListName] = useState('');
  const [description, setDescription] = useState('');
  const [segment, setSegment] = useState('');
  const [selectedRep, setSelectedRep] = useState('');
  const [parseError, setParseError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [listCategories, setListCategories] = useState<Record<string, string[]>>({});
  const [assignmentDraft, setAssignmentDraft] = useState<Record<string, string>>({});
  const [assigningListId, setAssigningListId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: reps }, { data: prospectLists }, { data: leadCategories }] = await Promise.all([
      supabase.from('representatives').select('id,full_name,status').eq('status', 'active').order('full_name'),
      supabase
        .from('prospect_lists')
        .select('*, representatives(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('prospect_leads').select('prospect_list_id,category').not('category', 'is', null),
    ]);
    setRepresentatives(reps || []);
    setLists((prospectLists || []) as ProspectList[]);
    const categoriesByList = ((leadCategories || []) as ProspectLeadCategory[]).reduce<Record<string, Set<string>>>((acc, lead) => {
      if (!lead.category) return acc;
      if (!acc[lead.prospect_list_id]) acc[lead.prospect_list_id] = new Set<string>();
      acc[lead.prospect_list_id].add(lead.category);
      return acc;
    }, {});
    setListCategories(
      Object.fromEntries(Object.entries(categoriesByList).map(([listId, categories]) => [listId, Array.from(categories).sort()]))
    );
    setLoading(false);
  }

  const validLeads = useMemo(() => parsedLeads.filter(lead => lead.isValid), [parsedLeads]);
  const invalidLeads = useMemo(() => parsedLeads.filter(lead => !lead.isValid), [parsedLeads]);
  const leadsWithCoords = useMemo(
    () => validLeads.filter(lead => lead.lat !== null && lead.lng !== null).length,
    [validLeads]
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(Object.values(listCategories).flat())).sort(),
    [listCategories]
  );
  const filteredLists = useMemo(
    () =>
      categoryFilter
        ? lists.filter(list => (listCategories[list.id] || []).includes(categoryFilter))
        : lists,
    [categoryFilter, listCategories, lists]
  );

  async function handleProspectFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setParseError('');
    setSelectedFileName(file.name);
    setParsedLeads([]);
    if (!listName.trim()) {
      setListName(file.name.replace(/\.[^.]+$/, ''));
    }

    let parsedRows: Record<string, unknown>[];
    try {
      parsedRows = await parseProspectFile(file);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.');
      return;
    }
    const rows = parsedRows.filter(row => Object.values(row).some(value => normalizeValue(value)));
    if (rows.length === 0) {
      setParseError('Arquivo vazio ou sem cabeçalho reconhecido.');
      return;
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      setParseError(`Arquivo com muitas linhas. O limite atual é de ${MAX_IMPORT_ROWS.toLocaleString('pt-BR')} linhas por importação.`);
      return;
    }

    setParsedLeads(rows.map((row, index) => normalizeRow(row, index + 2, segment)));
  }

  async function handleCreateList() {
    if (!listName.trim()) {
      toast.error('Informe um nome para a lista.');
      return;
    }
    if (validLeads.length === 0) {
      toast.error('Importe um CSV com pelo menos uma linha valida.');
      return;
    }

    setSaving(true);
    const listStatus = selectedRep ? 'assigned' : 'imported';
    const uniqueSegments = Array.from(new Set(validLeads.map(lead => lead.segment).filter(Boolean)));
    const listSegment = segment || (uniqueSegments.length === 1 ? uniqueSegments[0] : null);
    const { data: list, error: listError } = await supabase
      .from('prospect_lists')
      .insert({
        name: listName.trim(),
        description: description.trim() || null,
        segment: listSegment,
        source_type: 'csv',
        source_name: selectedFileName || null,
        status: listStatus,
        assigned_representative_id: selectedRep || null,
        total_count: parsedLeads.length,
        pending_count: validLeads.length,
        invalid_count: invalidLeads.length,
        created_by: user?.id || null,
      })
      .select('id')
      .single();

    if (listError || !list) {
      toast.error('Erro ao criar lista de prospecção.');
      setSaving(false);
      return;
    }

    const payload = validLeads.map(lead => ({
      prospect_list_id: list.id,
      representative_id: selectedRep || null,
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
      status: selectedRep ? 'assigned' : 'new',
      created_by: user?.id || null,
    }));

    const { error: leadsError } = await supabase.from('prospect_leads').insert(payload);
    if (leadsError) {
      await supabase.from('prospect_lists').delete().eq('id', list.id);
      toast.error('Não foi possível salvar os leads. A lista criada foi removida para evitar cadastro incompleto.');
      setSaving(false);
      return;
    }

    toast.success(`Lista criada com ${validLeads.length} lead${validLeads.length !== 1 ? 's' : ''}.`);
    setSaving(false);
    resetImportForm();
    fetchData();
  }

  async function handleAssignList(list: ProspectList) {
    const representativeId = assignmentDraft[list.id] ?? list.assigned_representative_id ?? '';
    setAssigningListId(list.id);
    const { error } = await supabase
      .from('prospect_lists')
      .update({
        assigned_representative_id: representativeId || null,
        status: representativeId ? 'assigned' : 'imported',
      })
      .eq('id', list.id);

    setAssigningListId(null);
    if (error) {
      toast.error('Não foi possível atribuir a lista.');
      return;
    }

    toast.success(representativeId ? 'Lista atribuída ao representante.' : 'Atribuição removida da lista.');
    fetchData();
  }

  function resetImportForm() {
    setSelectedFileName('');
    setParsedLeads([]);
    setListName('');
    setDescription('');
    setSegment('');
    setSelectedRep('');
    setParseError('');
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
    <div className="space-y-6">
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
              onChange={event => setListName(event.target.value)}
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
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Setor / segmento</label>
            <select
              value={segment}
              onChange={event => {
                setSegment(event.target.value);
                setParsedLeads(current =>
                  current.map(lead => ({ ...lead, segment: normalizeCategorySegment(lead.category, event.target.value) }))
                );
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
            >
              <option value="">Não definido</option>
              {Object.entries(PROSPECT_SEGMENT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Descrição</label>
            <input
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Origem, região, observações"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a4240e]"
            />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">Colunas aceitas</p>
          <p className="mt-1 font-mono text-[11px]">
            title, name, nome_empresa, companyName, businessName, categoryName, categories/0, categories/1, categories,
            address, street, city, state, postalCode, location/lat, location/lng, phone, phones/0, email, emails/0,
            website, instagramUrl, facebookUrl
          </p>
        </div>

        {parseError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {parseError}
          </div>
        )}

        {parsedLeads.length > 0 && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Linhas" value={parsedLeads.length} />
              <Metric label="Válidas" value={validLeads.length} tone="green" />
              <Metric label="Inválidas" value={invalidLeads.length} tone={invalidLeads.length > 0 ? 'red' : 'gray'} />
              <Metric label="Com coordenada" value={leadsWithCoords} />
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="max-h-80 overflow-auto">
                <table className="w-full min-w-[940px] text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Linha</th>
                      <th className="px-3 py-2 text-left">Empresa</th>
                      <th className="px-3 py-2 text-left">Categoria</th>
                      <th className="px-3 py-2 text-left">Segmento</th>
                      <th className="px-3 py-2 text-left">CNPJ/CPF</th>
                      <th className="px-3 py-2 text-left">Cidade</th>
                      <th className="px-3 py-2 text-left">Contato</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {parsedLeads.slice(0, 50).map(lead => (
                      <tr key={lead.rowNumber}>
                        <td className="px-3 py-2 text-xs text-gray-500">{lead.rowNumber}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900">{lead.company_name || '-'}</p>
                          {lead.trade_name && <p className="text-xs text-gray-500">{lead.trade_name}</p>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{lead.category || '-'}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {lead.segment ? PROSPECT_SEGMENT_LABEL[lead.segment] || SEGMENT_LABEL[lead.segment] || lead.segment : '-'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{lead.cnpj || lead.cpf || '-'}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{lead.city || '-'}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{lead.phone || lead.whatsapp || lead.email || '-'}</td>
                        <td className="px-3 py-2">
                          {lead.isValid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                              <CheckCircle className="h-3 w-3" />
                              Válida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                              <AlertCircle className="h-3 w-3" />
                              {lead.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedLeads.length > 50 && (
                <p className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  Mostrando 50 de {parsedLeads.length} linhas no preview.
                </p>
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
                disabled={saving || validLeads.length === 0}
                className="rounded-lg bg-[#a4240e] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#8a1f0c] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? 'Criando...' : `Criar lista com ${validLeads.length} leads`}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">Listas de prospecção</h4>
            <p className="text-xs text-gray-500">{filteredLists.length} de {lists.length} lista{lists.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="w-full lg:w-72">
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

        {lists.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">Nenhuma lista de prospecção criada ainda.</div>
        ) : filteredLists.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">Nenhuma lista encontrada para esta categoria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Lista</th>
                  <th className="px-4 py-3 text-left">Categorias</th>
                  <th className="px-4 py-3 text-left">Representante</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Leads</th>
                  <th className="px-4 py-3 text-left">Criada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLists.map(list => (
                  <tr key={list.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{list.name}</p>
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
                          {assigningListId === list.id ? 'Atribuindo...' : 'Atribuir lista'}
                        </button>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone = 'gray' }: { label: string; value: number; tone?: 'gray' | 'green' | 'red' }) {
  const toneClass = {
    gray: 'text-gray-900',
    green: 'text-green-700',
    red: 'text-red-700',
  }[tone];

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
