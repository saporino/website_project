// Nomes que o comprador, o vendedor e a equipe leem no histórico do pedido.

const ROTULO: Record<string, string> = {
  pedido_criado: 'Pedido criado',
  subpedido_criado: 'Pedido enviado à loja',
  estoque_reservado: 'Estoque reservado',
  estoque_liberado: 'Estoque devolvido',
  pagamento_pendente: 'Aguardando pagamento',
  pagamento_aprovado: 'Pagamento aprovado',
  pagamento_recusado: 'Pagamento recusado',
  pagamento_evento_duplicado: 'Aviso de pagamento repetido (ignorado)',
  pagamento_apos_cancelamento: 'Pagamento recebido depois do cancelamento',
  seller_notificado: 'Loja avisada',
  em_separacao: 'Em separação',
  pronto_para_envio: 'Pronto para envio',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  reembolso_solicitado: 'Reembolso solicitado',
};

export const rotuloDoEvento = (tipo: string) => ROTULO[tipo] ?? tipo.replace(/_/g, ' ');

const ORIGEM: Record<string, string> = {
  comprador: 'você', vendedor: 'loja', admin: 'equipe Coffee LiVRE', sistema: 'sistema', pagamento: 'pagamento',
};
export const rotuloDaOrigem = (origem: string) => ORIGEM[origem] ?? origem;

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
