// Instagram OAuth (Instagram API with Instagram Login / IGAA) — recebe o ?code após o usuário autorizar,
// troca por token de curta duração → longa duração (60 dias) e guarda em studio_social_connections (platform instagram).
// Cada conta (ex.: @cafesaporino, @cafetropeiropaulista) autoriza a SI mesma; o state leva a MARCA (aba do Studio).
// Uma conta do Instagram fica ligada a UMA marca só: se já estiver em outra aba, recusa (evita post no perfil errado).
// Redirect URI a registrar no app da Meta (Instagram business login):
//   https://<ref>.supabase.co/functions/v1/instagram-oauth
// Secrets necessários: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET. Deploy: --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/instagram-oauth`;
const APP_RETURN = "https://www.cafesaporino.com.br/admin";
// escopos da Instagram API with Instagram Login: ler o básico + publicar conteúdo
const SCOPES = "instagram_business_basic,instagram_business_content_publish";

// Volta pro Studio (aba Conexões da marca) com o resultado na URL. Página HTML própria não
// serve: o gateway do Supabase entrega HTML de função como texto puro.
function html(msg: string, marca?: string) {
  const u = new URL(APP_RETURN);
  u.searchParams.set("studio_conexao", msg.startsWith("✅") ? "ok" : "erro");
  u.searchParams.set("studio_msg", msg.replace(/<[^>]+>/g, "").replace(/^(✅|❌|⚠️)\s*/u, ""));
  if (marca) u.searchParams.set("studio_marca", marca);
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}

/**
 * Resposta para quem NÃO é da casa — o cliente autorizando a própria conta.
 *
 * O `html()` acima joga a pessoa em cafesaporino.com.br/admin. Para nós isso é
 * o Studio; para o cliente é a tela de login de um painel que não é dele, sem
 * explicação nenhuma. Foi exatamente o que aconteceu com o Anderson do Fino
 * Paladar: ele autorizou e "não apareceu nada".
 *
 * Texto puro de propósito: o gateway do Supabase entrega HTML de função como
 * texto, então HTML bonito aqui vira sopa de tags na tela do cliente.
 */
function recado(linhas: string[]) {
  return new Response(linhas.join("\n") + "\n", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// state "b:<brand_id>" → a marca; state antigo (company_id) → marca principal da empresa.
async function marcaDoState(db: any, state: string | null) {
  if (!state) return null;
  const cols = "id, name, company_id, organization_id, tipo";
  if (state.startsWith("b:")) {
    const { data } = await db.from("studio_brand_profiles").select(cols).eq("id", state.slice(2)).maybeSingle();
    return data;
  }
  const { data } = await db.from("studio_brand_profiles").select(cols).eq("company_id", state)
    .order("is_primary", { ascending: false }).order("ordem").limit(1).maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const APP_ID = Deno.env.get("INSTAGRAM_APP_ID");
  const APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET");
  if (!APP_ID || !APP_SECRET) return html("❌ Configurar INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET nos secrets do Supabase.");

  // ?diagnostico=1 → o app aceita conta de TERCEIRO, ou só as nossas?
  //
  // Um app da Meta em modo Desenvolvimento só autoriza contas que tenham função
  // nele. Descobrir isso com o cliente do outro lado da linha é a pior hora
  // possível — a ideia era responder antes.
  //
  // ⚠️ NÃO FUNCIONA, e vale saber por quê antes de tentar de novo (16/10/2026):
  // este app é do tipo "Instagram API with Instagram Login", e o INSTAGRAM_APP_ID
  // dele NÃO é um app id do Facebook. O graph.facebook.com responde
  // "Error validating application. Cannot get application info" para qualquer
  // consulta — inclusive /roles e /permissions. O modo do app, para este tipo,
  // só se lê no painel: developers.facebook.com → o app → seletor no topo.
  //
  // Fica no código porque a mensagem de erro já diz o que fazer, e porque
  // registra a tentativa: o caminho é o painel, não a Graph API.
  //
  // Nunca devolve APP_ID nem APP_SECRET: só o que serve para decidir.
  if (url.searchParams.get("diagnostico")) {
    const appToken = APP_ID + "|" + APP_SECRET;
    const linhas: string[] = [];
    const graph = async (caminho: string) => {
      const sep = caminho.includes("?") ? "&" : "?";
      const r = await fetch("https://graph.facebook.com/v21.0/" + caminho + sep +
        "access_token=" + encodeURIComponent(appToken));
      return await r.json().catch(() => ({}));
    };
    try {
      const app = await graph(APP_ID + "?fields=name,company,link");
      if (app?.error) {
        linhas.push("NAO CONSEGUI LER O APP: " + app.error.message);
      } else {
        linhas.push("App: " + (app.name ?? "(sem nome)"));
      }

      // Quem tem função no app. Em modo Desenvolvimento, SÓ estas contas autorizam.
      const roles = await graph(APP_ID + "/roles");
      const pessoas = Array.isArray(roles?.data) ? roles.data : [];
      linhas.push("Pessoas com função no app: " + (roles?.error ? "nao consegui ler" : pessoas.length));
      for (const p of pessoas.slice(0, 15)) {
        linhas.push("   - " + (p.user ?? p.name ?? p.id ?? "?") + "  (" + (p.role ?? "?") + ")");
      }

      // O teste que vale: um app em Desenvolvimento NÃO consegue ler a própria
      // lista de permissões aprovadas no App Review. Em Live, consegue.
      const perms = await graph(APP_ID + "/permissions");
      const aprovadas = Array.isArray(perms?.data) ? perms.data : [];
      linhas.push("");
      if (perms?.error) {
        linhas.push("Permissoes aprovadas: nao consegui ler (" + perms.error.message + ")");
      } else if (aprovadas.length === 0) {
        linhas.push("Permissoes aprovadas no App Review: NENHUMA");
        linhas.push(">> Sinal forte de app em MODO DESENVOLVIMENTO.");
      } else {
        linhas.push("Permissoes aprovadas no App Review:");
        for (const p of aprovadas) linhas.push("   - " + (p.permission ?? JSON.stringify(p)));
        const publica = aprovadas.some((p: Record<string, unknown>) =>
          String(p.permission ?? "").includes("content_publish"));
        linhas.push("");
        linhas.push(publica
          ? ">> content_publish APROVADO: conta de cliente consegue autorizar."
          : ">> content_publish NAO aparece aprovado: cliente pode nao conseguir autorizar.");
      }

      linhas.push("");
      linhas.push("O QUE FAZER:");
      linhas.push("  Se o cliente NAO estiver na lista de pessoas com funcao e o app");
      linhas.push("  estiver em desenvolvimento, adicione o Instagram dele como");
      linhas.push("  TESTADOR antes de mandar o link:");
      linhas.push("  developers.facebook.com -> seu app -> Funcoes -> Testadores");
    } catch (e) {
      linhas.push("Falhou: " + (e as Error).message);
    }
    return new Response(linhas.join("\n"), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // INÍCIO do fluxo: ?start=1&brand=<id> → manda o usuário pro Instagram autorizar
  // (?company=<id> ainda vale: cai na marca principal da empresa)
  if (url.searchParams.get("start")) {
    const brand = url.searchParams.get("brand");
    const alvo = brand ? `b:${brand}` : (url.searchParams.get("company") || "");
    const auth = new URL("https://www.instagram.com/oauth/authorize");
    auth.searchParams.set("client_id", APP_ID);
    auth.searchParams.set("redirect_uri", REDIRECT_URI);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", SCOPES);
    auth.searchParams.set("state", alvo);
    // pede login de novo: sem isto o Instagram autoriza a conta que já está aberta no navegador
    auth.searchParams.set("force_reauth", "true");
    return new Response(null, { status: 302, headers: { Location: auth.toString() } });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // b:<brand_id> ou company_id (legado)
  const err = url.searchParams.get("error_description") || url.searchParams.get("error");

  // Tudo o que chega na volta do Instagram vira registro. Sem isto, "não
  // apareceu nada" é impossível de investigar: o cliente está no navegador
  // dele, do outro lado da cidade, e a gente não vê.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const registrar = async (nivel: "info" | "warn" | "error", o_que: string, extra?: Record<string, unknown>) => {
    try {
      await supabase.from("edge_logs").insert({
        function_name: "instagram-oauth", level: nivel, error_text: o_que,
        meta: { state, tem_code: !!code, erro_do_instagram: err ?? null, ...extra },
      });
    } catch { /* fail-open: log não pode derrubar a conexão */ }
    console.log(`[${nivel}] instagram-oauth: ${o_que}`);
  };

  await registrar(err ? "warn" : "info", err ? "Instagram voltou com erro" : "Instagram voltou com código");

  if (err) {
    // Este é o caminho do app em modo Desenvolvimento: a conta não tem função
    // no app, o Instagram recusa, e até hoje o cliente caía no /admin da
    // Saporino sem entender nada.
    return recado([
      "Não deu para concluir a autorização.",
      "",
      "O Instagram respondeu: " + err,
      "",
      "Isso costuma acontecer quando a conta ainda não foi liberada para este",
      "aplicativo. Avise a COFICO Brasil — a liberação leva poucos minutos, e",
      "depois é só abrir o mesmo link de novo.",
    ]);
  }
  if (!code) {
    return recado([
      "Faltou o código de autorização do Instagram.",
      "",
      "Abra o link que a COFICO Brasil enviou outra vez, direto — sem copiar",
      "pedaços do endereço. Se continuar, avise a COFICO Brasil.",
    ]);
  }

  try {
    const marca = await marcaDoState(supabase, state);
    if (!marca) {
      await registrar("error", "state não resolveu nenhuma marca");
      return recado([
        "Não consegui identificar a conta que você está autorizando.",
        "",
        "Avise a COFICO Brasil e peça um link novo.",
      ]);
    }

    // 1) troca o code por token de CURTA duração (~1h)
    const form = new URLSearchParams({
      client_id: APP_ID, client_secret: APP_SECRET,
      grant_type: "authorization_code", redirect_uri: REDIRECT_URI,
      code: code.replace(/#_$/, ""), // o IG às vezes anexa "#_" no fim do code
    });
    const sRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form,
    });
    const sJson = await sRes.json().catch(() => ({}));
    if (!sRes.ok || !sJson.access_token) throw new Error("curta duração: " + JSON.stringify(sJson).slice(0, 250));
    const shortToken = sJson.access_token as string;

    // 2) troca por token de LONGA duração (60 dias) — depois o cron renova sozinho
    const lRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${APP_SECRET}&access_token=${shortToken}`);
    const lJson = await lRes.json().catch(() => ({}));
    if (!lRes.ok || !lJson.access_token) throw new Error("longa duração: " + JSON.stringify(lJson).slice(0, 250));
    const longToken = lJson.access_token as string;
    const expiresAt = lJson.expires_in ? new Date(Date.now() + lJson.expires_in * 1000).toISOString() : null;

    // 3) descobre id + @ da conta (id é o que o publish usa em /{id}/media)
    const meRes = await fetch(`https://graph.instagram.com/me?fields=user_id,username&access_token=${longToken}`);
    const me = await meRes.json().catch(() => ({}));
    const accountId = String(me.user_id || sJson.user_id || "");
    const username = me.username ? `@${me.username}` : null;
    if (!accountId) throw new Error("não consegui identificar a conta do Instagram.");

    // 4) a mesma conta não pode ficar em duas abas: o post de uma marca cairia no perfil da outra
    const { data: outras } = await supabase.from("studio_social_connections")
      .select("brand_id, studio_brand_profiles(name)").eq("platform", "instagram").eq("account_id", accountId)
      .neq("brand_id", marca.id).limit(1);
    const outra = (outras || [])[0] as any;
    if (outra) {
      const nome = outra.studio_brand_profiles?.name || "outra marca";
      await registrar("warn", "conta ja ligada a outra marca", { conta: username, ja_em: nome, tentou: marca.name });
      return recado([
        (username || "Esta conta") + " já está conectada em outra aba (" + nome + ").",
        "",
        "Uma conta do Instagram fica ligada a uma marca só — é o que impede",
        "um post sair no perfil errado.",
        "",
        "Para conectar " + marca.name + ", entre com a conta do Instagram dessa marca.",
      ]);
    }

    const { error } = await supabase.from("studio_social_connections").upsert({
      brand_id: marca.id, company_id: marca.company_id, organization_id: marca.organization_id, platform: "instagram",
      account_id: accountId, account_name: username, access_token: longToken,
      expires_at: expiresAt, status: "connected", updated_at: new Date().toISOString(),
      meta: { scope: SCOPES, connected_via: "oauth" },
    }, { onConflict: "brand_id,platform" });
    if (error) throw new Error(error.message);

    await registrar("info", "conectado", { conta: username, marca: marca.name, tipo: marca.tipo ?? null });

    // Marca da casa volta para o Studio; conta de CLIENTE recebe um recado --
    // ele nao tem acesso ao /admin da Saporino, e cair la foi o "nao apareceu
    // nada" do Anderson.
    if (marca.tipo === "cliente") {
      return recado([
        "Pronto! " + (username || "Sua conta") + " foi conectada com sucesso.",
        "",
        "A COFICO Brasil já pode preparar e publicar as postagens de " + marca.name + ".",
        "Você pode fechar esta janela.",
        "",
        "Se quiser revogar o acesso um dia: Instagram > Configurações >",
        "Apps e sites > remover a autorização.",
      ]);
    }
    return html(`✅ Instagram ${username || accountId} conectado à marca ${marca.name}.`, marca.id);
  } catch (e) {
    const msg = (e as Error).message;
    await registrar("error", "falhou ao conectar: " + msg);
    return recado([
      "Não deu para concluir a autorização.",
      "",
      "Detalhe técnico: " + msg,
      "",
      "Avise a COFICO Brasil com essa mensagem — assim dá para resolver rápido.",
    ]);
  }
});
