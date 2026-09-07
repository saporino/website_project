// Cotação de frete pelo SuperFrete.
//
// Por que existe: a tabela própria cobra R$ 34,50 num pacote de 500 g para
// Jundiaí; o mesmo trajeto pelo agregador sai a R$ 5,12. Com a tabela própria
// o frete custa mais que o café, e o carrinho morre no CEP.
//
// O token fica AQUI, no servidor. Ele emite etiqueta e gasta saldo de verdade —
// se trafegasse pelo navegador, qualquer visitante poderia gastar o dinheiro
// da loja.
//
// Deploy com --no-verify-jwt: o checkout é público e cota antes de a pessoa
// ter conta. A proteção é o rate limit, não o login.
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

const API = "https://api.superfrete.com/api/v0/calculator";

// O SuperFrete exige User-Agent com um contato — é como eles identificam quem
// está chamando e a quem recorrer se algo der errado.
const UA = "Cafe Saporino (sac@cafesaporino.com.br)";

const so = (v: unknown) => String(v ?? "").replace(/\D/g, "");

type Opcao = {
  id: number; nome: string; empresa: string;
  preco: number; prazo_dias: number | null; erro: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Cotação é barata mas não é grátis: cada chamada bate na API deles.
  if (!(await checkRateLimit(db, clientKey(req, "superfrete-quote"), 60, 300))) {
    return json({ error: "Muitas consultas. Aguarde um momento." }, 429);
  }

  const token = Deno.env.get("SUPERFRETE_TOKEN");
  if (!token) {
    return json({ error: "Integracao de frete nao configurada.", code: "SEM_TOKEN" }, 503);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const cepDestino = so(body.cep);
    const pacotes = Math.max(1, Math.min(Number(body.pacotes) || 1, 200));
    const valorNota = Math.max(0, Number(body.valor) || 0);
    const prefixo = String(body.empresa ?? "CS");

    if (cepDestino.length !== 8) return json({ error: "CEP invalido", code: "BAD_CEP" }, 400);

    // Configuração da empresa vendedora: origem, serviços e margem.
    const { data: empresa } = await db.from("companies")
      .select("id, shipping_subsidy_per_kg, shipping_discount_active, shipping_discount_unit, shipping_discount_min_packs")
      .eq("order_prefix", prefixo).maybeSingle();
    if (!empresa) return json({ error: "Empresa nao encontrada", code: "NO_COMPANY" }, 400);

    const { data: cfg } = await db.from("superfrete_settings")
      .select("*").eq("company_id", empresa.id).maybeSingle();
    if (!cfg?.is_active) {
      return json({ error: "Integracao de frete desligada.", code: "INATIVA" }, 503);
    }

    // Peso e medidas do envio: peso BRUTO (café + envelope) e as dimensões de
    // POSTAGEM, que já respeitam o mínimo de 16 cm dos Correios.
    const { data: pesoBruto } = await db.rpc("peso_bruto_kg", { p_unidades: pacotes });
    const { data: specs } = await db.from("packaging_specs")
      .select("units, ship_w_cm, ship_d_cm, ship_h_cm")
      .gte("units", pacotes).order("units").limit(1);
    const spec = specs?.[0] ?? (await db.from("packaging_specs")
      .select("units, ship_w_cm, ship_d_cm, ship_h_cm").order("units", { ascending: false }).limit(1)).data?.[0];

    const pedido = {
      from: { postal_code: so(cfg.origin_cep) },
      to: { postal_code: cepDestino },
      // 1 PAC · 2 SEDEX · 17 Mini Envios · 3 Jadlog · 31 Loggi · 33 J&T
      services: String(cfg.services || "1,2,3,17,31,33"),
      options: { own_hand: false, receipt: false, insurance_value: valorNota, use_insurance_value: valorNota > 0 },
      package: {
        height: Number(spec?.ship_h_cm ?? 16),
        width: Number(spec?.ship_w_cm ?? 16),
        length: Number(spec?.ship_d_cm ?? 8),
        weight: Number(pesoBruto ?? pacotes * 0.5),
      },
    };

    const r = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": UA,
      },
      body: JSON.stringify(pedido),
    });

    const texto = await r.text();
    if (!r.ok) {
      await db.from("superfrete_settings")
        .update({ last_error: texto.slice(0, 400), updated_at: new Date().toISOString() })
        .eq("id", cfg.id);
      console.error("superfrete recusou:", r.status, texto.slice(0, 300));
      return json({ error: "Nao foi possivel cotar o frete agora.", http: r.status }, 502);
    }

    const bruto = JSON.parse(texto);
    const lista: Opcao[] = (Array.isArray(bruto) ? bruto : []).map((o: Record<string, unknown>) => ({
      id: Number(o.id),
      nome: String(o.name ?? ""),
      empresa: String((o.company as Record<string, unknown>)?.name ?? ""),
      // Serviço indisponível para aquele CEP ou pacote fora das medidas vem
      // marcado com has_error e sem preço. Mini Envios, por exemplo, recusa
      // qualquer coisa acima de 300 g — o nosso pacote nunca cabe.
      preco: Number(o.price ?? 0),
      prazo_dias: o.delivery_time != null ? Number(o.delivery_time) : null,
      erro: o.has_error ? String(o.has_error) : (o.error ? String(o.error) : null),
    }));

    // Margem e desconto, nesta ordem: primeiro a loja soma o que quer ganhar,
    // depois abate o que ela banca. O cliente vê o resultado e o desconto.
    //
    // A unidade muda muito o valor, e é decisão comercial: no fardo,
    // R$ 1,50 × 10 pacotes = R$ 15,00, contra R$ 7,64 se fosse por quilo.
    const valeDesconto = empresa.shipping_discount_active !== false
      && pacotes >= Number(empresa.shipping_discount_min_packs ?? 1);

    // Por quilo, conta o peso do CAFÉ (500 g por pacote), não o do pacote
    // fechado. O frete é cobrado pelo bruto porque a transportadora pesa o
    // envelope junto, mas a loja não banca frete de embalagem.
    const quantidade = empresa.shipping_discount_unit === "pacote"
      ? pacotes
      : pacotes * 0.5;
    const subsidio = valeDesconto ? Number(empresa.shipping_subsidy_per_kg ?? 0) * quantidade : 0;
    const opcoes = lista
      .filter((o) => !o.erro && o.preco > 0)
      .map((o) => {
        const comMargem = o.preco * (1 + Number(cfg.markup_pct) / 100) + Number(cfg.markup_fixo);
        const desconto = Math.min(subsidio, comMargem);
        return {
          ...o,
          preco_base: Number(comMargem.toFixed(2)),
          desconto: Number(desconto.toFixed(2)),
          preco: Number((comMargem - desconto).toFixed(2)),
        };
      })
      .sort((a, b) => a.preco - b.preco);

    await db.from("superfrete_settings")
      .update({ last_ok_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
      .eq("id", cfg.id);

    return json({
      opcoes,
      peso_kg: Number(pesoBruto ?? 0),
      pacote: pedido.package,
      // Serviços que voltaram com erro entram aqui para o painel entender por
      // que uma transportadora não apareceu, em vez de sumir em silêncio.
      indisponiveis: lista.filter((o) => o.erro).map((o) => ({ nome: o.nome, motivo: o.erro })),
    });
  } catch (e) {
    console.error("falha na cotacao:", e);
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
