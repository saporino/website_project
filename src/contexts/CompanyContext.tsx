import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// Empresa ativa (multi-empresa: Saporino / Fazendinha). Tudo no app filtra por ela.
export interface Company {
  id: string; name: string; fantasia: string | null; cnpj: string | null;
  logo_url: string | null; commission_model: string; sort_order: number; is_active: boolean;
  endereco: string | null; cidade: string | null; uf: string | null; cep: string | null;
  allow_cash: boolean; is_b2c: boolean; order_prefix: string | null; is_operator?: boolean;
  // Marca aparece no site da COFICO. Desligar só esconde da vitrine pública.
  cofico_visivel?: boolean;
}

/**
 * ESCOPO = modo de trabalho, não empresa.
 *
 * 'uma'   → o de sempre: a tela mostra e grava na empresa do seletor.
 * 'todas' → modo de CONTROLE: as telas preparadas mostram o conjunto, de todas
 *           as empresas de uma vez, para não obrigar a cadastrar a mesma coisa
 *           duas vezes (foi o pedido: "não ter que colocar inventário na
 *           Saporino e na COFICO, trabalho dobrado").
 *
 * ⚠️ A TRAVA QUE SEGURA ISTO DE PÉ: mesmo em 'todas', `activeCompanyId`
 * CONTINUA SENDO UMA EMPRESA REAL. Nunca vira null nem um valor sentinela.
 *
 * O motivo é concreto: 27 pontos do app gravam `company_id: activeCompanyId`, e
 * 35 telas filtram por ele sem saber que este modo existe. Se o seletor pudesse
 * devolver "todas", `eq('company_id','todas')` nem é UUID — as telas quebrariam,
 * e as que não quebrassem gravariam dado sem dono. Dado órfão num banco
 * multi-empresa não tem conserto barato.
 *
 * Então quem quer o conjunto PEDE por ele, olhando `escopo`. Quem não pede
 * continua exatamente como antes. E na hora de CRIAR, o modo 'todas' não
 * escolhe empresa por ninguém: a tela pergunta. Fail closed, igual à regra do
 * recebedor por empresa faturadora.
 */
export type EscopoEmpresa = 'uma' | 'todas';

interface Ctx {
  companies: Company[];
  activeCompanyId: string | null;
  activeCompany: Company | null;
  storeCompanyId: string | null; // empresa da loja B2C (Saporino)
  setActiveCompanyId: (id: string) => void;
  escopo: EscopoEmpresa;
  setEscopo: (e: EscopoEmpresa) => void;
  /** Atalho de leitura para as telas preparadas. */
  vendoTodas: boolean;
  reloadCompanies: () => Promise<void>;
  loading: boolean;
}

const CompanyContext = createContext<Ctx | undefined>(undefined);
const LS_KEY = 'active-company-id';
const LS_ESCOPO = 'active-company-escopo';

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActive] = useState<string | null>(() => localStorage.getItem(LS_KEY));
  const [escopo, setEscopoState] = useState<EscopoEmpresa>(
    () => (localStorage.getItem(LS_ESCOPO) === 'todas' ? 'todas' : 'uma'));
  const [loading, setLoading] = useState(true);

  async function load() {
    // Toda empresa ativa entra no seletor, inclusive a operadora.
    //
    // Antes a COFICO ficava de fora, porque só operava logística. Isso mudou: ela
    // vende pela Casa Cofico e cuida do e-commerce, então precisa aparecer aqui —
    // é neste seletor que se cadastra o inventário e se diz quem vende. O mesmo
    // vale para qualquer marca de terceiro que peça para vendermos o café dela.
    //
    // A loja B2C não é afetada: `storeCompanyId` continua resolvendo pela empresa
    // marcada como is_b2c, que é a Saporino.
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

  // Escolher uma empresa é sempre sair do modo de controle: ninguém clica em
  // "CAFE SAPORINO" querendo continuar vendo as duas.
  const setActiveCompanyId = (id: string) => {
    localStorage.setItem(LS_KEY, id);
    localStorage.setItem(LS_ESCOPO, 'uma');
    setActive(id);
    setEscopoState('uma');
  };
  const setEscopo = (e: EscopoEmpresa) => { localStorage.setItem(LS_ESCOPO, e); setEscopoState(e); };

  const activeCompany = companies.find(c => c.id === activeCompanyId) || null;
  const storeCompanyId = (companies.find(c => c.is_b2c) || companies[0])?.id || null;

  return (
    <CompanyContext.Provider value={{
      companies, activeCompanyId, activeCompany, storeCompanyId, setActiveCompanyId,
      escopo, setEscopo, vendoTodas: escopo === 'todas',
      reloadCompanies: load, loading,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const c = useContext(CompanyContext);
  if (!c) throw new Error('useCompany precisa estar dentro de CompanyProvider');
  return c;
}
