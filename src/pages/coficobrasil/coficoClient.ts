// Client Supabase PRÓPRIO da página COFICO (mantém a pasta destacável — não importa o client da Saporino).
// Uso restrito: leitura pública via RPC agregada `cofico_public_stats` (só inteiros, sem PII).
// persistSession:false p/ não conflitar com o client principal do app (evita múltiplas instâncias de auth).
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const coficoDb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type CoficoStats = { entregas: number; clientes: number };

export async function fetchCoficoStats(): Promise<CoficoStats> {
  const { data, error } = await coficoDb.rpc('cofico_public_stats');
  if (error || !data) return { entregas: 0, clientes: 0 };
  return { entregas: Number(data.entregas) || 0, clientes: Number(data.clientes) || 0 };
}

/**
 * Vitrine da COFICO, vinda do MESMO catálogo que o painel administra.
 *
 * Antes esta página tinha uma lista fixa no código, e por isso nada que era
 * atualizado no painel (foto, nome, descrição) chegava aqui. Agora o catálogo é
 * um só: a view `vw_cofico_vitrine` devolve os produtos ativos, não escondidos e
 * marcados para a COFICO vender — de qualquer marca, que é o papel dela.
 */
export interface CoficoProduto {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  product_line: string | null;
  weight_grams: number | null;
  stock: number;
  marca_empresa: string | null;
  disponivel: boolean;
}

export async function fetchCoficoVitrine(): Promise<CoficoProduto[]> {
  const { data, error } = await coficoDb.from('vw_cofico_vitrine').select('*');
  if (error || !data) return [];
  return data as CoficoProduto[];
}
