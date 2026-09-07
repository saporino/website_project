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

export async function cotarFrete(
  cep: string,
  pesoKg: number,
  valorMercadoria: number,
  pacotes = 0,
): Promise<Cotacao | null> {
  const tableId = await tabelaDeFreteAtiva();
  if (!tableId) return null;

  // A função do banco multiplica pelo peso, então convertemos o desconto para
  // o equivalente por quilo. Assim a mesma regra vale nos dois caminhos de
  // cotação, e o cliente vê o mesmo desconto venha de onde vier.
  const desconto = await descontoDeEnvio(pacotes);
  const porKg = pesoKg > 0 ? desconto / pesoKg : 0;

  const { data, error } = await supabase.rpc('cotar_frete', {
    p_table_id: tableId,
    p_cep: cep,
    p_peso_kg: pesoKg,
    p_valor: valorMercadoria,
    p_subsidio_kg: porKg,
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

export type RegraDesconto = {
  ativo: boolean;
  valor: number;
  /** 'kg' multiplica pelo peso bruto; 'pacote' pela quantidade de pacotes. */
  unidade: 'kg' | 'pacote';
  minPacotes: number;
};

let regraEmCache: RegraDesconto | undefined;

export async function regraDeDesconto(): Promise<RegraDesconto> {
  if (regraEmCache) return regraEmCache;
  const vazia: RegraDesconto = { ativo: false, valor: 0, unidade: 'kg', minPacotes: 1 };
  const { sellerPrefixForHost } = await import('./sellerCompany');
  const prefixo = sellerPrefixForHost();
  if (!prefixo) { regraEmCache = vazia; return vazia; }

  const { data } = await supabase
    .from('companies')
    .select('shipping_subsidy_per_kg, shipping_discount_active, shipping_discount_unit, shipping_discount_min_packs')
    .eq('order_prefix', prefixo)
    .maybeSingle();

  regraEmCache = {
    ativo: data?.shipping_discount_active !== false,
    valor: Number(data?.shipping_subsidy_per_kg ?? 0),
    unidade: data?.shipping_discount_unit === 'pacote' ? 'pacote' : 'kg',
    minPacotes: Number(data?.shipping_discount_min_packs ?? 1),
  };
  return regraEmCache;
}

/**
 * Quanto a loja banca deste envio, em reais.
 * A unidade muda muito o valor: um fardo de 5 kg com R$ 1,50 dá R$ 7,64 por
 * quilo e R$ 15,00 por pacote.
 */
export async function descontoDeEnvio(pacotes: number): Promise<number> {
  const r = await regraDeDesconto();
  if (!r.ativo || pacotes < r.minPacotes) return 0;
  // Por quilo conta o peso do café (500 g por pacote), não o do pacote fechado:
  // a loja banca frete de café, não de embalagem.
  return r.valor * (r.unidade === 'pacote' ? pacotes : pacotes * 0.5);
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

/** Uma opção real de envio, vinda do agregador. */
export type OpcaoFrete = {
  id: number;
  nome: string;
  empresa: string;
  /** Logo oficial da transportadora, entregue pelo próprio agregador. */
  logo: string | null;
  /** O que a transportadora cobra, já com a margem da loja. */
  preco_base: number;
  /** O que a loja banca, mostrado ao cliente como desconto de envio. */
  desconto: number;
  /** O que o cliente paga. */
  preco: number;
  prazo_dias: number | null;
};

export type CotacaoSuperFrete = {
  opcoes: OpcaoFrete[];
  peso_kg: number;
  /** Serviços que não atendem aquele CEP ou não comportam o pacote. */
  indisponiveis: Array<{ nome: string; motivo: string }>;
};

/**
 * Cotação ao vivo pelo agregador: Correios, Loggi, Jadlog e J&T de uma vez.
 *
 * A ordem muda com o peso — no pacote de 500 g a Loggi ganha fácil, no fardo
 * de 5 kg ela vira a mais cara e o SEDEX assume. Por isso devolvemos todas e
 * deixamos o cliente escolher entre barato e rápido.
 */
export async function cotarSuperFrete(
  cep: string,
  pacotes: number,
  valorMercadoria: number,
): Promise<CotacaoSuperFrete | null> {
  const { sellerPrefixForHost } = await import('./sellerCompany');
  try {
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/superfrete-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({
        cep, pacotes, valor: valorMercadoria,
        empresa: sellerPrefixForHost() ?? 'CS',
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return {
      opcoes: (j.opcoes ?? []) as OpcaoFrete[],
      peso_kg: Number(j.peso_kg ?? 0),
      indisponiveis: j.indisponiveis ?? [],
    };
  } catch {
    // Agregador fora do ar não pode travar a compra: quem chama decide o que
    // fazer, e o checkout cai na tabela própria.
    return null;
  }
}
