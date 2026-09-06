// Estorno de pagamento pelo painel.
//
// Devolve dinheiro de verdade ao cliente, então tudo aqui é conservador:
//   - exige ADMINISTRADOR (verificado com o JWT de quem chama);
//   - usa a credencial da EMPRESA QUE RECEBEU, nunca uma conta padrão;
//   - roda em confirmação dupla: sem `confirmar:true` só devolve o diagnóstico;
//   - registra em payment_refunds quem pediu, quanto e o que o MP respondeu;
//   - não marca o pedido como estornado por conta própria: quem faz isso é o
//     webhook, quando o Mercado Pago confirmar. Assim o estado do pedido vem
//     sempre da mesma fonte, e o estoque volta ao lote pelo caminho já testado.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mpAccessToken } from '../_shared/mpCredentials.ts';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const db = createClient(url, service);

  try {
    const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "forbidden" }, 403);
    const { data: isAdmin } = await asUser.rpc("is_admin");
    if (!isAdmin) return json({ error: "apenas administrador pode estornar" }, 403);

    const body = await req.json().catch(() => ({}));
    const orderId: string = String(body.order_id ?? "");
    const confirmar: boolean = body.confirmar === true;
    const valorParcial: number | null = Number.isFinite(body.valor) && Number(body.valor) > 0 ? Number(body.valor) : null;
    if (!orderId) return json({ error: "order_id obrigatorio" }, 400);

    const { data: pedido, error: errPed } = await db.from("orders")
      .select("id, order_number, status, total_amount, mercadopago_payment_id, seller_company_id, customer_name")
      .eq("id", orderId).maybeSingle();
    if (errPed) return json({ error: errPed.message }, 500);
    if (!pedido) return json({ error: "pedido nao encontrado" }, 404);

    if (pedido.status !== "approved") {
      return json({ error: `So da para estornar pedido pago. Este esta como "${pedido.status}".`, code: "NAO_PAGO" }, 409);
    }
    if (!pedido.mercadopago_payment_id) {
      return json({ error: "Pedido sem pagamento registrado no Mercado Pago.", code: "SEM_PAGAMENTO" }, 409);
    }

    const { data: empresa } = await db.from("companies")
      .select("id, name, payment_account").eq("id", pedido.seller_company_id).maybeSingle();
    const cred = mpAccessToken(empresa?.payment_account);
    if (!cred) {
      return json({ error: `A empresa ${empresa?.name ?? "do pedido"} nao tem credencial configurada.`, code: "SEM_CREDENCIAL" }, 503);
    }

    const valor = valorParcial ?? Number(pedido.total_amount);

    // Sem confirmação, devolve só o que aconteceria. Ninguém estorna sem ver antes.
    if (!confirmar) {
      return json({
        modo: "confirmacao_necessaria",
        pedido: pedido.order_number,
        cliente: pedido.customer_name,
        empresa: empresa?.name,
        valor_a_estornar: valor,
        total_do_pedido: Number(pedido.total_amount),
        parcial: valorParcial !== null,
        pagamento_mp: pedido.mercadopago_payment_id,
        aviso: "Nada foi estornado. Envie confirmar:true para devolver o dinheiro.",
      });
    }

    const { data: registro } = await db.from("payment_refunds").insert({
      order_id: pedido.id,
      mp_payment_id: pedido.mercadopago_payment_id,
      amount: valor,
      is_partial: valorParcial !== null,
      status: "solicitado",
      requested_by: user.id,
    }).select("id").single();

    // Estorno total manda corpo vazio; parcial manda o valor.
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${pedido.mercadopago_payment_id}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.token}`,
        "Content-Type": "application/json",
        // Impede estorno duplicado se a mesma requisição for repetida.
        "X-Idempotency-Key": `refund-${pedido.id}-${valorParcial ?? "total"}`,
      },
      body: valorParcial !== null ? JSON.stringify({ amount: valorParcial }) : undefined,
    });

    const texto = await r.text();
    let resposta: unknown = texto;
    try { resposta = JSON.parse(texto); } catch { /* mantem texto */ }

    if (!r.ok) {
      await db.from("payment_refunds").update({
        status: "falhou", error_text: texto.slice(0, 500), mp_response: resposta as Record<string, unknown>,
      }).eq("id", registro?.id);
      return json({ error: "O Mercado Pago recusou o estorno.", http: r.status, detalhe: resposta }, 502);
    }

    const mpRefund = resposta as Record<string, unknown>;
    await db.from("payment_refunds").update({
      status: "concluido",
      mp_refund_id: mpRefund?.id ? String(mpRefund.id) : null,
      mp_response: mpRefund,
    }).eq("id", registro?.id);

    return json({
      ok: true,
      pedido: pedido.order_number,
      valor_estornado: valor,
      estorno_mp: mpRefund?.id ?? null,
      situacao: mpRefund?.status ?? null,
      observacao: "O Mercado Pago vai notificar o estorno. O pedido muda para estornado e o estoque volta ao lote automaticamente.",
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
