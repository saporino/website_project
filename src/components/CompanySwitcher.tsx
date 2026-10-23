import { useState, useRef, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { Building2, ChevronDown, Check, Layers } from 'lucide-react';

// Seletor de empresa ativa (Saporino / COFICO / …). Tudo no app filtra pela escolhida,
// MENOS no modo de controle — ver `escopo` em CompanyContext.
export default function CompanySwitcher({ compact = false }: { compact?: boolean }) {
  const { companies, activeCompany, setActiveCompanyId, vendoTodas, setEscopo } = useCompany();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (companies.length <= 1) return null; // só aparece se há mais de uma empresa

  const label = vendoTodas ? 'Todas as empresas' : (activeCompany?.fantasia || activeCompany?.name || 'Empresa');

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 font-semibold text-gray-800 ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
        title="Trocar empresa ativa">
        {vendoTodas
          ? <Layers className="h-4 w-4 text-[#8B2214]" />
          : activeCompany?.logo_url
            ? <img src={activeCompany.logo_url} alt="" className="h-4 w-4 rounded object-contain" />
            : <Building2 className="h-4 w-4 text-[#8B2214]" />}
        <span className="truncate max-w-[140px]">{label}</span>
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
              {!vendoTodas && c.id === activeCompany?.id && <Check className="h-4 w-4 flex-shrink-0" />}
            </button>
          ))}

          {/* MODO DE CONTROLE — separado das empresas de propósito.
              Não é uma empresa, é um jeito de trabalhar: as telas preparadas
              mostram o conjunto em vez de uma empresa só. Ficar na mesma lista
              faria parecer que existe uma terceira empresa chamada "Todas". */}
          <div className="my-1 border-t border-gray-100" />
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Controle</p>
          <button onClick={() => { setEscopo('todas'); setOpen(false); }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${vendoTodas ? 'text-[#8B2214] font-semibold' : 'text-gray-700'}`}>
            <Layers className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span className="flex-1 truncate">Todas as empresas</span>
            {vendoTodas && <Check className="h-4 w-4 flex-shrink-0" />}
          </button>
          <p className="px-3 pb-2 pt-0.5 text-[11px] leading-snug text-gray-400">
            Vê produtos e inventário das duas de uma vez. Ao criar, pergunta de qual empresa é.
          </p>
        </div>
      )}
    </div>
  );
}
