// Coffee LiVRE — interface do provedor de pagamento e implementações (Mercado Pago e mock).
//
// A Edge Function não conhece fornecedor: pede ao provedor criar, consultar e
// reembolsar. O provedor Mercado Pago fala HTTP com a API oficial usando o token
// OAuth do VENDEDOR (Split 1:1). O mock existe só no ambiente de teste e guarda o
// "estado remoto" numa tabela própria, para os testes exercitarem webhook,
// reconciliação, divergência e reembolso sem dinheiro nem conta real.

import { centavosParaReais, reaisParaCentavos, taxaRealDoProcessador } from './taxas.ts';

export interface PagamentoRemoto {
  id: string;
  status: string;
  status_detail: string | null;
  collector_id: string | null;
  live_mode: boolean | null;
  transaction_amount_cents: number | null;
  processor_fee_cents: number | null;
  application_fee_cents: number | null;
  net_received_cents: number | null;
  refunded_cents: number;
  pix?: { qr_code: string | null; qr_base64: string | null; ticket_url: string | null; expira_em: string | null } | null;
}

export interface CriarPagamento {
  idempotencyKey: string;
  externalReference: string;
  valorCents: number;
  applicationFeeCents: number;
  descricao: string;
  metodo: 'pix' | 'cartao';
  pagador: { email: string; nome: string };
  expiraEm: string | null;                 // Pix: date_of_expiration
  notificationUrl: string | null;
  cartao?: { token: string; paymentMethodId: string; installments: number; issuerId?: string | null; cpf?: string | null } | null;
  accessTokenDoVendedor: string;           // Split 1:1: token OAuth do vendedor
}

export interface ProvedorDePagamento {
  readonly nome: 'mock' | 'mercadopago';
  criar(p: CriarPagamento): Promise<PagamentoRemoto>;
  consultar(mpPaymentId: string, accessTokenDoVendedor: string): Promise<PagamentoRemoto>;
  reembolsar(mpPaymentId: string, valorCents: number | null, idempotencyKey: string, accessTokenDoVendedor: string):
    Promise<{ refundId: string; status: string }>;
}

export class ErroDoProvedor extends Error {
  constructor(msg: string, readonly httpStatus: number | null, readonly codigo: string | null) { super(msg); }
}

// ------------------------------------------------------------------ Mercado Pago
type Json = Record<string, unknown>;

/** Converte a resposta de /v1/payments no formato interno. */
export function normalizarPagamentoMp(r: Json, applicationFeeSnapshotCents: number | null = null): PagamentoRemoto {
  const det = (r.transaction_details ?? {}) as Json;
  const total = reaisParaCentavos((det.total_paid_amount as number) ?? (r.transaction_amount as number));
  const net = reaisParaCentavos(det.net_received_amount as number);
  const fees = Array.isArray(r.fee_details) ? (r.fee_details as Json[]) : [];
  const appFeeDetalhe = fees.find(f => f.type === 'application_fee');
  const appFee = appFeeDetalhe ? reaisParaCentavos(appFeeDetalhe.amount as number) : applicationFeeSnapshotCents;
  const refunds = Array.isArray(r.refunds) ? (r.refunds as Json[]) : [];
  const reembolsado = reaisParaCentavos(r.transaction_amount_refunded as number)
    ?? refunds.reduce((s, x) => s + (reaisParaCentavos(x.amount as number) ?? 0), 0);
  const poi = ((r.point_of_interaction ?? {}) as Json).transaction_data as Json | undefined;
  return {
    id: String(r.id),
    status: String(r.status ?? ''),
    status_detail: (r.status_detail as string) ?? null,
    collector_id: r.collector_id != null ? String(r.collector_id) : null,
    live_mode: typeof r.live_mode === 'boolean' ? r.live_mode : null,
    transaction_amount_cents: total,
    processor_fee_cents: total != null && appFee != null ? taxaRealDoProcessador(total, net, appFee) : null,
    application_fee_cents: appFee,
    net_received_cents: net,
    refunded_cents: reembolsado ?? 0,
    pix: poi ? {
      qr_code: (poi.qr_code as string) ?? null,
      qr_base64: (poi.qr_code_base64 as string) ?? null,
      ticket_url: (poi.ticket_url as string) ?? null,
      expira_em: (r.date_of_expiration as string) ?? null,
    } : null,
  };
}

export function corpoDoPagamentoMp(p: CriarPagamento): Json {
  const corpo: Json = {
    transaction_amount: centavosParaReais(p.valorCents),
    application_fee: centavosParaReais(p.applicationFeeCents),
    description: p.descricao.slice(0, 250),
    external_reference: p.externalReference,
    payer: { email: p.pagador.email, first_name: p.pagador.nome.split(' ')[0] },
  };
  if (p.notificationUrl) corpo.notification_url = p.notificationUrl;
  if (p.metodo === 'pix') {
    corpo.payment_method_id = 'pix';
    if (p.expiraEm) corpo.date_of_expiration = p.expiraEm;
  } else if (p.cartao) {
    corpo.token = p.cartao.token;
    corpo.payment_method_id = p.cartao.paymentMethodId;
    corpo.installments = p.cartao.installments;
    if (p.cartao.issuerId) corpo.issuer_id = p.cartao.issuerId;
    if (p.cartao.cpf) (corpo.payer as Json).identification = { type: 'CPF', number: p.cartao.cpf };
  }
  return corpo;
}

export function provedorMercadoPago(fetcher: typeof fetch = fetch): ProvedorDePagamento {
  const api = 'https://api.mercadopago.com';
  async function chamar(metodo: string, caminho: string, token: string, corpo?: Json, chave?: string): Promise<Json> {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    if (chave) headers['X-Idempotency-Key'] = chave;
    const resp = await fetcher(`${api}${caminho}`, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined });
    const texto = await resp.text();
    let json: Json = {};
    try { json = texto ? JSON.parse(texto) : {}; } catch { json = {}; }
    if (!resp.ok) {
      // Mensagem curta, sem ecoar o corpo (pode conter dado do pagador).
      throw new ErroDoProvedor(`Mercado Pago respondeu ${resp.status}${json.message ? `: ${String(json.message).slice(0, 120)}` : ''}`,
        resp.status, (json.error as string) ?? null);
    }
    return json;
  }
  return {
    nome: 'mercadopago',
    async criar(p) {
      return normalizarPagamentoMp(await chamar('POST', '/v1/payments', p.accessTokenDoVendedor, corpoDoPagamentoMp(p), p.idempotencyKey), p.applicationFeeCents);
    },
    async consultar(id, token) {
      return normalizarPagamentoMp(await chamar('GET', `/v1/payments/${encodeURIComponent(id)}`, token));
    },
    async reembolsar(id, valorCents, chave, token) {
      const corpo = valorCents == null ? {} : { amount: centavosParaReais(valorCents) };
      const r = await chamar('POST', `/v1/payments/${encodeURIComponent(id)}/refunds`, token, corpo, chave);
      return { refundId: String(r.id), status: String(r.status ?? '') };
    },
  };
}

// ------------------------------------------------------------------ Mock (só teste)
export interface ArmazemMock {
  ler(id: string): Promise<PagamentoRemoto | null>;
  gravar(p: PagamentoRemoto & { cobranca_id?: string | null }): Promise<void>;
  reembolsoPorChave(id: string, chave: string): Promise<{ refundId: string; status: string } | null>;
  registrarReembolso(id: string, chave: string, refundId: string, valorCents: number): Promise<void>;
}

/**
 * Mock do Mercado Pago. Cartão: o token decide o resultado (mock_aprovar, mock_recusar,
 * mock_analise). Pix: nasce pendente, com QR claramente FICTÍCIO. A taxa "real" do mock é
 * propositalmente diferente da estimativa (bps + 3 centavos), para provar que o sistema
 * separa estimada de real.
 */
export function provedorMock(armazem: ArmazemMock, bpsProcessador: (metodo: 'pix' | 'cartao') => number): ProvedorDePagamento {
  return {
    nome: 'mock',
    async criar(p) {
      const existente = await armazem.ler(`mock_${p.idempotencyKey.replace(/-/g, '')}`);
      if (existente) return existente;   // idempotência do provedor
      const id = `mock_${p.idempotencyKey.replace(/-/g, '')}`;
      const fee = Math.floor((p.valorCents * bpsProcessador(p.metodo) + 5000) / 10000) + 3;
      let status = 'pending';
      let detalhe = p.metodo === 'pix' ? 'pending_waiting_transfer' : 'pending_contingency';
      if (p.metodo === 'cartao') {
        const t = p.cartao?.token ?? '';
        if (t === 'mock_aprovar') { status = 'approved'; detalhe = 'accredited'; }
        else if (t === 'mock_recusar') { status = 'rejected'; detalhe = 'cc_rejected_other_reason'; }
        else if (t === 'mock_analise') { status = 'in_process'; detalhe = 'pending_review_manual'; }
        else throw new ErroDoProvedor('Token de cartão de teste desconhecido.', 400, 'mock_token');
      }
      const aprovado = status === 'approved';
      const pag: PagamentoRemoto = {
        id, status, status_detail: detalhe, collector_id: 'mock-collector', live_mode: false,
        transaction_amount_cents: p.valorCents,
        processor_fee_cents: aprovado ? fee : null,
        application_fee_cents: p.applicationFeeCents,
        net_received_cents: aprovado ? p.valorCents - fee - p.applicationFeeCents : null,
        refunded_cents: 0,
        pix: p.metodo === 'pix' ? {
          qr_code: `TESTE-SEM-VALOR|${id}|R$${centavosParaReais(p.valorCents).toFixed(2)}`,
          qr_base64: null,
          ticket_url: null,
          expira_em: p.expiraEm,
        } : null,
      };
      await armazem.gravar({ ...pag, cobranca_id: p.externalReference.replace(/^lv:/, '') });
      return pag;
    },
    async consultar(id) {
      const p = await armazem.ler(id);
      if (!p) throw new ErroDoProvedor('Pagamento não encontrado no mock.', 404, 'not_found');
      return p;
    },
    async reembolsar(id, valorCents, chave) {
      const repetido = await armazem.reembolsoPorChave(id, chave);
      if (repetido) return repetido;   // mesma X-Idempotency-Key, mesmo reembolso
      const p = await armazem.ler(id);
      if (!p) throw new ErroDoProvedor('Pagamento não encontrado no mock.', 404, 'not_found');
      if (p.status !== 'approved') throw new ErroDoProvedor('Só pagamento aprovado pode ser reembolsado.', 400, 'invalid_status');
      const valor = valorCents ?? (p.transaction_amount_cents ?? 0) - p.refunded_cents;
      const refundId = `mockrf_${chave.replace(/-/g, '').slice(0, 20)}`;
      await armazem.registrarReembolso(id, chave, refundId, valor);
      return { refundId, status: 'approved' };
    },
  };
}
