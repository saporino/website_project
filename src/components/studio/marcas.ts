import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// Marcas do Studio = uma ABA cada (studio_brand_profiles). A empresa (company_id) é a dona;
// a marca é quem fala e em que conta sai o post.
export interface StudioMarca {
  id: string;
  name: string;
  company_id: string;
  is_primary: boolean;
  logo: string | null;
  // empresa operadora (COFICO): distribuidora, a conta dela aceita todas as marcas
  operadora: boolean;
  // @ conectado por rede (instagram/tiktok), quando houver
  contas: Record<string, string | null>;
}

export function useStudioMarcas() {
  const [marcas, setMarcas] = useState<StudioMarca[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const [{ data: perfis }, { data: conexoes }] = await Promise.all([
      supabase.from('studio_brand_profiles')
        .select('id, name, company_id, is_primary, ordem, logo_url, ativa_no_studio, companies!inner(is_active, studio_enabled, is_operator, logo_url, sort_order)')
        .eq('ativa_no_studio', true).eq('companies.is_active', true).eq('companies.studio_enabled', true),
      supabase.from('studio_social_connections').select('brand_id, platform, account_name, status'),
    ]);
    const contas: Record<string, Record<string, string | null>> = {};
    (conexoes || []).forEach((c: any) => {
      if (!c.brand_id || c.status !== 'connected') return;
      (contas[c.brand_id] ||= {})[c.platform] = c.account_name || null;
    });
    const lista = (perfis || []).map((p: any) => ({
      id: p.id, name: p.name, company_id: p.company_id, is_primary: !!p.is_primary,
      logo: p.logo_url || p.companies?.logo_url || null,
      operadora: !!p.companies?.is_operator,
      contas: contas[p.id] || {},
      _ordem: (p.ordem ?? 100) + (p.companies?.sort_order ?? 0) / 1000,
    }));
    lista.sort((a, b) => a._ordem - b._ordem);
    setMarcas(lista.map(({ _ordem, ...m }) => m));
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  return { marcas, carregando, recarregar: carregar };
}

// Onde um conteúdo da marca X pode sair (regra combinada com o Vlademir, 21/09/2026):
//   • a conta da própria marca (padrão);
//   • a conta da COFICO (distribuidora — aceita todas as marcas);
//   • a conta da marca-mãe (ex.: Tropeiro na @cafesaporino), por escolha dele.
export function destinosPermitidos(marca: StudioMarca, todas: StudioMarca[]): StudioMarca[] {
  const mae = todas.find(m => m.company_id === marca.company_id && m.is_primary);
  const cofico = todas.find(m => m.operadora && m.is_primary);
  const ids = [marca.id, mae?.id, cofico?.id].filter((x): x is string => !!x);
  return [...new Set(ids)].map(id => todas.find(m => m.id === id)!).filter(Boolean);
}
