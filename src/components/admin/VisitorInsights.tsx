import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, Loader2, Globe } from 'lucide-react';

interface Visit { city: string | null; region: string | null; country: string | null; created_at: string; }

export function VisitorInsights() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('site_visits')
        .select('city, region, country, created_at')
        .order('created_at', { ascending: false })
        .limit(5000);
      setVisits((data as Visit[]) || []);
      setLoading(false);
    })();
  }, []);

  const total = visits.length;
  const last30 = visits.filter(v => (Date.now() - new Date(v.created_at).getTime()) < 30 * 864e5).length;

  const topBy = (key: 'region' | 'city') => {
    const m = new Map<string, number>();
    for (const v of visits) {
      const k = (v[key] || '').trim();
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  };
  const topStates = topBy('region');
  const topCities = topBy('city');
  const maxState = topStates[0]?.[1] || 1;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-[#f5f0ef] rounded-lg flex items-center justify-center">
          <Globe className="w-5 h-5 text-[#8B2214]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Visitantes — de onde acessam</h3>
          <p className="text-sm text-gray-600">Localização aproximada por IP (cidade/estado), sem pedir permissão ao visitante.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-[#8B2214]" /></div>
      ) : total === 0 ? (
        <div className="text-center py-10 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          Ainda sem visitas registradas. Os acessos começam a aparecer conforme as pessoas abrem o site.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#faf7f6] border border-[#ddd0cc] rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase">Total de acessos</p>
              <p className="text-3xl font-bold text-[#8B2214]">{total}</p>
            </div>
            <div className="bg-[#faf7f6] border border-[#ddd0cc] rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase">Últimos 30 dias</p>
              <p className="text-3xl font-bold text-[#8B2214]">{last30}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="font-bold text-gray-900 mb-3">Por estado</p>
              <div className="space-y-2">
                {topStates.map(([name, n]) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-32 truncate">{name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div className="h-full bg-[#8B2214] rounded-full" style={{ width: `${(n / maxState) * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-600 w-8 text-right">{n}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-bold text-gray-900 mb-3 flex items-center gap-1"><MapPin className="w-4 h-4 text-[#8B2214]" /> Top cidades</p>
              <div className="space-y-1.5">
                {topCities.map(([name, n]) => (
                  <div key={name} className="flex justify-between text-sm py-1.5 px-3 rounded-lg bg-gray-50">
                    <span className="text-gray-800 truncate">{name}</span>
                    <span className="font-semibold text-gray-600">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
