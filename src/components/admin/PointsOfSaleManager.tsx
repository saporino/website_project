import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Store, Loader2, Search, AlertTriangle } from 'lucide-react';

interface Client {
  id: string;
  nome_fantasia: string | null;
  razao_social: string | null;
  municipio: string | null;
  uf: string | null;
  lat: number | null;
  lng: number | null;
  public_pos: boolean;
}

export function PointsOfSaleManager() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('representative_clients')
      .select('id, nome_fantasia, razao_social, municipio, uf, lat, lng, public_pos')
      .or('is_active_client.is.null,is_active_client.eq.true')
      .order('nome_fantasia', { ascending: true })
      .limit(2000);
    setClients((data as Client[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (c: Client) => {
    const v = !c.public_pos;
    setClients(cs => cs.map(x => x.id === c.id ? { ...x, public_pos: v } : x));
    await supabase.from('representative_clients').update({ public_pos: v }).eq('id', c.id);
  };

  const nome = (c: Client) => c.nome_fantasia?.trim() || c.razao_social || 'Cliente';
  const filtered = clients.filter(c => {
    const t = (q || '').toLowerCase();
    return !t || nome(c).toLowerCase().includes(t) || (c.municipio || '').toLowerCase().includes(t);
  });
  const ativos = clients.filter(c => c.public_pos).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-[#f5f0ef] rounded-lg flex items-center justify-center">
          <Store className="w-5 h-5 text-[#8B2214]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Pontos de Venda (Onde encontrar)</h3>
          <p className="text-sm text-gray-600">Marque quais clientes PJ aparecem no localizador da loja. {ativos} ativo(s).</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou cidade..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#8B2214]" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-[#8B2214]" /></div>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
          {filtered.map((c) => {
            const semGeo = c.lat == null || c.lng == null;
            return (
              <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{nome(c)}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    {c.municipio ? `${c.municipio}/${c.uf}` : 'sem cidade'}
                    {c.public_pos && semGeo && <span className="text-amber-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> sem localização — não aparece até geocodificar</span>}
                  </p>
                </div>
                <button onClick={() => toggle(c)} role="switch" aria-checked={c.public_pos}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-3 ${c.public_pos ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${c.public_pos ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">Nenhum cliente encontrado.</p>}
        </div>
      )}
    </div>
  );
}
