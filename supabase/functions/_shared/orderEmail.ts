// E-mails do pedido: confirmação, pronto para retirada, enviado, e o aviso interno.
//
// Mesma moldura e mesma marca dos e-mails de autenticação — para quem recebe, é a
// mesma loja falando. A identidade vem da EMPRESA FATURADORA gravada no pedido,
// não do domínio: depois que o pedido existe, quem manda é ele.
import {
  type Identidade, type Marca, identidade, marcaPorPrefixo, moldura, p, nota, esc,
} from "./brandEmail.ts";

export type ItemPedido = { product_name: string; quantity: number; unit_price: number; subtotal: number };

export type PedidoEmail = {
  order_number: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  shipping_cost: number;
  is_pickup: boolean;
  shipping_carrier_name: string | null;
  shipping_address: string | null;
  tracking_code?: string | null;
  tracking_url?: string | null;
};

export type EmpresaEmail = {
  name: string;
  order_prefix: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  pickup_hours: string | null;
  notify_email: string | null;
};

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function identidadeDaEmpresa(empresa: EmpresaEmail): Identidade {
  return identidade(marcaPorPrefixo(empresa.order_prefix) as Marca);
}

/** Endereço de retirada montado a partir do cadastro da empresa. */
export function enderecoDaEmpresa(e: EmpresaEmail): string {
  const linha = [e.endereco, [e.cidade, e.uf].filter(Boolean).join("/"), e.cep ? `CEP ${e.cep}` : null]
    .filter(Boolean).join(" — ");
  return linha || e.name;
}

/** Tabela de itens. Sem imagem de propósito: imagem em e-mail costuma vir bloqueada. */
function tabelaItens(itens: ItemPedido[], pedido: PedidoEmail, cor: string): string {
  const linhas = itens.map((i) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0eae8;font-size:14px;color:#3f3a38">
        ${esc(i.product_name)}<br>
        <span style="font-size:12px;color:#8a8078">${i.quantity} × ${brl(i.unit_price)}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #f0eae8;font-size:14px;color:#3f3a38;text-align:right;white-space:nowrap">
        ${brl(i.subtotal)}
      </td>
    </tr>`).join("");

  const frete = pedido.is_pickup
    ? `<tr><td style="padding:8px 0;font-size:14px;color:#8a8078">Retirada no local</td>
           <td style="padding:8px 0;font-size:14px;color:#8a8078;text-align:right">sem frete</td></tr>`
    : `<tr><td style="padding:8px 0;font-size:14px;color:#8a8078">Frete${pedido.shipping_carrier_name ? ` — ${esc(pedido.shipping_carrier_name)}` : ""}</td>
           <td style="padding:8px 0;font-size:14px;color:#8a8078;text-align:right">${brl(pedido.shipping_cost)}</td></tr>`;

  return `
  <table style="width:100%;border-collapse:collapse;margin:18px 0 0">
    ${linhas}
    ${frete}
    <tr>
      <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#1a1a1a">Total</td>
      <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:${cor};text-align:right">${brl(pedido.total_amount)}</td>
    </tr>
  </table>`;
}

function blocoEntrega(pedido: PedidoEmail, empresa: EmpresaEmail): string {
  if (pedido.is_pickup) {
    return `
    <div style="margin:18px 0 0;padding:14px 16px;background:#faf8f7;border:1px solid #eee7e5;border-radius:10px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a1a1a">Retirada no local</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3a38">${esc(enderecoDaEmpresa(empresa))}</p>
      ${empresa.pickup_hours ? `<p style="margin:6px 0 0;font-size:13px;color:#8a8078">${esc(empresa.pickup_hours)}</p>` : ""}
    </div>`;
  }
  return `
    <div style="margin:18px 0 0;padding:14px 16px;background:#faf8f7;border:1px solid #eee7e5;border-radius:10px">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a1a1a">Entrega</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3a38">${esc(pedido.shipping_address ?? "")}</p>
    </div>`;
}

export type Montado = { assunto: string; html: string; para: string };

/** 1. Pagamento aprovado — o e-mail que hoje não existe e faz falta. */
export function emailPedidoConfirmado(pedido: PedidoEmail, itens: ItemPedido[], empresa: EmpresaEmail): Montado {
  const id = identidadeDaEmpresa(empresa);
  const primeiroNome = String(pedido.customer_name || "").split(" ")[0];

  // O que acontece a seguir muda com o tipo de entrega, e é a dúvida real de
  // quem acabou de pagar: "e agora?"
  const proximo = pedido.is_pickup
    ? p("Vamos separar seu café e avisar assim que estiver pronto para retirada. <b>Espere esse aviso antes de vir</b>.")
    : p("Vamos separar seu café e avisar quando ele for despachado, com o código de rastreio.");

  return {
    para: pedido.customer_email,
    assunto: `Pagamento confirmado — pedido ${pedido.order_number}`,
    html: moldura(id, "Pagamento confirmado",
      p(`${primeiroNome ? `Olá, ${esc(primeiroNome)}! ` : ""}Recebemos seu pagamento. Obrigado pela compra.`) +
      proximo +
      `<p style="margin:20px 0 0;font-size:13px;color:#8a8078">Pedido <b style="color:#1a1a1a">${esc(pedido.order_number)}</b></p>` +
      tabelaItens(itens, pedido, id.cor) +
      blocoEntrega(pedido, empresa) +
      nota(`Qualquer dúvida, responda para <a href="mailto:${id.sac}" style="color:${id.cor}">${id.sac}</a>.`),
      null),
  };
}

/** 2. Aviso interno: entrou pedido pago, tem café para separar. */
export function emailAvisoAdmin(pedido: PedidoEmail, itens: ItemPedido[], empresa: EmpresaEmail): Montado | null {
  if (!empresa.notify_email) return null;
  const id = identidadeDaEmpresa(empresa);
  const como = pedido.is_pickup ? "RETIRADA no local" : `envio por ${esc(pedido.shipping_carrier_name ?? "transportadora")}`;

  return {
    para: empresa.notify_email,
    assunto: `Pedido pago ${pedido.order_number} — ${brl(pedido.total_amount)}`,
    html: moldura(id, "Entrou pedido pago",
      p(`<b>${esc(pedido.order_number)}</b> — ${esc(pedido.customer_name)}`) +
      p(`Modalidade: <b>${como}</b>`) +
      tabelaItens(itens, pedido, id.cor) +
      blocoEntrega(pedido, empresa) +
      nota(`Cliente: ${esc(pedido.customer_email)}`),
      null),
  };
}

/** 3. Pronto para retirada — disparado quando o painel confirma a separação. */
export function emailProntoRetirada(pedido: PedidoEmail, empresa: EmpresaEmail): Montado {
  const id = identidadeDaEmpresa(empresa);
  const primeiroNome = String(pedido.customer_name || "").split(" ")[0];

  return {
    para: pedido.customer_email,
    assunto: `Seu pedido ${pedido.order_number} está pronto para retirada`,
    html: moldura(id, "Pode vir buscar",
      p(`${primeiroNome ? `${esc(primeiroNome)}, s` : "S"}eu pedido <b>${esc(pedido.order_number)}</b> está separado e esperando por você.`) +
      `<div style="margin:18px 0 0;padding:14px 16px;background:#faf8f7;border:1px solid #eee7e5;border-radius:10px">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3a38">${esc(enderecoDaEmpresa(empresa))}</p>
        ${empresa.pickup_hours ? `<p style="margin:6px 0 0;font-size:13px;color:#8a8078">${esc(empresa.pickup_hours)}</p>` : ""}
      </div>` +
      nota("Leve um documento com foto. Se outra pessoa for retirar, avise a gente antes."),
      null),
  };
}

/** 4. Enviado — com o código de rastreio. */
export function emailEnviado(pedido: PedidoEmail, empresa: EmpresaEmail): Montado {
  const id = identidadeDaEmpresa(empresa);
  const primeiroNome = String(pedido.customer_name || "").split(" ")[0];
  const rastreio = pedido.tracking_code
    ? `<div style="margin:18px 0 0;padding:14px 16px;background:#faf8f7;border:1px solid #eee7e5;border-radius:10px">
         <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1a1a1a">Código de rastreio</p>
         <p style="margin:0;font-size:16px;font-weight:700;letter-spacing:1px;color:${id.cor}">${esc(pedido.tracking_code)}</p>
       </div>`
    : "";

  return {
    para: pedido.customer_email,
    assunto: `Seu pedido ${pedido.order_number} foi enviado`,
    html: moldura(id, "Seu café está a caminho",
      p(`${primeiroNome ? `${esc(primeiroNome)}, s` : "S"}eu pedido <b>${esc(pedido.order_number)}</b> saiu para entrega` +
        `${pedido.shipping_carrier_name ? ` pela ${esc(pedido.shipping_carrier_name)}` : ""}.`) +
      rastreio +
      (pedido.shipping_address ? blocoEntrega(pedido, empresa) : "") +
      nota("O rastreio costuma levar algumas horas para começar a mostrar movimentação."),
      pedido.tracking_url ? { texto: "Acompanhar entrega", link: pedido.tracking_url } : null),
  };
}
