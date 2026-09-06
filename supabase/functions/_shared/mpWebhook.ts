// Fase 0 / P0 — lógica pura do webhook Mercado Pago (testável, sem I/O).

export type OrderStatus = 'approved' | 'rejected' | 'in_process' | 'refunded' | 'pending';

// Mapeia o status do pagamento (API MP) para o status do pedido.
export function mapMpStatus(mpStatus: string): OrderStatus {
  if (mpStatus === 'approved') return 'approved';
  if (mpStatus === 'rejected' || mpStatus === 'cancelled') return 'rejected';
  if (mpStatus === 'in_process' || mpStatus === 'in_mediation') return 'in_process';
  if (mpStatus === 'refunded' || mpStatus === 'charged_back') return 'refunded';
  return 'pending';
}

export interface CurrentOrder { status: string | null; paid_at: string | null; }
export interface UpdateDecision { apply: boolean; setPaidAt: boolean; reason: string; }

/**
 * Idempotência / no-regression:
 *  - nunca rebaixa um pedido já 'approved' para pending/in_process;
 *  - só marca paid_at na primeira aprovação (não reescreve).
 */
export function decideOrderUpdate(current: CurrentOrder, incoming: OrderStatus): UpdateDecision {
  const alreadyApproved = current.status === 'approved';
  if (alreadyApproved && (incoming === 'pending' || incoming === 'in_process')) {
    return { apply: false, setPaidAt: false, reason: 'no-regression' };
  }
  const setPaidAt = incoming === 'approved' && !current.paid_at;
  return { apply: true, setPaidAt, reason: 'ok' };
}

// Manifest da assinatura MP: id:<data.id>;request-id:<x-request-id>;ts:<ts>
export function buildManifest(dataId: string, requestId: string, ts: string): string {
  return `id:${dataId};request-id:${requestId};ts:${ts}`;
}

/**
 * Etapa operacional do pedido, derivada do status do pagamento.
 *
 * O pedido tem DOIS campos de estado: `status` (o pagamento) e `order_status`
 * (a etapa da operação, que é o selo mostrado no painel). O webhook só mexia no
 * primeiro. Resultado visto na tela: um pedido pago aparecendo como "Criado",
 * porque o selo lê o segundo campo. Quem opera não tinha como saber que aquele
 * pedido já estava pago e pronto para separar.
 */
export function mapOrderStage(orderStatus: OrderStatus): string {
  if (orderStatus === 'approved') return 'payment_approved';
  if (orderStatus === 'refunded') return 'cancelled';
  return 'payment_pending';   // pending, in_process e rejected seguem aguardando
}

/**
 * Traduz o meio de pagamento do Mercado Pago para o vocabulário do nosso banco.
 *
 * O MP manda DUAS coisas diferentes: `payment_type_id` é a família (credit_card,
 * ticket, bank_transfer...) e `payment_method_id` é a bandeira (master, visa,
 * bolbradesco, pix). O webhook gravava a BANDEIRA numa coluna que só aceita a
 * família, e o banco recusava com "violates check constraint".
 *
 * O efeito era grave e silencioso para quem compra: o dinheiro saía do cartão do
 * cliente e o pedido continuava "pendente" para sempre, porque a notificação
 * inteira falhava na hora de gravar. Encontrado no primeiro pagamento real.
 */
export function mapPaymentMethod(paymentTypeId?: string | null, paymentMethodId?: string | null): string {
  const tipo = (paymentTypeId ?? '').toLowerCase();
  const metodo = (paymentMethodId ?? '').toLowerCase();

  if (tipo === 'credit_card') return 'credit_card';
  if (tipo === 'debit_card' || tipo === 'prepaid_card') return 'debit_card';
  if (tipo === 'ticket') return 'boleto';
  if (metodo === 'pix' || tipo === 'bank_transfer') return 'pix';
  return 'other';   // account_money, carteira digital e o que vier de novo
}

/**
 * Variantes aceitas do manifest.
 *
 * A documentação do Mercado Pago mostra o template TERMINANDO em ponto e vírgula
 * (`id:%s;request-id:%s;ts:%s;`), e esta implementação montava sem ele. Uma
 * divergência de um caractere faz o HMAC bater diferente e a notificação legítima
 * ser recusada com 401 — falha que só apareceria no primeiro pagamento real.
 *
 * Como não há como confirmar o formato sem uma notificação verdadeira, a verificação
 * passa a aceitar as DUAS formas. Continua fail closed: assinatura que não bate em
 * nenhuma das variantes é rejeitada.
 */
export function manifestVariants(dataId: string, requestId: string, ts: string): string[] {
  const base = buildManifest(dataId, requestId, ts);
  return [base, `${base};`];
}
