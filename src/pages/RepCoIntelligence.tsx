import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, ShoppingBag, MapPin, Coffee, Lock, ArrowLeft, TrendingUp } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const PRIMARY = '#8B2214';
const fmtBRL = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtK = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : `R$ ${Math.round(v || 0)}`;

interface Row { [k: string]: any }
interface Agg { key: string; faturamento: number; pedidos: number; itens: number }

function aggregate(rows: Row[], keyFn: (r: Row) => string): Agg[] {
  const m = new Map<string, Agg>();
  rows.forEach(r => {
    const key = keyFn(r) || '—';
    const c = m.get(key) || { key, faturamento: 0, pedidos: 0, itens: 0 };
    c.faturamento += Number(r.faturamento) || 0;
    c.pedidos += Number(r.pedidos) || 0;
    c.itens += Number(r.itens) || 0;
    m.set(key, c);
  });
  return [...m.values()].sort((a, b) => b.faturamento - a.faturamento);
}

function goBack() {
  window.history.pushState({}, '', '/admin');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function RepCoIntelligence() {
  const { profile, loading } = useAuth();
  const [busy, setBusy] = useState(true);
  const [area, setArea] = useState<Row[]>([]);
  const [linha, setLinha] = useState<Row[]>([]);
  const [canal, setCanal] = useState<Row[]>([]);
  const [rep, setRep] = useState<Row[]>([]);
  const [preco, setPreco] = useState<Row[]>([]);

  useEffect(() => {
    if (!profile?.is_admin) return;
    let active = true;
    (async () => {
      setBusy(true);
      const [a, l, c, r, p] = await Promise.all([
        supabase.from('vw_repco_vendas_por_area').select('*'),
        supabase.from('vw_repco_vendas_por_linha').select('*'),
        supabase.from('vw_repco_vendas_por_canal').select('*'),
        supabase.from('vw_repco_vendas_por_rep').select('*'),
        supabase.from('vw_repco_preco_praticado').select('*'),
      ]);
      if (!active) return;
      setArea(a.data || []); setLinha(l.data || []); setCanal(c.data || []);
      setRep(r.data || []); setPreco(p.data || []);
      setBusy(false);
    })();
    return () => { active = false; };
  }, [profile?.is_admin]);

  if (loading) return <Center><div className="animate-spin rounded-full h-10 w-10 border-b-4" style={{ borderColor: PRIMARY }} /></Center>;

  if (!profile?.is_admin) return (
    <Center>
      <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-sm">
        <Lock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <h2 className="text-lg font-bold text-gray-900">Painel do Diretor Comercial</h2>
        <p className="text-sm text-gray-500 mt-1">Acesso restrito a administradores.</p>
      </div>
    </Center>
  );

  const areaAgg = aggregate(area, r => `${r.municipio || '—'} / ${r.uf || '—'}`);
  const linhaAgg = aggregate(linha, r => r.product_line);
  const canalAgg = aggregate(canal, r => r.canal);
  const totalFat = areaAgg.reduce((s, x) => s + x.faturamento, 0);
  const totalPed = areaAgg.reduce((s, x) => s + x.pedidos, 0);
  const ticket = totalPed ? totalFat / totalPed : 0;
  const maxArea = Math.max(...areaAgg.map(a => a.faturamento), 1);
  const maxLinha = Math.max(...linhaAgg.map(a => a.faturamento), 1);
  const reps = [...rep].sort((a, b) => (Number(b.faturamento) || 0) - (Number(a.faturamento) || 0));

  // Paleta de cores para cidades — cada cidade ganha uma cor distinta
  const MAP_PALETTE = ['#8B2214','#1d6fa4','#2e7d32','#6a1a8a','#b45309','#0e5f6b','#7b2d00','#1a3a6b','#4a5c00','#5c1a3a'];
  function cityColor(idx: number) { return MAP_PALETTE[idx % MAP_PALETTE.length]; }

  // Mapa: agrega coords por município (média), só pontos geocodificados
  const geoMap = new Map<string, { key: string; lat: number; lng: number; faturamento: number; pedidos: number; colorIdx: number }>();
  let colorCounter = 0;
  area.forEach(r => {
    if (r.lat == null || r.lng == null) return;
    const k = `${r.municipio} / ${r.uf}`;
    if (!geoMap.has(k)) {
      geoMap.set(k, { key: k, lat: Number(r.lat), lng: Number(r.lng), faturamento: 0, pedidos: 0, colorIdx: colorCounter++ });
    }
    const c = geoMap.get(k)!;
    c.faturamento += Number(r.faturamento) || 0; c.pedidos += Number(r.pedidos) || 0;
  });
  const areaGeo = [...geoMap.values()];
  const maxGeo = Math.max(...areaGeo.map(a => a.faturamento), 1);
  const mapCenter: [number, number] = areaGeo.length
    ? [areaGeo.reduce((s, a) => s + a.lat, 0) / areaGeo.length, areaGeo.reduce((s, a) => s + a.lng, 0) / areaGeo.length]
    : [-15.8, -47.9];

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inteligência Comercial</h1>
            <p className="text-sm text-gray-500">Visão do Diretor — dados próprios da Saporino (todas as vendas concluídas)</p>
          </div>
        </div>

        {busy ? <Center><div className="animate-spin rounded-full h-10 w-10 border-b-4" style={{ borderColor: PRIMARY }} /></Center> : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Kpi icon={<DollarSign className="w-4 h-4 text-green-600" />} label="Faturamento" value={fmtBRL(totalFat)} />
              <Kpi icon={<ShoppingBag className="w-4 h-4 text-blue-600" />} label="Pedidos" value={String(totalPed)} />
              <Kpi icon={<TrendingUp className="w-4 h-4" style={{ color: PRIMARY }} />} label="Ticket médio" value={fmtBRL(ticket)} valueColor={PRIMARY} />
            </div>

            {totalPed === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p>Sem vendas concluídas ainda — os painéis enchem conforme os pedidos.</p>
              </div>
            )}

            {/* Mapa de calor geográfico */}
            {areaGeo.length > 0 && (
              <Panel title="Mapa de calor de vendas" icon={<MapPin className="w-4 h-4" />} hint="tamanho do círculo = faturamento">
                {/* Legenda de cores */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {areaGeo.map(a => (
                    <div key={a.key} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                      <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cityColor(a.colorIdx) }} />
                      {a.key}
                      <span className="text-gray-400 font-normal">{fmtK(a.faturamento)}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg overflow-hidden border border-gray-100" style={{ height: 360 }}>
                  <MapContainer center={mapCenter} zoom={areaGeo.length === 1 ? 9 : 7} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {areaGeo.map(a => {
                      const col = cityColor(a.colorIdx);
                      return (
                        <CircleMarker key={a.key} center={[a.lat, a.lng]} radius={8 + (a.faturamento / maxGeo) * 22}
                          pathOptions={{ color: col, fillColor: col, fillOpacity: 0.55, weight: 2 }}>
                          <Tooltip permanent={false}>{a.key} · {fmtBRL(a.faturamento)} · {a.pedidos} ped.</Tooltip>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                </div>
              </Panel>
            )}

            {/* Vendas por região + por linha */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Vendas por região" icon={<MapPin className="w-4 h-4" />} hint="mapa por pino chega com geocodificação">
                {areaAgg.length === 0 ? <Empty /> : areaAgg.slice(0, 12).map(a => (
                  <BarRow key={a.key} label={a.key} value={fmtK(a.faturamento)} pct={(a.faturamento / maxArea) * 100} sub={`${a.pedidos} ped.`} />
                ))}
              </Panel>
              <Panel title="Vendas por linha de produto" icon={<Coffee className="w-4 h-4" />}>
                {linhaAgg.length === 0 ? <Empty /> : linhaAgg.map(a => (
                  <BarRow key={a.key} label={a.key} value={fmtK(a.faturamento)} pct={(a.faturamento / maxLinha) * 100} sub={`${a.itens} itens`} />
                ))}
              </Panel>
            </div>

            {/* Ranking de representantes */}
            <Panel title="Ranking de representantes">
              {reps.length === 0 ? <Empty /> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-gray-500 uppercase text-left">
                    <th className="py-2">#</th><th className="py-2">Representante</th>
                    <th className="py-2 text-right">Pedidos</th><th className="py-2 text-right">Faturamento</th>
                    <th className="py-2 text-right">Ticket médio</th><th className="py-2 text-right">Clientes</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {reps.map((r, i) => (
                      <tr key={r.representative_id || i} className="hover:bg-gray-50">
                        <td className="py-2 text-gray-400">{i + 1}</td>
                        <td className="py-2 font-medium text-gray-900">{r.rep_nome || '—'}</td>
                        <td className="py-2 text-right text-gray-600">{r.pedidos}</td>
                        <td className="py-2 text-right font-semibold text-gray-900">{fmtBRL(Number(r.faturamento))}</td>
                        <td className="py-2 text-right text-gray-600">{fmtBRL(Number(r.ticket_medio))}</td>
                        <td className="py-2 text-right text-gray-600">{r.clientes_com_pedido}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            {/* Preço praticado + canal */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Preço praticado por linha / UF" hint="detecta erosão de preço">
                {preco.length === 0 ? <Empty /> : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-gray-500 uppercase text-left">
                      <th className="py-2">Linha</th><th className="py-2">UF</th>
                      <th className="py-2 text-right">Preço médio</th><th className="py-2 text-right">Itens</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {preco.map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="py-2 text-gray-900">{p.product_line}</td>
                          <td className="py-2 text-gray-600">{p.uf || '—'}</td>
                          <td className="py-2 text-right font-semibold text-gray-900">{fmtBRL(Number(p.preco_medio))}</td>
                          <td className="py-2 text-right text-gray-600">{p.itens}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
              <Panel title="Vendas por canal">
                {canalAgg.length === 0 ? <Empty /> : canalAgg.map(a => (
                  <BarRow key={a.key} label={a.key} value={fmtK(a.faturamento)} pct={(a.faturamento / Math.max(...canalAgg.map(c => c.faturamento), 1)) * 100} sub={`${a.pedidos} ped.`} />
                ))}
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center px-4">{children}</div>;
}
function Kpi({ icon, label, value, valueColor }: { icon: React.ReactNode; label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className="text-2xl font-bold" style={{ color: valueColor || '#111827' }}>{value}</p>
    </div>
  );
}
function Panel({ title, icon, hint, children }: { title: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">{icon}{title}</h3>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function BarRow({ label, value, pct, sub }: { label: string; value: string; pct: number; sub?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-32 truncate" title={label}>{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: PRIMARY }} />
      </div>
      <span className="text-xs text-gray-700 font-medium w-20 text-right">{value}</span>
      {sub && <span className="text-[10px] text-gray-400 w-14 text-right">{sub}</span>}
    </div>
  );
}
function Empty() { return <p className="text-sm text-gray-400 py-4 text-center">Sem dados ainda</p>; }
