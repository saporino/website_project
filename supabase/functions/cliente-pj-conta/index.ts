// Cria a conta do cliente PJ a partir de um convite válido.
//
// POR QUE ISTO EXISTE: o signUp do navegador não devolve sessão quando a
// confirmação de e-mail está ligada, e o cadastro morria no último passo com
// "Sessão necessária". Descoberto na bancada de tela, não em produção.
//
// E por que pode confirmar o e-mail: o CONVITE já é a prova. O admin gerou o
// código para aquele endereço e o enviou para lá; quem tem o código tem o
// e-mail. Pedir uma segunda confirmação do mesmo endereço não acrescenta
// segurança, só perde cliente no meio do caminho.
//
// O que esta função NÃO faz: criar ficha, dar papel, conceder crédito. Ela só
// cria a conta. A ficha nasce depois, pela RPC `cliente_pj_registrar`, com a
// sessão do próprio cliente e sob as policies dele.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const { codigo, senha } = await req.json().catch(() => ({}));
    if (typeof codigo !== "string" || !codigo.trim()) return json({ error: "Código obrigatório." }, 400);
    if (typeof senha !== "string" || senha.length < 8) return json({ error: "Senha de no mínimo 8 caracteres." }, 400);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // O código manda. Confere pela mesma função que a tela usa — uma fonte só
    // de verdade sobre o que é um convite válido.
    const { data: v, error: ev } = await db.rpc("repco_validate_invite_pj", { p_code: codigo.trim() });
    if (ev) return json({ error: "Não foi possível conferir o código." }, 500);
    const r = Array.isArray(v) ? v[0] : v;
    if (!r?.valido) return json({ error: r?.motivo ?? "Código inválido." }, 400);

    const email = String(r.email ?? "").trim().toLowerCase();
    if (!email) return json({ error: "Este convite não tem e-mail associado. Peça um novo." }, 400);

    const { data: criado, error: ec } = await db.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,   // o convite já provou o endereço
      user_metadata: { brand: "CO", origem: "cadastro_pj" },
    });

    if (ec) {
      // Já criou a conta antes e voltou para terminar: não é erro, é retomada.
      // O código continua não consumido, então a ficha ainda pode nascer.
      const jaExiste = /already|registered|exists/i.test(ec.message ?? "");
      if (jaExiste) return json({ ok: true, email, jaExistia: true });
      return json({ error: "Não foi possível criar o acesso: " + ec.message }, 400);
    }

    // Nenhum papel é dado aqui. O papel cliente_pj sai de `cliente_pj_registrar`,
    // quando o código for efetivamente consumido.
    return json({ ok: true, email, userId: criado.user?.id ?? null });
  } catch (e) {
    return json({ error: "Falha inesperada: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
