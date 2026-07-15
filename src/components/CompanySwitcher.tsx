import { useState, useRef, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { Building2, ChevronDown, Check } from 'lucide-react';

// Seletor de empresa ativa (Saporino / Fazendinha). Tudo no app filtra pela escolhida.
export default function CompanySwitcher({ compact = false }: { compact?: boolean }) {
  const { companies, activeCompany, setActiveCompanyId } = useCompany();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (companies.length <= 1) return null; // só aparece se há mais de uma empresa

  const label = activeCompany?.fantasia || activeCompany?.name || 'Empresa';

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 font-semibold text-gray-800 ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
        title="Trocar empresa ativa">
        {activeCompany?.logo_url
          ? <img src={activeCompany.logo_url} alt="" className="h-4 w-4 rounded object-contain" />
          : <Building2 className="h-4 w-4 text-[#8B2214]" />}
        <span className="truncate max-w-[120px]">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-gray-200 bg-white shadow-lg py-1">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Vendendo / gerindo pela</p>
          {companies.map(c => (
            <button key={c.id} onClick={() => { setActiveCompanyId(c.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${c.id === activeCompany?.id ? 'text-[#8B2214] font-semibold' : 'text-gray-700'}`}>
              {c.logo_url ? <img src={c.logo_url} alt="" className="h-5 w-5 rounded object-contain flex-shrink-0" /> : <Building2 className="h-4 w-4 flex-shrink-0 text-gray-400" />}
              <span className="flex-1 truncate">{c.fantasia || c.name}</span>
              {c.id === activeCompany?.id && <Check className="h-4 w-4 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
