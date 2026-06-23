import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Coffee, ShieldCheck, Award, MapPin } from 'lucide-react';

interface Prod { id: string; name: string; description: string | null; weight_grams: number; image_url: string | null; is_active: boolean; }

const goStore = () => {
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
  setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 300);
};

// Página de marca: Café Canaan. Linkada do rodapé ("Nossas Marcas").
export default function CanaanPage() {
  const [prods, setProds] = useState<Prod[]>([]);
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    (async () => {
      const [{ data: p }, { data: pop }] = await Promise.all([
        supabase.from('products').select('id,name,description,weight_grams,image_url,is_active').ilike('name', '%canaan%').order('display_order'),
        supabase.from('popup_settings').select('logo_url').not('logo_url', 'is', null).limit(1).maybeSingle(),
      ]);
      setProds((p as Prod[]) || []);
      setLogo((pop as any)?.logo_url || null);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      {/* Barra topo */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={goStore} className="inline-flex items-center gap-2 text-gray-600 hover:text-[#8B2214] text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Voltar à loja
          </button>
          <img src="/saporino-logo-tight.png" alt="Café Saporino" className="h-8 w-auto object-contain" />
        </div>
      </div>

      {/* Hero da marca */}
      <section className="bg-[#8B2214] text-white">
        <div className="max-w-6xl mx-auto px-6 py-14 text-center">
          {logo && (
            <div className="inline-flex bg-white rounded-2xl px-10 py-8 mb-6 shadow-lg">
              <img src={logo} alt="Café Canaan" className="h-40 w-auto object-contain" />
            </div>
          )}
          <h1 className="text-4xl md:text-5xl font-bold mb-3">Café Canaan</h1>
          <p className="text-white/85 text-lg max-w-2xl mx-auto">Tradição desde 1950. Café <strong>100% Conilon puro</strong>, de origem <strong>capixaba (Espírito Santo)</strong> — torrado e moído, o sabor de sempre. Distribuído oficialmente pela Café Saporino.</p>
        </div>
      </section>

      {/* Sobre */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Sobre a marca</h2>
        <p className="text-gray-600 leading-relaxed mb-3">
          O <strong>Café Canaan</strong> é uma marca tradicional, com história desde 1950, reconhecida pelo café <strong>100% Conilon puro</strong>, de <strong>origem capixaba (Espírito Santo)</strong>, e pelo sabor encorpado do dia a dia. Está disponível nas versões <strong>Tradicional</strong> e <strong>Extra Forte</strong>, em embalagens de 250g e 500g.
        </p>
        <p className="text-gray-600 leading-relaxed">
          A <strong>Café Saporino</strong> é <strong>distribuidora oficial</strong> do Café Canaan, levando a marca ao varejo e ao seu negócio (food service, atacado e mercados) com a confiança de uma operação que cuida da entrega de ponta a ponta.
        </p>
      </section>

      {/* Diferenciais */}
      <section className="max-w-5xl mx-auto px-6 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: ShieldCheck, t: '100% Conilon Puro', d: 'Sem misturas' },
            { icon: MapPin, t: 'Origem Capixaba', d: 'Espírito Santo' },
            { icon: Award, t: 'Desde 1950', d: 'Marca tradicional' },
            { icon: Coffee, t: 'Tradicional e Extra Forte', d: 'Torrado e moído' },
          ].map((f, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <span className="inline-flex w-10 h-10 rounded-lg bg-[#f5f0ef] items-center justify-center mb-2"><f.icon className="w-5 h-5 text-[#8B2214]" /></span>
              <p className="font-semibold text-gray-900 text-sm leading-tight">{f.t}</p>
              <p className="text-xs text-gray-500 mt-0.5">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Linha de produtos */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Linha de produtos</h2>
        {prods.length === 0 ? (
          <p className="text-gray-500">Em breve.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {prods.map(p => (
              <button key={p.id} onClick={goStore} className="bg-white border border-gray-200 rounded-2xl p-5 text-center hover:shadow-md transition-shadow group">
                <div className="relative aspect-square flex items-center justify-center mb-3">
                  <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 46%, rgba(139,34,20,0.09) 0%, rgba(0,0,0,0.045) 38%, transparent 68%)' }} />
                  <img src={p.image_url || '/saporino-logo.png'} alt={p.name} className="relative z-10 w-4/5 h-4/5 object-contain transition-transform group-hover:scale-105"
                    onError={e => { (e.target as HTMLImageElement).src = '/saporino-logo.png'; }} />
                </div>
                <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                <p className="text-xs text-gray-400 mt-1">{p.weight_grams}g</p>
                <span className="inline-block mt-3 text-xs font-semibold text-[#8B2214] group-hover:underline">Ver na loja →</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* CTA negócio */}
      <section className="bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Quer Canaan para o seu negócio?</h2>
          <p className="text-gray-600 mb-6">Atendemos atacado, varejo e food service com condições para CNPJ.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="mailto:cafecanaan@cafesaporino.com.br?subject=Café Canaan — Comercial" className="bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold px-6 py-3 rounded-full transition-colors">Falar com o Comercial</a>
            <button onClick={goStore} className="border border-[#8B2214] text-[#8B2214] hover:bg-[#f5f0ef] font-semibold px-6 py-3 rounded-full transition-colors">Ver na loja</button>
          </div>
        </div>
      </section>
    </div>
  );
}
