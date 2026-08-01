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
