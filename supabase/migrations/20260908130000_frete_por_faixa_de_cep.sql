-- =====================================================================
-- Frete por faixa de CEP (08/09/2026)
--
-- Até aqui o frete era um número fixo por transportadora — e estava zerado,
-- então toda venda saía com frete grátis. Frete de verdade depende de PARA
-- ONDE vai: São Paulo capital e o interior do Maranhão não custam igual.
--
-- A base é a tabela comercial fracionada que a operação já usava: faixas de
-- peso (10, 20, 30, 50, 70, 100 kg) cruzadas com zonas comerciais (SPC, SP1,
-- MAB...), mais a lista de faixas de CEP que diz em que zona cada endereço
-- do país cai.
--
-- Esta tabela passa a ser a TABELA DE FRETE DA COFICO, que é a transportadora
-- própria. Não é da Total Express: serve de referência inicial, e será
-- ajustada quando as tabelas reais das outras chegarem.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A tabela de preços em si
-- ---------------------------------------------------------------------
create table if not exists public.shipping_rate_tables (
  id             uuid primary key default gen_random_uuid(),
  carrier_id     uuid references public.shipping_carriers(id) on delete cascade,
  name           text not null,
  origin_uf      text,
  -- Taxas que incidem sobre o VALOR da mercadoria, não sobre o peso.
  insurance_pct  numeric(6,4) not null default 0,
  gris_pct       numeric(6,4) not null default 0,
  gris_min       numeric(10,2) not null default 0,
  -- Acima disto o pedido não é aceito no checkout: a tabela não cobre.
  max_weight_kg  numeric(10,3),
  notes          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

comment on table public.shipping_rate_tables is
  'Tabela de precos de frete de uma transportadora. Referencia inicial da COFICO veio de uma tabela comercial fracionada com origem em SP.';

-- ---------------------------------------------------------------------
-- Preço por zona e faixa de peso
-- ---------------------------------------------------------------------
-- A tabela cobra por FAIXA, não proporcional: até 10 kg paga o valor de 10 kg.
-- Como o pacote de café tem 500 g, praticamente toda venda ao consumidor cai
-- na primeira faixa — o preço varia por destino, não por peso.
create table if not exists public.shipping_rates (
  id            uuid primary key default gen_random_uuid(),
  table_id      uuid not null references public.shipping_rate_tables(id) on delete cascade,
  zone_code     text not null,
  -- Peso máximo da faixa. Nulo = linha "ADICIONAL": preço por quilo acima da
  -- última faixa.
  weight_kg     numeric(10,3),
  price         numeric(10,2) not null,
  unique (table_id, zone_code, weight_kg)
);

create index if not exists shipping_rates_lookup on public.shipping_rates (table_id, zone_code, weight_kg);

-- ---------------------------------------------------------------------
-- Que CEP pertence a que zona
-- ---------------------------------------------------------------------
-- O CEP entra como número inteiro (sem hífen) para a busca por faixa ser
-- direta. `days` é o prazo prometido pela transportadora — o site nunca
-- mostrou prazo, e é a segunda pergunta de quem compra, logo depois do preço.
create table if not exists public.shipping_coverage (
  id          bigserial primary key,
  table_id    uuid not null references public.shipping_rate_tables(id) on delete cascade,
  cep_ini     integer not null,
  cep_fim     integer not null,
  uf          text,
  city        text,
  zone_code   text not null,
  days        integer
);

create index if not exists shipping_coverage_faixa on public.shipping_coverage (table_id, cep_ini, cep_fim);

comment on table public.shipping_coverage is
  'Faixas de CEP atendidas e a zona comercial de cada uma. CEP fora de todas as faixas = destino nao atendido: o checkout oferece os marketplaces em vez de inventar um preco.';

-- ---------------------------------------------------------------------
-- Lojas de marketplace, para quem está fora da área de entrega
-- ---------------------------------------------------------------------
-- Cliente de um CEP não atendido não pode simplesmente levar "não entregamos
-- aí". Ele quer o café. Então o site oferece onde comprar — as nossas próprias
-- lojas nos marketplaces, que têm cobertura nacional.
create table if not exists public.marketplace_stores (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name       text not null,
  url        text not null,
  logo_url   text,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.marketplace_stores is
  'Nossas lojas em marketplaces. Aparecem no checkout quando o CEP nao e atendido pela entrega propria.';

-- ---------------------------------------------------------------------
-- Leitura pública, escrita só do administrador
-- ---------------------------------------------------------------------
-- O checkout é público e precisa cotar frete antes de a pessoa ter conta.
alter table public.shipping_rate_tables enable row level security;
alter table public.shipping_rates        enable row level security;
alter table public.shipping_coverage     enable row level security;
alter table public.marketplace_stores    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['shipping_rate_tables','shipping_rates','shipping_coverage','marketplace_stores'] loop
    execute format('drop policy if exists %I_leitura on public.%I', t, t);
    execute format('create policy %I_leitura on public.%I for select to anon, authenticated using (true)', t, t);
    execute format('drop policy if exists %I_admin on public.%I', t, t);
    execute format('create policy %I_admin on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Cotação: dado um CEP e um peso, quanto custa e em quantos dias
-- ---------------------------------------------------------------------
-- Fica no banco, e não no navegador, porque preço é autoridade do servidor:
-- o checkout confere o valor antes de cobrar.
create or replace function public.cotar_frete(
  p_table_id uuid,
  p_cep      text,
  p_peso_kg  numeric,
  p_valor    numeric default 0
)
returns table (zona text, uf text, cidade text, dias integer, preco numeric, atendido boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cep      integer;
  v_cob      record;
  v_faixa    numeric;
  v_base     numeric;
  v_adicional numeric;
  v_tab      record;
  v_extras   numeric := 0;
begin
  v_cep := nullif(regexp_replace(coalesce(p_cep, ''), '\D', '', 'g'), '')::integer;
  if v_cep is null then
    return query select null::text, null::text, null::text, null::integer, null::numeric, false;
    return;
  end if;

  select * into v_tab from shipping_rate_tables where id = p_table_id and is_active;
  if not found then
    return query select null::text, null::text, null::text, null::integer, null::numeric, false;
    return;
  end if;

  -- Primeira faixa de CEP que contém o endereço.
  select * into v_cob from shipping_coverage
   where table_id = p_table_id and v_cep between cep_ini and cep_fim
   order by cep_ini limit 1;

  if not found then
    return query select null::text, null::text, null::text, null::integer, null::numeric, false;
    return;
  end if;

  -- Menor faixa de peso que comporta o pedido. Cobrança por faixa: 1 kg paga
  -- o valor de 10 kg, porque é assim que a transportadora cobra.
  select r.weight_kg, r.price into v_faixa, v_base
    from shipping_rates r
   where r.table_id = p_table_id and r.zone_code = v_cob.zone_code
     and r.weight_kg is not null and r.weight_kg >= greatest(p_peso_kg, 0)
   order by r.weight_kg limit 1;

  -- Acima da última faixa, cobra a última faixa mais o adicional por quilo.
  if v_base is null then
    select r.weight_kg, r.price into v_faixa, v_base
      from shipping_rates r
     where r.table_id = p_table_id and r.zone_code = v_cob.zone_code and r.weight_kg is not null
     order by r.weight_kg desc limit 1;
    if v_base is null then
      return query select v_cob.zone_code, v_cob.uf, v_cob.city, v_cob.days, null::numeric, false;
      return;
    end if;
    select r.price into v_adicional from shipping_rates r
     where r.table_id = p_table_id and r.zone_code = v_cob.zone_code and r.weight_kg is null;
    v_base := v_base + coalesce(v_adicional, 0) * greatest(p_peso_kg - v_faixa, 0);
  end if;

  -- Seguro e GRIS incidem sobre o valor da mercadoria, não sobre o peso.
  v_extras := coalesce(p_valor, 0) * (v_tab.insurance_pct + v_tab.gris_pct) / 100.0;
  if v_tab.gris_min > 0 then
    v_extras := greatest(v_extras, coalesce(p_valor,0) * v_tab.insurance_pct / 100.0 + v_tab.gris_min);
  end if;

  return query select v_cob.zone_code, v_cob.uf, v_cob.city, v_cob.days,
                      round(v_base + v_extras, 2), true;
end $$;

comment on function public.cotar_frete is
  'Preco e prazo do frete para um CEP e um peso. atendido=false significa CEP fora da area: o checkout deve oferecer os marketplaces.';

revoke all on function public.cotar_frete(uuid, text, numeric, numeric) from public;
grant execute on function public.cotar_frete(uuid, text, numeric, numeric) to anon, authenticated, service_role;
