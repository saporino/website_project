import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PopupCfg {
  id: string;
  enabled: boolean;
  logo_url: string | null;
  logo_scale: number | null;
  image_url: string | null;
  eyebrow: string | null;
  headline: string | null;
  subtext: string | null;
  disclaimer: string | null;
  button_text: string | null;
  button_link: string | null;
  show_days: number;
  updated_at: string; // usado como "versao" — muda quando o admin edita
}

const seenKey = (id: string) => `saporino-popup-seen-${id}`;
const logoImage = '/saporino-logo-tight.png';

// Verifica se o visitante ainda está no período de "já viu" deste popup específico.
function naoMostrar(p: PopupCfg): boolean {
  try {
    const raw = localStorage.getItem(seenKey(p.id));
    if (!raw) return false;
    const seen = JSON.parse(raw) as { v?: string; ts?: number };
    const sameVersion = seen.v === p.updated_at; // admin editou → reaparece
    const days = (Date.now() - (seen.ts || 0)) / (1000 * 60 * 60 * 24);
    return sameVersion && days < (p.show_days || 30);
  } catch { return false; }
}

// Popups promocionais editaveis no admin. Pode haver VARIOS ligados; o site escolhe
// um (aleatorio) entre os elegiveis. Cada popup tem seu proprio "ja viu" (localStorage,
// re-exibe apos show_days). onAction recebe o destino do botao (ex.: 'cadastro').
export default function PromoPopup({ onAction }: { onAction?: (link: string) => void }) {
  const [cfg, setCfg] = useState<PopupCfg | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const { data } = await supabase
        .from('popup_settings')
        .select('id, enabled, logo_url, logo_scale, image_url, eyebrow, headline, subtext, disclaimer, button_text, button_link, show_days, updated_at')
        .eq('enabled', true)
        .order('sort_order');
      const ligados = (data as PopupCfg[]) || [];
      const elegiveis = ligados.filter(p => !naoMostrar(p));
      if (!elegiveis.length) return;
      // entre os ligados ainda não vistos, escolhe um ao acaso (rotação A/B)
      const escolhido = elegiveis[Math.floor(Math.random() * elegiveis.length)];
      setCfg(escolhido);
      timer = setTimeout(() => setOpen(true), 1500);
    })();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  const close = () => {
    setOpen(false);
    try { if (cfg) localStorage.setItem(seenKey(cfg.id), JSON.stringify({ v: cfg.updated_at, ts: Date.now() })); } catch { /* ok */ }
  };

  const act = () => {
    const link = cfg?.button_link || '';
    close();
    if (!link) return;
    if (link === 'cadastro' || link === 'login') { onAction?.(link); return; }
    if (/^https?:\/\//.test(link)) { window.open(link, '_blank', 'noopener'); return; }
    window.history.pushState({}, '', link);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (!open || !cfg) return null;

  return (
    <div className="fixed inset-0 z-[1400] bg-black/50 flex items-center justify-center p-4" onClick={close}>
      <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-3xl w-full grid md:grid-cols-2" onClick={(e) => e.stopPropagation()}>
        <button onClick={close} aria-label="Fechar" className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-700 flex items-center justify-center shadow">
          <X className="w-5 h-5" />
        </button>

        {/* Texto (esquerda) */}
        <div className="p-8 md:p-10 order-2 md:order-1 flex flex-col justify-center">
          <img src={cfg.logo_url || logoImage} alt="" style={{ height: `${2.25 * (cfg.logo_scale || 1)}rem`, maxWidth: '380px' }} className="w-auto self-start mb-5 object-contain" />
          {cfg.eyebrow && <p className="text-xs font-bold uppercase tracking-wide text-[#8B2214] mb-2">{cfg.eyebrow}</p>}
          {cfg.headline && <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight mb-3">{cfg.headline}</h2>}
          {cfg.subtext && <p className="text-gray-600 mb-5 leading-relaxed">{cfg.subtext}</p>}
          {cfg.button_text && (
            <button onClick={act} className="bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold px-6 py-3 rounded-full self-start transition-colors shadow-lg">
              {cfg.button_text}
            </button>
          )}
          {cfg.disclaimer && <p className="text-[11px] text-gray-400 mt-4 leading-snug">{cfg.disclaimer}</p>}
        </div>

        {/* Foto (direita) */}
        {cfg.image_url && (
          <div className="order-1 md:order-2 min-h-[180px] md:min-h-[420px] bg-stone-100">
            <img src={cfg.image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}
