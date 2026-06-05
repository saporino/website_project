import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Truck, MapPin, Camera, CheckCircle, Navigation2 } from 'lucide-react';

interface Props { representativeId: string; currentLat?: number; currentLng?: number; previewMode?: boolean; refreshKey?: number; }

interface Client { razao_social: string | null; nome_fantasia: string | null; endereco_completo: string | null; municipio: string | null; uf: string | null; lat: number | null; lng: number | null; }
interface Delivery {
  id: string; order_number: string | null; total_amount: number; delivery_status: string;
  delivery_proof_url: string | null; delivery_proof_filename: string | null; delivered_at: string | null;
  client: Client | null;
}

const fmtBRL = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const fmtDist = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`);
const clientName = (c: Client | null) => c?.nome_fantasia || c?.razao_social || 'Cliente';

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'A aceitar', cls: 'bg-amber-100 text-amber-700' },
  em_rota: { label: 'Em rota', cls: 'bg-blue-100 text-blue-700' },
  entregue: { label: 'Entregue', cls: 'bg-green-100 text-green-700' },
};

export default function RepCoDeliveries({ representativeId, currentLat, currentLng, previewMode = false, refreshKey = 0 }: Props) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function fetchDeliveries() {
    setLoading(true);
    const { data } = await supabase
      .from('representative_orders')
      .select('id,order_number,total_amount,delivery_status,delivery_proof_url,delivery_proof_filename,delivered_at,representative_clients(razao_social,nome_fantasia,endereco_completo,municipio,uf,lat,lng)')
      .eq('representative_id', representativeId)
      .order('created_at', { ascending: false });
    const rows: Delivery[] = (data || []).map((o: any) => ({
      ...o,
      client: Array.isArray(o.representative_clients) ? o.representative_clients[0] || null : o.representative_clients || null,
    }));
    setDeliveries(rows);
    setLoading(false);
  }
  useEffect(() => { fetchDeliveries(); /* eslint-disable-next-line */ }, [representativeId, refreshKey]);

  const hasGps = currentLat !== undefined && currentLng !== undefined;
  const distOf = (d: Delivery) => (hasGps && d.client?.lat != null && d.client?.lng != null ? distanceKm(currentLat!, currentLng!, d.client.lat, d.client.lng) : null);

  const pendentes = deliveries.filter(d => d.delivery_status !== 'entregue')
    .sort((a, b) => { const da = distOf(a), db = distOf(b); if (da != null && db != null) return da - db; if (da != null) return -1; if (db != null) return 1; return 0; });
  const concluidas = deliveries.filter(d => d.delivery_status === 'entregue');

  async function aceitar(d: Delivery) {
    if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
    setBusy(d.id);
    const { error } = await supabase.rpc('repco_update_delivery', { p_order_id: d.id, p_status: 'em_rota' });
    setBusy(null);
    if (error) { toast.error('Erro ao aceitar entrega'); return; }
    toast.success('Entrega aceita — está na sua rota');
    fetchDeliveries();
  }

  function registrarEntrega(d: Delivery) {
    if (previewMode) { toast.info('Ação desativada no espelho.'); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*,application/pdf'; input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; try { input.remove(); } catch {}
      if (!file) return;
      setBusy(d.id);
      const path = `canhoto/${d.id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('invoices').upload(path, file, { upsert: true });
      if (error || !data) { toast.error('Erro ao enviar o canhoto'); setBusy(null); return; }
      // invoices é bucket PRIVADO → guardar o PATH (não URL pública); ver via createSignedUrl.
      const { error: rpcErr } = await supabase.rpc('repco_update_delivery', {
        p_order_id: d.id, p_status: 'entregue', p_proof_url: data.path || path, p_proof_filename: file.name,
        p_lat: currentLat ?? null, p_lng: currentLng ?? null,
      });
      setBusy(null);
      if (rpcErr) { toast.error('Erro ao registrar entrega'); return; }
      toast.success('Entrega registrada com canhoto!');
      window.dispatchEvent(new CustomEvent('repco:orders-updated', { detail: { representativeId } }));
      fetchDeliveries();
    });
    document.body.appendChild(input); input.click();
  }

  async function verCanhoto(pathOrUrl: string) {
    // Bucket privado → URL assinada. Aceita path novo OU URL pública antiga (extrai o path).
    let path = pathOrUrl;
    const m = pathOrUrl.match(/\/invoices\/(.+)$/);
    if (m) path = decodeURIComponent(m[1]);
    const { data, error } = await supabase.storage.from('invoices').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { toast.error('Não foi possível abrir o canhoto'); return; }
    window.open(data.signedUrl, '_blank');
  }

  function navegar(d: Delivery, app: 'google' | 'waze') {
    // Usa nome + endereço completo — mais confiável que coordenadas brutas,
    // que podem estar geocodificadas para o negócio vizinho.
    const c = d.client;
    const name = clientName(c);
    const address = c?.endereco_completo || [c?.municipio, c?.uf].filter(Boolean).join(', ') || '';
    const query = [name, address].filter(Boolean).join(', ');
    const encoded = encodeURIComponent(query);
    const url = app === 'waze'
      ? `https://waze.com/ul?q=${encoded}&navigate=yes`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    window.open(url, '_blank');
  }

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#a4240e]" /></div>;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-gray-800">Minhas Entregas</h3>
        <p className="text-xs text-gray-500">
          {pendentes.length} para entregar{hasGps ? ' · do mais perto ao mais longe' : ' · ative o GPS para ordenar por distância'}.
        </p>
      </div>

      {deliveries.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <Truck className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="font-medium text-gray-500">Nenhuma entrega pessoal.</p>
          <p className="mt-1 text-sm text-gray-400">Pedidos marcados como entrega pessoal (+2,5%) aparecem aqui.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pendentes.map(d => {
            const dist = distOf(d);
            const st = STATUS[d.delivery_status] || STATUS.pendente;
            return (
              <div key={d.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{d.order_number || '—'}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                      {dist != null && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">{fmtDist(dist)}</span>}
                    </div>
                    <p className="truncate text-xs text-gray-600">{clientName(d.client)}</p>
                    {d.client?.endereco_completo && (
                      <p className="mt-1 flex items-start gap-1.5 text-[11px] text-gray-500"><MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" /><span>{d.client.endereco_completo}</span></p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-bold text-gray-900">{fmtBRL(d.total_amount)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button onClick={() => navegar(d, 'google')} className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"><Navigation2 className="h-3.5 w-3.5" /> Google Maps</button>
                  <button onClick={() => navegar(d, 'waze')} className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"><Navigation2 className="h-3.5 w-3.5" /> Waze</button>
                  {d.delivery_status === 'pendente' ? (
                    <button disabled={busy === d.id} onClick={() => aceitar(d)} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-md bg-[#8B2214] px-2 py-2 text-xs font-semibold text-white hover:bg-[#6d1a10] disabled:opacity-50"><Truck className="h-4 w-4" /> {busy === d.id ? '...' : 'Aceitar entrega (entrar na rota)'}</button>
                  ) : (
                    <button disabled={busy === d.id} onClick={() => registrarEntrega(d)} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-md bg-green-600 px-2 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"><Camera className="h-4 w-4" /> {busy === d.id ? '...' : 'Marcar entregue + foto do canhoto'}</button>
                  )}
                </div>
              </div>
            );
          })}

          {concluidas.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Entregues</p>
              <div className="space-y-2">
                {concluidas.map(d => (
                  <div key={d.id} className="rounded-xl border border-green-200 bg-green-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-gray-900">{d.order_number}</span>
                        <p className="truncate text-xs text-gray-600">{clientName(d.client)}</p>
                        {d.delivered_at && <p className="text-[10px] text-green-700">Entregue em {new Date(d.delivered_at).toLocaleString('pt-BR')}</p>}
                      </div>
                      <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
                    </div>
                    {d.delivery_proof_url && (
                      <button onClick={() => verCanhoto(d.delivery_proof_url!)} className="mt-2 inline-flex items-center gap-1 text-xs text-green-700 hover:underline"><Camera className="h-3.5 w-3.5" /> Ver canhoto{d.delivery_proof_filename ? ` (${d.delivery_proof_filename})` : ''}</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
