// Cadastro do promotor pelo CÓDIGO DE CONVITE (a porta de entrada).
// O código é a autorização: só admin gera, vale 24h e é de uso único.
// Como o projeto exige confirmação de e-mail, a conta é criada JÁ CONFIRMADA aqui
// (service role) — o promotor entra na hora, sem esperar e-mail.
// Gate: público, mas inútil sem um código válido de promotor.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? "").trim().toUpperCase();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const full_name = String(body.full_name ?? "").trim();
    const cpf = String(body.cpf ?? "").replace(/\D/g, "") || null;
    const phone = String(body.phone ?? "").trim() || null;

    if (!code) return json({ error: "Informe o código de convite." }, 400);
    if (!full_name) return json({ error: "Informe o nome completo." }, 400);
    if (!email || !email.includes("@")) return json({ error: "E-mail inválido." }, 400);
    if (password.length < 6) return json({ error: "A senha precisa ter pelo menos 6 caracteres." }, 400);

    // 1. o código manda: precisa ser de promotor, não usado e dentro da validade
    const { data: inv } = await db.from("repco_invite_codes")
      .select("id, company_id, used_by, expires_at, role_code")
      .ilike("code", code).maybeSingle();
    if (!inv || inv.role_code !== "promotor") return json({ error: "Código inválido." }, 400);
    if (inv.used_by) return json({ error: "Este código já foi usado." }, 400);
    if (new Date(inv.expires_at) < new Date()) return json({ error: "Código expirado. Peça um novo ao administrador." }, 400);

    // 2. cria a conta JÁ CONFIRMADA (sem espera de e-mail)
    const { data: created, error: cErr } = await db.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name, phone },
    });
    if (cErr || !created?.user) {
      const msg = String(cErr?.message ?? "");
      if (/already|exists|registered/i.test(msg)) {
        return json({ error: "Já existe uma conta com esse e-mail. Use 'Entrar' com ela, ou cadastre outro e-mail." }, 409);
      }
      return json({ error: msg || "Não foi possível criar a conta." }, 400);
    }
    const uid = created.user.id;

    // 3. perfil, promotor (pendente de aprovação) e papel
    await db.from("user_profiles").upsert({ id: uid, full_name, phone }, { onConflict: "id" });
    const { error: pErr } = await db.from("promoters").insert({
      user_id: uid, full_name, cpf, phone, email, status: "pending", company_id: inv.company_id,
    });
    if (pErr) {
      await db.auth.admin.deleteUser(uid); // desfaz para não deixar conta órfã
      return json({ error: "Não foi possível concluir o cadastro: " + pErr.message }, 400);
    }
    await db.from("user_roles").insert({ user_id: uid, role_code: "promotor", company_id: inv.company_id });

    // 4. queima o código (uso único)
    await db.from("repco_invite_codes").update({ used_by: uid, used_at: new Date().toISOString() }).eq("id", inv.id);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
