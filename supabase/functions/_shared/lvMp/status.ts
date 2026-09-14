// Coffee LiVRE — estados da cobrança (espelho de lv_mp_status_local / lv_mp_pode_transicionar).
// Puro: roda no Deno (Edge Functions) e no Node (testes).

export type StatusDaCobranca =
  | 'criando' | 'aguardando_pagamento' | 'em_analise' | 'aprovado' | 'recusado' | 'cancelado'
  | 'expirado' | 'parcialmente_reembolsado' | 'reembolsado' | 'contestado' | 'erro';

/** Status oficiais do pagamento no Mercado Pago (documentação consultada em 14/09/2026). */
export const STATUS_MP = ['pending', 'approved', 'authorized', 'in_process', 'in_mediation', 'rejected', 'cancelled', 'refunded', 'charged_back'] as const;

export function statusLocal(status: string | null | undefined, detalhe?: string | null): StatusDaCobranca | null {
  switch (status) {
    case 'pending': return 'aguardando_pagamento';
    case 'authorized':
    case 'in_process': return 'em_analise';
    // Reembolso parcial mantém "approved"; o detalhe (não confirmado na documentação) marca a parcialidade.
    case 'approved': return detalhe === 'partially_refunded' ? 'parcialmente_reembolsado' : 'aprovado';
    case 'rejected': return 'recusado';
    case 'cancelled': return detalhe === 'expired' ? 'expirado' : 'cancelado';
    case 'refunded': return 'reembolsado';
    case 'charged_back':
    case 'in_mediation': return 'contestado';
    default: return null;
  }
}

const RANK: Record<StatusDaCobranca, number> = {
  criando: 0, aguardando_pagamento: 1, em_analise: 2, recusado: 3, cancelado: 3, expirado: 3, erro: 3,
  aprovado: 4, parcialmente_reembolsado: 5, contestado: 5, reembolsado: 6,
};

/** Só avança; contestação ganha volta a aprovado. Webhook fora de ordem nunca rebaixa. */
export function podeTransicionar(de: StatusDaCobranca, para: StatusDaCobranca): boolean {
  if (de === para) return false;
  return RANK[para] > RANK[de] || (de === 'contestado' && para === 'aprovado');
}

export const ROTULO_DA_COBRANCA: Record<StatusDaCobranca, string> = {
  criando: 'Gerando pagamento',
  aguardando_pagamento: 'Aguardando pagamento',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
  parcialmente_reembolsado: 'Parcialmente reembolsado',
  reembolsado: 'Reembolsado',
  contestado: 'Em contestação',
  erro: 'Erro ao gerar',
};
