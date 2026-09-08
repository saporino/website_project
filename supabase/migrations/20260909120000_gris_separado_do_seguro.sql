-- =====================================================================
-- GRIS deixa de ser somado ao seguro na cotação (09/09/2026)
--
-- A tabela cobra TRÊS coisas, não duas:
--   1. frete-peso   — a faixa de peso, por zona de destino
--   2. seguro (ad valorem) — 0,40% sobre o valor da mercadoria
--   3. GRIS         — 0,20% sobre o valor, com mínimo de R$ 3,85
--
-- Seguro e GRIS parecem a mesma coisa e não são: o seguro paga a carga se
-- ela se perder, o GRIS paga a estrutura que evita que se perca (rastreamento,
-- escolta, seleção de motorista). São linhas separadas na fatura da
-- transportadora, e nos pedidos pequenos o GRIS domina — no piso de R$ 3,85
-- ele sozinho é maior que o seguro.
--
-- A função devolvia os dois somados num campo `seguro`, e o checkout mostrava
-- uma linha só. Agora vêm separados, e a tela mostra as três.
-- =====================================================================

drop function if exists public.cotar_frete(uuid, text, numeric, numeric, numeric);

create function public.cotar_frete(
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
  seguro      numeric,   -- ad valorem sobre o valor da mercadoria
  gris        numeric,   -- gerenciamento de risco, com piso
  desconto    numeric,   -- o que a loja banca (só onde a tabela aceita)
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
  v_gris      numeric := 0;
  v_desconto  numeric := 0;
begin
  v_cep := nullif(regexp_replace(coalesce(p_cep, ''), '\D', '', 'g'), '')::integer;
  select * into v_tab from shipping_rate_tables where id = p_table_id and is_active;

  if v_cep is null or not found then
    return query select null::text, null::text, null::text, null::integer,
                        null::numeric, null::numeric, null::numeric, null::numeric,
                        null::numeric, false;
    return;
  end if;

  select * into v_cob from shipping_coverage
   where table_id = p_table_id and v_cep between cep_ini and cep_fim
   order by cep_ini limit 1;

  if not found then
    return query select null::text, null::text, null::text, null::integer,
                        null::numeric, null::numeric, null::numeric, null::numeric,
                        null::numeric, false;
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
      return query select v_cob.zone_code, v_cob.uf, v_cob.city, v_cob.days,
                          null::numeric, null::numeric, null::numeric, null::numeric,
                          null::numeric, false;
      return;
    end if;
    select r.price into v_adicional from shipping_rates r
     where r.table_id = p_table_id and r.zone_code = v_cob.zone_code and r.weight_kg is null;
    v_base := v_base + coalesce(v_adicional, 0) * greatest(p_peso_kg - v_faixa, 0);
  end if;

  -- As duas incidem sobre o VALOR da mercadoria, não sobre o peso. O GRIS tem
  -- piso: num pedido de R$ 100 o percentual daria R$ 0,20, e o piso manda.
  v_seguro := coalesce(p_valor, 0) * v_tab.insurance_pct / 100.0;
  v_gris   := greatest(coalesce(p_valor, 0) * v_tab.gris_pct / 100.0, v_tab.gris_min);

  -- O desconto nunca deixa o frete ficar negativo: no máximo, sai de graça.
  v_desconto := least(coalesce(p_subsidio_kg, 0) * greatest(p_peso_kg, 0),
                      v_base + v_seguro + v_gris);

  return query select v_cob.zone_code, v_cob.uf, v_cob.city, v_cob.days,
                      round(v_base, 2), round(v_seguro, 2), round(v_gris, 2),
                      round(v_desconto, 2),
                      round(v_base + v_seguro + v_gris - v_desconto, 2), true;
end $$;

comment on function public.cotar_frete is
  'Frete detalhado para um CEP e um peso, nas tres partes que a tabela cobra: transporte por faixa de peso, seguro ad valorem e GRIS (com piso). Mais o desconto bancado pela loja, quando a tabela aceita. atendido=false = CEP fora da area, e o checkout oferece os marketplaces.';

revoke all on function public.cotar_frete(uuid, text, numeric, numeric, numeric) from public;
grant execute on function public.cotar_frete(uuid, text, numeric, numeric, numeric) to anon, authenticated, service_role;
