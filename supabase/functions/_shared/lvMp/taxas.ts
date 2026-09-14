// Coffee LiVRE — valores de uma cobrança no Split 1:1 (espelho de lv_cobranca_preparar).
//
// Fato confirmado (documentação oficial, 14/09/2026): no Split 1:1 a taxa do
// Mercado Pago é descontada primeiro do pagamento recebido pelo vendedor, e a
// comissão do marketplace (application_fee) sai do restante.
// NÃO confirmado: a base exata da taxa e se ela incide sobre o frete. Por isso a
// estimativa usa o valor TOTAL da cobrança (produtos + frete) e fica marcada como
// estimada; a taxa real vem da reconciliação.

export function aplicarBps(cents: number, bps: number | null | undefined): number | null {
  if (bps == null) return null;
  return Math.floor((cents * bps + 5000) / 10000);
}

export interface EntradaDaCobranca {
  produtosCents: number;          // subtotal − desconto da escada
  freteCents: number;
  comissaoCents: number;
  tarifaCents: number;
  freteNaApplicationFee: boolean; // frete do CD Coffee LiVRE vai para a plataforma
  processorFeeBps: number | null; // hipótese da tabela; nulo = desconhecido
}

export interface ValoresDaCobranca {
  valorCents: number;
  applicationFeeCents: number;
  processorFeeEstimadaCents: number | null;
  liquidoSellerEstimadoCents: number | null;
  receitaMarketplaceEstimadaCents: number;
}

export function calcularCobranca(e: EntradaDaCobranca): ValoresDaCobranca {
  const valor = e.produtosCents + e.freteCents;
  const app = e.comissaoCents + e.tarifaCents + (e.freteNaApplicationFee ? e.freteCents : 0);
  const fee = aplicarBps(valor, e.processorFeeBps);
  return {
    valorCents: valor,
    applicationFeeCents: app,
    processorFeeEstimadaCents: fee,
    liquidoSellerEstimadoCents: fee == null ? null : valor - fee - app,
    receitaMarketplaceEstimadaCents: app,
  };
}

/**
 * Taxa REAL do processador a partir do que o Mercado Pago devolve para o coletor:
 * net_received = total − taxa MP − application_fee  ⇒  taxa MP = total − net − application_fee.
 * Sem net_received, a taxa real continua desconhecida (nulo).
 */
export function taxaRealDoProcessador(totalCents: number, netRecebidoCents: number | null, applicationFeeCents: number): number | null {
  if (netRecebidoCents == null) return null;
  return Math.max(0, totalCents - netRecebidoCents - applicationFeeCents);
}

export const reaisParaCentavos = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) ? null : Math.round(v * 100);

export const centavosParaReais = (c: number): number => Math.round(c) / 100;
