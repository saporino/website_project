// Coffee LiVRE — estados do pedido.
//
// A MESMA tabela de transições está no banco (lv_transicao_*_valida), que é quem
// recusa de verdade. Aqui ela serve a tela (quais botões mostrar) e os testes,
// e a bancada da API confere que as duas concordam, par a par.

export const STATUS_DO_PEDIDO = [
  'aguardando_pagamento', 'pago', 'em_processamento', 'parcialmente_enviado',
  'enviado', 'entregue', 'cancelado', 'reembolsado',
] as const;
export type StatusDoPedido = typeof STATUS_DO_PEDIDO[number];

export const STATUS_DO_SUBPEDIDO = [
  'aguardando_pagamento', 'confirmado', 'separacao', 'pronto_para_envio', 'enviado', 'entregue', 'cancelado',
] as const;
export type StatusDoSubpedido = typeof STATUS_DO_SUBPEDIDO[number];

export const STATUS_DO_PAGAMENTO = [
  'pendente', 'aguardando_pagamento', 'aprovado', 'recusado', 'cancelado', 'reembolsado', 'parcialmente_reembolsado',
] as const;
export type StatusDoPagamento = typeof STATUS_DO_PAGAMENTO[number];

const TRANSICOES_DO_PEDIDO: Record<StatusDoPedido, StatusDoPedido[]> = {
  aguardando_pagamento: ['pago', 'cancelado'],
  pago: ['em_processamento', 'cancelado'],
  em_processamento: ['parcialmente_enviado', 'enviado', 'cancelado'],
  parcialmente_enviado: ['enviado', 'entregue'],
  enviado: ['entregue'],
  entregue: ['reembolsado'],
  cancelado: ['reembolsado'],
  reembolsado: [],
};

const TRANSICOES_DO_SUBPEDIDO: Record<StatusDoSubpedido, StatusDoSubpedido[]> = {
  aguardando_pagamento: ['confirmado', 'cancelado'],
  confirmado: ['separacao', 'cancelado'],
  separacao: ['pronto_para_envio', 'cancelado'],
  pronto_para_envio: ['enviado', 'cancelado'],
  enviado: ['entregue'],
  entregue: [],
  cancelado: [],
};

const TRANSICOES_DO_PAGAMENTO: Record<StatusDoPagamento, StatusDoPagamento[]> = {
  pendente: ['aguardando_pagamento', 'cancelado'],
  aguardando_pagamento: ['aprovado', 'recusado', 'cancelado'],
  recusado: ['aguardando_pagamento', 'aprovado', 'cancelado'],
  aprovado: ['parcialmente_reembolsado', 'reembolsado'],
  parcialmente_reembolsado: ['reembolsado'],
  reembolsado: [],
  cancelado: [],
};

export const transicaoDoPedidoValida = (de: StatusDoPedido, para: StatusDoPedido) => TRANSICOES_DO_PEDIDO[de].includes(para);
export const transicaoDoSubpedidoValida = (de: StatusDoSubpedido, para: StatusDoSubpedido) => TRANSICOES_DO_SUBPEDIDO[de].includes(para);
export const transicaoDoPagamentoValida = (de: StatusDoPagamento, para: StatusDoPagamento) => TRANSICOES_DO_PAGAMENTO[de].includes(para);

/** Passos que o VENDEDOR pode dar no próprio subpedido (cancelar é da operação). */
const PASSOS_DO_VENDEDOR: StatusDoSubpedido[] = ['separacao', 'pronto_para_envio', 'enviado', 'entregue'];

export function proximoPassoDoVendedor(status: StatusDoSubpedido): StatusDoSubpedido | null {
  return TRANSICOES_DO_SUBPEDIDO[status].find(s => PASSOS_DO_VENDEDOR.includes(s)) ?? null;
}

/**
 * Status do pedido pai a partir dos subpedidos — a mesma regra de
 * lv_derivar_status_pedido. `atual` fica quando nenhum subpedido andou.
 */
export function derivarStatusDoPedido(atual: StatusDoPedido, subpedidos: StatusDoSubpedido[]): StatusDoPedido {
  const ativos = subpedidos.filter(s => s !== 'cancelado');
  if (ativos.length === 0) return 'cancelado';
  if (ativos.every(s => s === 'entregue')) return 'entregue';
  if (ativos.every(s => s === 'enviado' || s === 'entregue')) return 'enviado';
  if (ativos.some(s => s === 'enviado' || s === 'entregue')) return 'parcialmente_enviado';
  if (ativos.some(s => s === 'separacao' || s === 'pronto_para_envio')) return 'em_processamento';
  return atual;
}

export const ROTULO_DO_PEDIDO: Record<StatusDoPedido, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  em_processamento: 'Em preparação',
  parcialmente_enviado: 'Parcialmente enviado',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  reembolsado: 'Reembolsado',
};

export const ROTULO_DO_SUBPEDIDO: Record<StatusDoSubpedido, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  confirmado: 'Novo',
  separacao: 'Em separação',
  pronto_para_envio: 'Pronto para envio',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const ROTULO_DO_PAGAMENTO: Record<StatusDoPagamento, string> = {
  pendente: 'Pendente',
  aguardando_pagamento: 'Aguardando pagamento',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  reembolsado: 'Reembolsado',
  parcialmente_reembolsado: 'Parcialmente reembolsado',
};

/** Rótulo do botão que leva ao próximo passo do vendedor. */
export const ACAO_DO_VENDEDOR: Partial<Record<StatusDoSubpedido, string>> = {
  separacao: 'Iniciar separação',
  pronto_para_envio: 'Marcar pronto para envio',
  enviado: 'Marcar como enviado',
  entregue: 'Confirmar entrega',
};
