-- PREÇO POR CANAL — o desconto da Saporino estava aparecendo na COFICO.
--
-- O problema, em uma frase: `products.price` e `products.promotional_price` são
-- UM preço só, e quatro canais liam dele. Montar "2 pacotes por R$ 22,90" para a
-- loja da Saporino fazia o site da COFICO mostrar o mesmo desconto, sem ninguém
-- pedir. Canal diferente tem custo, margem e concorrência diferentes.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE ESTA MIGRATION *NÃO* FAZ
--
-- Ela NÃO copia, NÃO move e NÃO altera nenhum preço. A tabela nasce VAZIA.
-- Nenhum produto muda de preço no instante em que isto roda — esse é o requisito
-- mais importante, e a forma de garanti-lo é não escrever nada.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O RECORTE: TRÊS CANAIS AQUI, NÃO QUATRO
--
--   saporino      → loja B2C (cafesaporino.com.br)
--   cofico        → site da COFICO (coficobrasil.com.br)
--   marketplaces  → CASA COFICO (ML, Shopee, Amazon, TikTok)
--
-- O RepCo fica DE FORA de propósito. Ele já tem `price_lists`, com preço por
-- SEGMENTO (distribuidora, padaria, varejo) e desconto por volume — mais rico do
-- que esta tabela e já em produção. Repetir o RepCo aqui criaria duas fontes de
-- verdade para o mesmo canal, que é exatamente o defeito que esta migration
-- existe para corrigir.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- A REGRA DE RESOLUÇÃO (ver a função `preco_do_canal`)
--
--   saporino:  linha no canal → senão, `products.price` / `promotional_price`
--   cofico:    linha no canal → senão, PREÇO NÃO DEFINIDO
--   marketplaces: idem
--
-- A assimetria é intencional e é o coração disto. O fallback existe só para a
-- Saporino porque é lá que os preços de hoje vivem: sem ele, esta migration
-- apagaria a loja. Para COFICO e marketplaces NÃO HÁ fallback — herdar o preço
-- da Saporino é precisamente o defeito. Sem linha, o produto não tem preço
-- naquele canal, e quem for vender tem de recusar a venda, não adivinhar.
--
-- Kits entram sozinhos: um kit é um produto com `id` próprio, então "Kit 2 ×
-- 500 g" tem a sua linha, separada da do café avulso.

create table if not exists public.product_channel_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  channel text not null check (channel in ('saporino', 'cofico', 'marketplaces')),

  price numeric(10,2) not null check (price > 0),
  -- Promoção do canal. NULL = sem promoção neste canal — e é diferente de zero:
  -- zero seria "de graça", e o banco recusa.
  promotional_price numeric(10,2) check (promotional_price is null or promotional_price > 0),

  -- Desligar o preço sem apagá-lo: o canal volta a não ter preço definido, e o
  -- valor fica guardado para quando religar.
  is_active boolean not null default true,

  -- Cópia do dono do produto, para a RLS conseguir decidir sem um join a cada
  -- linha. Mantida pelo gatilho abaixo — ninguém escreve isto à mão.
  company_id uuid references public.companies(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Um preço por produto por canal. Sem isto, duas linhas para o mesmo par
  -- fariam o preço cobrado depender da ordem de leitura.
  unique (product_id, channel),

  -- Promoção que não é menor que o preço não é promoção. Deixar passar faria a
  -- loja desenhar "−0%" ou, pior, um desconto negativo.
  constraint promo_menor_que_preco
    check (promotional_price is null or promotional_price < price)
);

comment on table public.product_channel_prices is
  'Preço e promoção POR CANAL de venda. Vazia = cada canal usa a regra de preco_do_canal(). O RepCo não usa esta tabela: ele tem price_lists (preço por segmento).';

create index if not exists pcp_produto_idx on public.product_channel_prices (product_id);
create index if not exists pcp_canal_idx on public.product_channel_prices (channel) where is_active;

-- ── company_id e updated_at são do banco, não de quem escreve ────────────────
-- O dono do preço é o dono do produto, sempre. Deixar o cliente mandar
-- `company_id` abriria a porta para gravar o preço de um café da COFICO
-- marcado como se fosse da Saporino, e a RLS passaria a proteger a empresa
-- errada.
create or replace function public.pcp_preencher_dono()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select p.company_id into new.company_id from public.products p where p.id = new.product_id;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists pcp_preencher_dono_trg on public.product_channel_prices;
create trigger pcp_preencher_dono_trg
  before insert or update on public.product_channel_prices
  for each row execute function public.pcp_preencher_dono();

-- ── a regra de resolução, no banco ───────────────────────────────────────────
-- Mora aqui, e não no app, porque quem cobra é o servidor. Se a regra vivesse só
-- no React, bastaria uma chamada de API fora da tela para cobrar outro preço.
create or replace function public.preco_do_canal(p_product_id uuid, p_canal text)
returns table (
  price numeric,
  promotional_price numeric,
  preco_final numeric,
  em_promocao boolean,
  definido boolean,   -- false = este canal não tem preço; NÃO VENDER
  fonte text          -- 'canal' | 'produto' | 'indefinido'
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_canal record;
  v_prod  record;
begin
  select pcp.price, pcp.promotional_price into v_canal
    from public.product_channel_prices pcp
   where pcp.product_id = p_product_id and pcp.channel = p_canal and pcp.is_active;

  if found then
    return query select
      v_canal.price,
      v_canal.promotional_price,
      coalesce(v_canal.promotional_price, v_canal.price),
      v_canal.promotional_price is not null,
      true,
      'canal'::text;
    return;
  end if;

  -- Só a Saporino herda do produto. Ver o cabeçalho: é onde os preços de hoje
  -- vivem, e é o único canal onde herdar não é vazamento.
  if p_canal = 'saporino' then
    select p.price, p.promotional_price into v_prod
      from public.products p where p.id = p_product_id;
    if found and v_prod.price is not null and v_prod.price > 0 then
      return query select
        v_prod.price,
        case when coalesce(v_prod.promotional_price, 0) > 0 and v_prod.promotional_price < v_prod.price
             then v_prod.promotional_price else null end,
        case when coalesce(v_prod.promotional_price, 0) > 0 and v_prod.promotional_price < v_prod.price
             then v_prod.promotional_price else v_prod.price end,
        coalesce(v_prod.promotional_price, 0) > 0 and v_prod.promotional_price < v_prod.price,
        true,
        'produto'::text;
      return;
    end if;
  end if;

  -- Sem preço neste canal. Devolve a linha mesmo assim, com `definido = false`:
  -- quem chamar tem de ver a resposta e recusar a venda, não receber zero linhas
  -- e tratar como se o produto não existisse.
  return query select null::numeric, null::numeric, null::numeric, false, false, 'indefinido'::text;
end $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.product_channel_prices enable row level security;

-- O público lê SOMENTE o canal da loja B2C — é o único preço que já é público
-- hoje (está na vitrine da Saporino). Preço de COFICO e de marketplace é
-- condição comercial: fica com quem está autenticado e tem papel.
drop policy if exists "Publico le preco da loja" on public.product_channel_prices;
create policy "Publico le preco da loja" on public.product_channel_prices
  for select to anon, authenticated
  using (channel = 'saporino' and is_active);

drop policy if exists "Admin gere precos por canal" on public.product_channel_prices;
create policy "Admin gere precos por canal" on public.product_channel_prices
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── visão de conferência ─────────────────────────────────────────────────────
-- Serve à bancada e ao admin: mostra, para cada produto e cada canal, qual preço
-- vale e DE ONDE ele veio. É o que torna possível provar que nada mudou.
create or replace view public.vw_precos_por_canal as
select
  p.id as product_id,
  p.name,
  p.company_id,
  p.kit_of_product_id is not null as e_kit,
  c.canal,
  r.price,
  r.promotional_price,
  r.preco_final,
  r.em_promocao,
  r.definido,
  r.fonte
from public.products p
cross join (values ('saporino'), ('cofico'), ('marketplaces')) as c(canal)
cross join lateral public.preco_do_canal(p.id, c.canal) r;

comment on view public.vw_precos_por_canal is
  'Preço que vale em cada canal, e de onde ele veio (canal / produto / indefinido). Usada para conferir que uma mudança não mexeu em canal nenhum.';
