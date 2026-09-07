// Preenche o checkout a partir do CPF de quem já comprou antes.
//
// Decisão do dono do negócio (08/09/2026): cliente que volta não deve digitar
// tudo de novo. Como a compra é liberada sem cadastro, o CPF é a única chave
// que ele traz na cabeça.
//
// O que isso custa, e por que está registrado aqui: quem digitar o CPF de
// outra pessoa vê o endereço dela. Foi avaliado e aceito — a base é pequena e
// conhecida. Se um dia crescer, o caminho é exigir CPF + e-mail juntos: muda
// uma linha na consulta abaixo.
//
// Duas defesas ficam de pé mesmo assim:
//   - CPF só é aceito com os dígitos verificadores corretos, o que impede
//     varrer a faixa numérica em sequência;
//   - o rate limit corta tentativa em massa a partir do mesmo lugar.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, clientKey } from '../_shared/rateLimit.ts';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function cpfValido(bruto: string): boolean {
  const d = (bruto || "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Limite apertado de propósito: um cliente digita o próprio CPF uma vez.
  // Dezenas de consultas do mesmo lugar em minutos não é cliente comprando.
  if (!(await checkRateLimit(db, clientKey(req, "checkout-prefill"), 10, 600))) {
    return json({ encontrado: false }, 429);
  }

  try {
    const { cpf } = await req.json().catch(() => ({}));
    const digitos = String(cpf ?? "").replace(/\D/g, "");
    if (!cpfValido(digitos)) return json({ encontrado: false });

    // O pedido mais recente daquele CPF é o que tem o endereço mais atual.
    const { data } = await db.from("orders")
      .select("customer_name, customer_email, customer_phone, phone_e164, " +
              "shipping_street, shipping_number, shipping_complement, shipping_neighborhood, " +
              "shipping_city, shipping_state, shipping_postal_code")
      .eq("customer_cpf", digitos)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return json({ encontrado: false });

    return json({
      encontrado: true,
      cliente: {
        nome: data.customer_name,
        email: data.customer_email,
        telefone: data.phone_e164 ?? data.customer_phone,
        rua: data.shipping_street,
        numero: data.shipping_number,
        complemento: data.shipping_complement,
        bairro: data.shipping_neighborhood,
        cidade: data.shipping_city,
        uf: data.shipping_state,
        cep: data.shipping_postal_code,
      },
    });
  } catch (e) {
    console.error("falha no preenchimento:", e);
    return json({ encontrado: false }, 500);
  }
});
