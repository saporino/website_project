import { useState } from 'react';
import { MapPin, Search, Loader2, Navigation, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface POS {
  id: string;
  nome: string | null;
  endereco_completo: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  whatsapp: string | null;
  lat: number;
  lng: number;
  dist?: number;
}

const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371; const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const onlyDigits = (s: string) => s.replace(/\D/g, '');
const fmtCep = (s: string) => { const d = onlyDigits(s).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
const mapsHref = (p: POS) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([p.nome, p.endereco_completo, p.municipio, p.uf].filter(Boolean).join(', '))}`;
const wazeHref = (p: POS) => `https://waze.com/ul?q=${encodeURIComponent([p.endereco_completo, p.municipio, p.uf].filter(Boolean).join(', '))}`;

export default function StoreLocator() {
  const [cep, setCep] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<POS[] | null>(null);
  const [erro, setErro] = useState('');

  const buscar = async () => {
    const d = onlyDigits(cep);
    if (d.length !== 8) { setErro('Digite um CEP válido (8 dígitos).'); return; }
    setErro(''); setLoading(true); setResults(null);
    try {
      // 1. CEP -> endereco (ViaCEP)
      const via = await fetch(`https://viacep.com.br/ws/${d}/json/`).then(r => r.json());
      if (via.erro) { setErro('CEP não encontrado.'); setLoading(false); return; }
      const q = [via.logradouro, via.localidade, via.uf, 'Brasil'].filter(Boolean).join(', ');
      // 2. endereco -> coordenadas (Nominatim)
      const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`).then(r => r.json());
      const fallback = geo.length === 0 ? await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent([via.localidade, via.uf, 'Brasil'].filter(Boolean).join(', '))}`).then(r => r.json()) : geo;
      if (!fallback.length) { setErro('Não consegui localizar esse CEP no mapa.'); setLoading(false); return; }
      const origin = { lat: parseFloat(fallback[0].lat), lng: parseFloat(fallback[0].lon) };
      // 3. pontos de venda publicos
      const { data } = await supabase.from('points_of_sale').select('*');
      const pos = ((data as POS[]) || [])
        .map(p => ({ ...p, dist: haversine(origin, { lat: p.lat, lng: p.lng }) }))
        .sort((a, b) => (a.dist || 0) - (b.dist || 0))
        .slice(0, 8);
      setResults(pos);
    } catch {
      setErro('Erro ao buscar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-16 bg-[#f8f7f5]">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
        <MapPin className="w-10 h-10 text-[#8B2214] mx-auto mb-3" />
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Onde encontrar Café Saporino</h2>
        <p className="text-gray-600 mb-6">Digite seu CEP e veja os pontos de venda mais próximos de você.</p>

        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            value={cep}
            onChange={(e) => setCep(fmtCep(e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
            placeholder="Seu CEP"
            inputMode="numeric"
            className="flex-1 px-5 py-3 rounded-full border border-gray-300 focus:ring-2 focus:ring-[#8B2214] focus:border-transparent text-center sm:text-left"
          />
          <button onClick={buscar} disabled={loading}
            className="inline-flex items-center justify-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold px-7 py-3 rounded-full transition-colors disabled:bg-gray-400">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />} Buscar
          </button>
        </div>
        {erro && <p className="text-red-600 text-sm mt-3">{erro}</p>}

        {results && (
          <div className="mt-8 text-left space-y-3">
            {results.length === 0 ? (
              <p className="text-center text-gray-500 py-6">Ainda não temos pontos de venda cadastrados. Em breve!</p>
            ) : (<>
            <p className="text-center text-sm text-gray-500 mb-2">Pontos de venda mais próximos de você (do mais perto ao mais distante):</p>
            {results.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{p.nome || 'Ponto de venda'}</p>
                  <p className="text-sm text-gray-600">{[p.endereco_completo, p.bairro, p.municipio && `${p.municipio}/${p.uf}`].filter(Boolean).join(' · ')}</p>
                  {typeof p.dist === 'number' && <p className="text-sm font-semibold text-[#8B2214] mt-1">a ~{p.dist < 1 ? `${Math.round(p.dist * 1000)} m` : `${p.dist.toFixed(1)} km`}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {p.whatsapp && (
                    <a href={`https://wa.me/55${onlyDigits(p.whatsapp)}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                      className="w-10 h-10 rounded-full bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center"><MessageCircle className="w-5 h-5" /></a>
                  )}
                  <a href={wazeHref(p)} target="_blank" rel="noopener noreferrer" title="Waze"
                    className="w-10 h-10 rounded-full bg-[#f5f0ef] text-[#8B2214] hover:bg-[#ece3e1] flex items-center justify-center text-xs font-bold">Waze</a>
                  <a href={mapsHref(p)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-full">
                    <Navigation className="w-4 h-4" /> Como chegar
                  </a>
                </div>
              </div>
            ))}
            </>)}
          </div>
        )}
      </div>
    </section>
  );
}
