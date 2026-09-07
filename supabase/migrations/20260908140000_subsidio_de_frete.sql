-- =====================================================================
-- Subsídio de frete e cotação detalhada (08/09/2026)
--
-- A empresa banca uma parte do frete — hoje R$ 1,50 por quilo, igual para
-- B2B e B2C. Para o cliente isso aparece só como "Desconto de envio": ele
-- não precisa saber de onde vem.
--
-- O efeito é o que interessa: como a transportadora cobra por FAIXA (até
-- 10 kg custa o mesmo), quem leva mais dilui o frete e ainda soma mais
-- desconto. Um pacote de 500 g ganha R$ 0,75 de desconto; um fardo de 5 kg
-- ganha R$ 7,50, sobre o mesmo frete. É o que faz o kit valer a pena.
-- =====================================================================

alter table public.companies
  add column if not exists shipping_subsidy_per_kg numeric(10,2) not null default 0;

comment on column public.companies.shipping_subsidy_per_kg is
  'Quanto a empresa banca do frete, por quilo. Aparece ao cliente como "Desconto de envio". Nunca deixa o frete ficar negativo.';

update public.companies set shipping_subsidy_per_kg = 1.50 where order_prefix in ('CS','CO');

-- ---------------------------------------------------------------------
-- Cotação detalhada
-- ---------------------------------------------------------------------
-- O checkout passa a mostrar as partes separadas, porque frete que aparece
-- como um número só parece caro. Separado, o cliente vê o que é transporte,
-- o que é seguro obrigatório, e quanto a loja está bancando.
drop function if exists public.cotar_frete(uuid, text, numeric, numeric);

create or replace function public.cotar_frete(
  p_table_id  uuid,
  p_cep       text,
  p_peso_kg   numeric,
  p_valor     numeric default 0,
  p_subsidio_kg numeric default 0
)
returns table (
  zona        text,
  uf          text,
  cidade      text,
  dias        integer,
  transporte  numeric,   -- a faixa de peso da transportadora
  seguro      numeric,   -- percentual sobre o valor da mercadoria
  desconto    numeric,   -- o que a loja banca (subsídio por quilo)
  preco       numeric,   -- o que o cliente paga
  atendido    boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cep       integer;
  v_cob       record;
  v_tab       record;
  v_faixa     numeric;
  v_base      numeric;
  v_adicional numeric;
  v_seguro    numeric := 0;
  v_desconto  numeric := 0;
begin
  v_cep := nullif(regexp_replace(coalesce(p_cep, ''), '\D', '', 'g'), '')::integer;
  select * into v_tab from shipping_rate_tables where id = p_table_id and is_active;

  if v_cep is null or not found then
    return query select null::text, null::text, null::text, null::integer,
                        null::numeric, null::numeric, null::numeric, null::numeric, false;
    return;
  end if;

  select * into v_cob from shipping_coverage
   where table_id = p_table_id and v_cep between cep_ini and cep_fim
   order by cep_ini limit 1;

  if not found then
    return query select null::text, null::text, null::text, null::integer,
                        null::numeric, null::numeric, null::numeric, null::numeric, false;
    return;
  end if;

  -- Menor faixa que comporta o peso. Abaixo da primeira faixa paga a primeira:
  -- é assim que a transportadora cobra, e é o que dilui o frete de quem leva mais.
  select r.weight_kg, r.price into v_faixa, v_base
    from shipping_rates r
   where r.table_id = p_table_id and r.zone_code = v_cob.zone_code
     and r.weight_kg is not null and r.weight_kg >= greatest(p_peso_kg, 0)
   order by r.weight_kg limit 1;

  if v_base is null then
    select r.weight_kg, r.price into v_faixa, v_base
      from shipping_rates r
     where r.table_id = p_table_id and r.zone_code = v_cob.zone_code and r.weight_kg is not null
     order by r.weight_kg desc limit 1;
    if v_base is null then
      return query select v_cob.zone_code, v_cob.uf, v_cob.city, v_cob.days,
                          null::numeric, null::numeric, null::numeric, null::numeric, false;
      return;
    end if;
    select r.price into v_adicional from shipping_rates r
     where r.table_id = p_table_id and r.zone_code = v_cob.zone_code and r.weight_kg is null;
    v_base := v_base + coalesce(v_adicional, 0) * greatest(p_peso_kg - v_faixa, 0);
  end if;

  -- Seguro + GRIS: percentuais sobre o valor da mercadoria, com mínimo de GRIS.
  v_seguro := coalesce(p_valor, 0) * v_tab.insurance_pct / 100.0
            + greatest(coalesce(p_valor, 0) * v_tab.gris_pct / 100.0, v_tab.gris_min);

  -- O subsídio nunca passa do frete: desconto não vira dinheiro de volta.
  v_desconto := least(greatest(coalesce(p_subsidio_kg, 0), 0) * greatest(p_peso_kg, 0),
                      v_base + v_seguro);

  return query select v_cob.zone_code, v_cob.uf, v_cob.city, v_cob.days,
                      round(v_base, 2), round(v_seguro, 2), round(v_desconto, 2),
                      round(v_base + v_seguro - v_desconto, 2), true;
end $$;

comment on function public.cotar_frete is
  'Frete detalhado para um CEP e um peso: transporte, seguro, desconto bancado pela loja e o total. atendido=false = CEP fora da area, e o checkout oferece os marketplaces.';

revoke all on function public.cotar_frete(uuid, text, numeric, numeric, numeric) from public;
grant execute on function public.cotar_frete(uuid, text, numeric, numeric, numeric) to anon, authenticated, service_role;
