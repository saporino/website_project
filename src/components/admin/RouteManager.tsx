import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { parseRouteCSV, geocodeAddress, optimizeRoute } from '../../utils/routeOptimizer';
import type { StopWithCoords } from '../../utils/routeOptimizer';
import { CLIENT_SEGMENTS } from '../../constants/segments';

interface Representative { id: string; full_name: string; status: string; }
interface Route {
  id: string; name: string; representative_id: string;
  status: string; created_at: string;
  representatives?: { full_name: string };
}
type ManagerView = 'list' | 'create';

export default function RouteManager() {
  const [view, setView] = useState<ManagerView>('list');
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvStops, setCsvStops] = useState<StopWithCoords[]>([]);
  const [selectedRep, setSelectedRep] = useState('');
  const [routeName, setRouteName] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState(0);
  const [optimized, setOptimized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [routeType, setRouteType] = useState('visit');
  const [region, setRegion] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [maxWeightKg, setMaxWeightKg] = useState(800);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: reps }, { data: rts }] = await Promise.all([
      supabase.from('representatives').select('id,full_name,status').eq('status', 'active').order('full_name'),
      supabase.from('representative_routes')
        .select('id,name,representative_id,status,created_at,representatives(full_name)')
        .order('created_at', { ascending: false }),
    ]);
    if (reps) setRepresentatives(reps);
    if (rts) setRoutes(rts as Route[]);
    setLoading(false);
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setOptimized(false); setGeocodeProgress(0);
    const text = await file.text();
    const stops = await parseRouteCSV(text);
    if (stops.length === 0) { setError('Nenhum endereço encontrado. Colunas esperadas: nome_empresa, endereco, cidade'); return; }
    setCsvStops(stops.map(s => ({ ...s, lat: s.lat ?? 0, lng: s.lng ?? 0, geocoded: !!(s.lat && s.lng) })));
  }

  async function handleGeocode() {
    if (csvStops.length === 0) return;
    setGeocoding(true); setGeocodeProgress(0); setError('');
    const result: StopWithCoords[] = [];
    for (let i = 0; i < csvStops.length; i++) {
      const stop = csvStops[i];
      if (stop.geocoded && stop.lat && stop.lng) { result.push(stop); }
      else {
        await new Promise(r => setTimeout(r, 1100));
        const coords = await geocodeAddress(stop.address || '', stop.city || '');
        result.push({ ...stop, lat: coords?.lat ?? -23.55052, lng: coords?.lng ?? -46.633308, geocoded: !!coords });
      }
      setGeocodeProgress(Math.round(((i + 1) / csvStops.length) * 100));
      setCsvStops([...result, ...csvStops.slice(i + 1)]);
    }
    setCsvStops(result);
    setGeocoding(false);
  }

  function handleOptimize() {
    setCsvStops(optimizeRoute(csvStops, {
      filterSegment: segmentFilter || undefined,
      filterRegion: region || undefined,
      maxWeightKg,
    }));
    setOptimized(true);
  }

  async function handleSaveRoute() {
    if (!routeName.trim()) { setError('Dê um nome para a rota.'); return; }
    if (!selectedRep) { setError('Selecione o representante.'); return; }
    if (csvStops.length === 0) { setError('Adicione pontos via CSV.'); return; }
    setSaving(true); setError('');
    const { data: route, error: routeErr } = await supabase
      .from('representative_routes').insert({ name: routeName, representative_id: selectedRep, status: 'active', route_type: routeType, region: region || null, segment_filter: segmentFilter || null, max_weight_kg: maxWeightKg }).select().single();
    if (routeErr || !route) { setError('Erro ao criar rota.'); setSaving(false); return; }
    const { error: stopsErr } = await supabase.from('route_stops').insert(
      csvStops.map((s, i) => ({ route_id: route.id, stop_order: i + 1, company_name: s.company_name, address: s.address, city: s.city, phone: s.phone, segment: s.segment, lat: s.lat, lng: s.lng, visit_status: 'pending' }))
    );
    if (stopsErr) { setError('Erro ao salvar pontos: ' + stopsErr.message); setSaving(false); return; }
    setSuccess(`Rota "${routeName}" criada com ${csvStops.length} pontos!`);
    setSaving(false); setView('list'); setCsvStops([]); setRouteName(''); setSelectedRep(''); setOptimized(false);
    fetchData(); setTimeout(() => setSuccess(''), 4000);
  }

  async function handleDeleteRoute(id: string) {
    if (!confirm('Excluir esta rota e todos os seus pontos?')) return;
    await supabase.from('representative_routes').delete().eq('id', id);
    fetchData();
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a4240e]"/></div>;

  return (
    <div className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

      {view === 'list' && (
        <>
          <div className="flex items-center justify-between">
            <div><h4 className="font-semibold text-gray-800">Rotas de Visita</h4><p className="text-xs text-gray-500">{routes.length} rota{routes.length !== 1 ? 's' : ''}</p></div>
            <button onClick={() => setView('create')} className="bg-[#a4240e] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#8a1f0c]">+ Nova Rota</button>
          </div>
          {routes.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-3">ðŸ—ºï¸</p><p className="font-medium">Nenhuma rota criada ainda</p><p className="text-sm mt-1">Clique em "Nova Rota" para fazer upload de um CSV</p></div>
          ) : (
            <div className="space-y-2">
              {routes.map(route => (
                <div key={route.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div><p className="font-medium text-gray-800">{route.name}</p><p className="text-xs text-gray-500 mt-0.5">{(route.representatives as any)?.full_name ?? 'â€”'} Â· {new Date(route.created_at).toLocaleDateString('pt-BR')}</p></div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${route.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{route.status === 'active' ? 'Ativa' : 'Inativa'}</span>
                      <button onClick={() => handleDeleteRoute(route.id)} className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50">Excluir</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'create' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => { setView('list'); setCsvStops([]); setError(''); }} className="text-sm text-gray-500 hover:text-gray-700">â€¹ Voltar</button>
            <h4 className="font-semibold text-gray-800">Nova Rota</h4>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">1. InformaçÃµes</p>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nome da rota *</label><input type="text" value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Ex: Zona Sul SP â€” Semana 20" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] outline-none"/></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Representante *</label>
              <select value={selectedRep} onChange={e => setSelectedRep(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] outline-none">
                <option value="">Selecione...</option>
                {representatives.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select></div>

            {/* Tipo de rota */}
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Tipo de rota</label>
              <select value={routeType} onChange={e => setRouteType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] outline-none">
                <option value="visit">Visita</option>
                <option value="delivery">Entrega</option>
                <option value="prospection">Prospecção</option>
              </select></div>

            {/* Região */}
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Região / Cidade</label>
              <input type="text" value={region} onChange={e => setRegion(e.target.value)} placeholder="Ex: Zona Sul SP, Osasco" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] outline-none" /></div>

            {/* Filtro de segmento */}
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Filtrar por segmento (opcional)</label>
              <select value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] outline-none">
                <option value="">Todos os segmentos</option>
                {CLIENT_SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>

            {/* Capacidade máxima */}
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Capacidade máxima (kg)</label>
              <input type="number" value={maxWeightKg} onChange={e => setMaxWeightKg(parseFloat(e.target.value) || 800)} min={100} max={2000} step={50} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#a4240e] outline-none" />
              <p className="text-xs text-gray-400 mt-1">Kangoo: ~800kg recomendado</p></div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">2. Upload CSV</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Colunas esperadas no CSV:</p>
              <p className="font-mono bg-white/60 px-2 py-1 rounded">nome_empresa, endereco, cidade, telefone, segmento</p>
              <p className="opacity-70">Cabeçalho obrigatório. Separado por vírgula. UTF-8.</p>
            </div>
            <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#a4240e] hover:bg-red-50/20 transition-colors">
              <p className="text-2xl mb-2">ðŸ“‚</p>
              <p className="text-sm font-medium text-gray-700">Clique para selecionar o CSV</p>
              <p className="text-xs text-gray-400 mt-1">Exportado do Google Sheets, Excel, Scraper, etc.</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCSVUpload} className="hidden"/>
            </div>

            {csvStops.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-700">{csvStops.length} endereços carregados</p>
                  <div className="flex gap-2">
                    {!geocoding && geocodeProgress < 100 && (
                      <button onClick={handleGeocode} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Geocodificar</button>
                    )}
                    {geocodeProgress === 100 && !optimized && (
                      <button onClick={handleOptimize} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">âœ¨ Otimizar rota</button>
                    )}
                    {optimized && <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium">âœ“ Otimizada</span>}
                  </div>
                </div>
                {geocoding && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500"><span>Geocodificando...</span><span>{geocodeProgress}%</span></div>
                    <div className="bg-gray-200 rounded-full h-2"><div className="bg-[#a4240e] h-2 rounded-full transition-all" style={{ width: geocodeProgress + '%' }}/></div>
                    <p className="text-xs text-gray-400">Aguarde â€” 1 req/s (OpenStreetMap)</p>
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {csvStops.map((stop, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
                      <span className="text-xs font-mono text-gray-400 w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0"><p className="text-xs font-medium text-gray-800 truncate">{stop.company_name}</p><p className="text-xs text-gray-400 truncate">{stop.address}{stop.city ? `, ${stop.city}` : ''}</p></div>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stop.geocoded ? 'bg-green-400' : 'bg-gray-300'}`}/>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={handleSaveRoute} disabled={saving || csvStops.length === 0 || !routeName || !selectedRep}
            className="w-full bg-[#a4240e] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#8a1f0c] disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? 'Salvando...' : `Salvar rota com ${csvStops.length} pontos`}
          </button>
        </div>
      )}
    </div>
  );
}

