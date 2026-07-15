import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// Empresa ativa (multi-empresa: Saporino / Fazendinha). Tudo no app filtra por ela.
export interface Company {
  id: string; name: string; fantasia: string | null; cnpj: string | null;
  logo_url: string | null; commission_model: string; sort_order: number; is_active: boolean;
  endereco: string | null; cidade: string | null; uf: string | null; cep: string | null;
  allow_cash: boolean; is_b2c: boolean;
}

interface Ctx {
  companies: Company[];
  activeCompanyId: string | null;
  activeCompany: Company | null;
  storeCompanyId: string | null; // empresa da loja B2C (Saporino)
  setActiveCompanyId: (id: string) => void;
  reloadCompanies: () => Promise<void>;
  loading: boolean;
}

const CompanyContext = createContext<Ctx | undefined>(undefined);
const LS_KEY = 'active-company-id';

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActive] = useState<string | null>(() => localStorage.getItem(LS_KEY));
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('companies').select('*').eq('is_active', true).order('sort_order');
    const list = (data as Company[]) || [];
    setCompanies(list);
    setActive(prev => {
      if (prev && list.some(c => c.id === prev)) return prev;
      const first = list[0]?.id || null;
      if (first) localStorage.setItem(LS_KEY, first);
      return first;
    });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const setActiveCompanyId = (id: string) => { localStorage.setItem(LS_KEY, id); setActive(id); };
  const activeCompany = companies.find(c => c.id === activeCompanyId) || null;
  const storeCompanyId = (companies.find(c => c.is_b2c) || companies[0])?.id || null;

  return (
    <CompanyContext.Provider value={{ companies, activeCompanyId, activeCompany, storeCompanyId, setActiveCompanyId, reloadCompanies: load, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const c = useContext(CompanyContext);
  if (!c) throw new Error('useCompany precisa estar dentro de CompanyProvider');
  return c;
}
