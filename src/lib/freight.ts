// Cotação de frete: preço, prazo e cobertura, vindos do banco.
//
// O cálculo mora no banco (função `cotar_frete`) e não aqui, porque preço é
// autoridade do servidor: o checkout confere o valor antes de cobrar. Este
// arquivo só pergunta e formata.

import { supabase } from './supabase';

export type Cotacao = {
  atendido: boolean;
  zona: string | null;
  uf: string | null;
  cidade: string | null;
  dias: number | null;
  /** O que a transportadora cobra pela faixa de peso. */
  transporte: number;
  /** Seguro + GRIS, percentuais sobre o valor da mercadoria. */
  seguro: number;
  /** O que a loja banca. Aparece ao cliente como "Desconto de envio". */
  desconto: number;
  /** O que o cliente paga. */
  preco: number;
};

let tabelaEmCache: string | null | undefined;

/** Tabela de preços ativa. Uma consulta por sessão. */
export async function tabelaDeFreteAtiva(): Promise<string | null> {
  if (tabelaEmCache !== undefined) return tabelaEmCache ?? null;
  const { data } = await supabase
    .from('shipping_rate_tables')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  tabelaEmCache = (data?.id as string | undefined) ?? null;
  return tabelaEmCache ?? null;
}

/**
 * Peso bruto: café mais envelope. É este peso que a transportadora cobra —
 * declarar só o líquido subestima o frete, e a diferença sai do nosso bolso.
 */
export async function pesoBrutoKg(pacotes: number): Promise<number> {
  const { data } = await supabase.rpc('peso_bruto_kg', { p_unidades: pacotes });
  // Sem resposta, cai na conta sem tara: melhor cotar algo do que travar a tela.
  return Number(data ?? pacotes * 0.5);
}

export async function cotarFrete(cep: string, pesoKg: number, valorMercadoria: number): Promise<Cotacao | null> {
  const tableId = await tabelaDeFreteAtiva();
  if (!tableId) return null;

  const { data, error } = await supabase.rpc('cotar_frete', {
    p_table_id: tableId,
    p_cep: cep,
    p_peso_kg: pesoKg,
    p_valor: valorMercadoria,
    // O subsídio por quilo vem da empresa vendedora; a loja passa o que estiver
    // configurado. Zero = sem desconto, e o cliente paga o frete cheio.
    p_subsidio_kg: await subsidioPorKg(),
  });
  if (error || !data?.length) return null;

  const c = data[0];
  return {
    atendido: !!c.atendido,
    zona: c.zona, uf: c.uf, cidade: c.cidade, dias: c.dias,
    transporte: Number(c.transporte ?? 0),
    seguro: Number(c.seguro ?? 0),
    desconto: Number(c.desconto ?? 0),
    preco: Number(c.preco ?? 0),
  };
}

let subsidioEmCache: number | undefined;

async function subsidioPorKg(): Promise<number> {
  if (subsidioEmCache !== undefined) return subsidioEmCache;
  const { sellerPrefixForHost } = await import('./sellerCompany');
  const prefixo = sellerPrefixForHost();
  if (!prefixo) { subsidioEmCache = 0; return 0; }
  const { data } = await supabase
    .from('companies')
    .select('shipping_subsidy_per_kg')
    .eq('order_prefix', prefixo)
    .maybeSingle();
  subsidioEmCache = Number(data?.shipping_subsidy_per_kg ?? 0);
  return subsidioEmCache;
}

/** Nossas lojas em marketplace, oferecidas quando o CEP não é atendido. */
export async function lojasDeMarketplace(): Promise<Array<{ name: string; url: string; logo_url: string | null }>> {
  const { data } = await supabase
    .from('marketplace_stores')
    .select('name, url, logo_url')
    .eq('is_active', true)
    .order('sort_order');
  return data ?? [];
}

export const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
