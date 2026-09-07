// Envio dos e-mails do pedido, com trava contra repetição.
//
// O Mercado Pago reenvia a mesma notificação várias vezes pelo mesmo pagamento —
// é o desenho dele, para garantir entrega. Sem trava, o cliente receberia
// "pagamento confirmado" três ou quatro vezes.
//
// A trava é a chave única (order_id, kind) em order_emails: a linha é gravada
// ANTES do envio. Se já existe, alguém já mandou e nós paramos aqui. Se o envio
// falhar depois, a linha é removida para que a próxima tentativa possa acontecer
// — o Mercado Pago reenvia, e aí o cliente recebe.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  emailPedidoConfirmado, emailAvisoAdmin, emailProntoRetirada, emailEnviado,
  type PedidoEmail, type EmpresaEmail, type ItemPedido, type Montado,
} from './orderEmail.ts';

export type TipoEmail = 'pedido_confirmado' | 'pronto_retirada' | 'enviado' | 'aviso_admin';

const CAMPOS_PEDIDO =
  'id, order_number, customer_name, customer_email, total_amount, shipping_cost, is_pickup, ' +
  'shipping_carrier_name, shipping_address, tracking_code, tracking_url, seller_company_id';

const CAMPOS_EMPRESA = 'name, order_prefix, endereco, cidade, uf, cep, pickup_hours, notify_email';

export function db(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function enviarPeloResend(m: Montado, remetente: string): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const chave = Deno.env.get('RESEND_API_KEY');
  if (!chave) return { ok: false, erro: 'RESEND_API_KEY ausente' };

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: remetente, to: [m.para], subject: m.assunto, html: m.html }),
  });
  const texto = await r.text();
  if (!r.ok) return { ok: false, erro: texto.slice(0, 300) };
  let id: string | undefined;
  try { id = JSON.parse(texto)?.id; } catch { /* resposta sem id nao impede nada */ }
  return { ok: true, id };
}

/**
 * Monta e envia um e-mail do pedido. Devolve o que aconteceu, sem lançar erro:
 * falha de e-mail NUNCA pode derrubar o processamento do pagamento — dinheiro
 * confirmado é mais importante que aviso enviado.
 */
export async function notificarPedido(
  supabase: SupabaseClient,
  orderId: string,
  tipo: TipoEmail,
): Promise<{ enviado: boolean; motivo?: string }> {
  try {
    const { data: pedido } = await supabase.from('orders').select(CAMPOS_PEDIDO).eq('id', orderId).maybeSingle();
    if (!pedido?.customer_email) return { enviado: false, motivo: 'pedido sem e-mail' };

    const { data: empresa } = await supabase.from('companies')
      .select(CAMPOS_EMPRESA).eq('id', pedido.seller_company_id).maybeSingle();
    if (!empresa) return { enviado: false, motivo: 'pedido sem empresa faturadora' };

    const { data: itens } = await supabase.from('order_items')
      .select('product_name, quantity, unit_price, subtotal').eq('order_id', orderId);

    const p = pedido as unknown as PedidoEmail;
    const e = empresa as unknown as EmpresaEmail;
    const lista = (itens ?? []) as ItemPedido[];

    let montado: Montado | null = null;
    switch (tipo) {
      case 'pedido_confirmado': montado = emailPedidoConfirmado(p, lista, e); break;
      case 'aviso_admin':       montado = emailAvisoAdmin(p, lista, e); break;
      case 'pronto_retirada':   montado = emailProntoRetirada(p, e); break;
      case 'enviado':           montado = emailEnviado(p, e); break;
    }
    // aviso_admin devolve null quando a empresa não tem para quem avisar.
    if (!montado) return { enviado: false, motivo: 'sem destinatario configurado' };

    // Reserva o envio. Conflito aqui significa "já foi mandado" — e paramos.
    const { data: reserva, error: erroReserva } = await supabase.from('order_emails')
      .insert({ order_id: orderId, kind: tipo, to_email: montado.para })
      .select('id').single();
    if (erroReserva) return { enviado: false, motivo: 'ja enviado antes' };

    const { identidadeDaEmpresa } = await import('./orderEmail.ts');
    const envio = await enviarPeloResend(montado, identidadeDaEmpresa(e).remetente);

    if (!envio.ok) {
      // Libera a reserva para que a próxima tentativa possa enviar.
      await supabase.from('order_emails').delete().eq('id', reserva.id);
      console.error(`falha ao enviar ${tipo} do pedido ${orderId}:`, envio.erro);
      return { enviado: false, motivo: envio.erro };
    }

    await supabase.from('order_emails').update({ provider_id: envio.id ?? null }).eq('id', reserva.id);
    return { enviado: true };
  } catch (e) {
    console.error(`erro inesperado ao notificar pedido ${orderId} (${tipo}):`, e);
    return { enviado: false, motivo: String(e instanceof Error ? e.message : e) };
  }
}
