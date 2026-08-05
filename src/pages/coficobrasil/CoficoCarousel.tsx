// Carrossel do topo da página COFICO. Lê promo_banners (site='cofico', ativos) via client próprio.
// Some sozinho se não houver banner COFICO — a página fica igual até você adicionar no admin.
import { useEffect, useState } from 'react';
import { coficoDb } from './coficoClient';

interface Banner { id: string; image_url: string; link_url: string | null; }

export default function CoficoCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    coficoDb.from('promo_banners').select('id,image_url,link_url')
      .eq('site', 'cofico').eq('active', true).order('sort_order', { ascending: true })
      .then(({ data }) => setBanners((data as Banner[]) || []));
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setI(v => (v + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;
  const b = banners[i];
  const img = <img src={b.image_url} alt="" className="w-full h-full object-cover" />;

  return (
    <div className="relative w-full aspect-[16/7] md:aspect-[1900/650] overflow-hidden bg-neutral-100 border-b border-neutral-200">
      {b.link_url ? <a href={b.link_url} className="block w-full h-full">{img}</a> : img}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Banner ${k + 1}`} className={`w-2 h-2 rounded-full transition-colors ${k === i ? 'bg-white' : 'bg-white/50 hover:bg-white/80'}`} />)}
        </div>
      )}
    </div>
  );
}
