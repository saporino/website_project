-- =====================================================================
-- Pedágio e as taxas situacionais da tabela (09/09/2026)
--
-- A tabela cobra QUATRO coisas em toda entrega, não três:
--
--   1. frete-peso  — a faixa de peso, por zona
--   2. seguro      — 0,40% sobre o valor da mercadoria (ad valorem)
--   3. GRIS        — 0,20% sobre o valor, piso de R$ 3,85
--   4. PEDÁGIO     — R$ 6,20 por 100 kg OU FRAÇÃO, por CT-e, em todas as praças
--
-- O pedágio estava faltando. "Ou fração" quer dizer que ele não é
-- proporcional: um pacote de 500 g paga os R$ 6,20 inteiros, igual a 100 kg.
-- Deixá-lo de fora subestimava TODO frete da COFICO em R$ 6,20 — e a diferença
-- saía do nosso bolso.
--
-- Além dessas, a tabela tem taxas que NÃO valem para toda entrega. Elas ficam
-- guardadas aqui porque a hora de descobrir quanto custa uma entrega em
-- shopping não é quando a entrega já está feita:
--
--   TAS  R$ 4,50 por CT-e emitido em envio INTERESTADUAL (Taxa de
--        Administração da Secretaria da Fazenda). Esta dá para decidir
--        sozinha: se a UF do destino é diferente da UF de origem, incide.
--        Por isso é a única situacional que entra automática.
--
--   TDE  30% sobre o frete, MÍNIMO R$ 300,00 — entrega em shopping center.
--        Não dá para adivinhar por CEP que um endereço é loja de shopping.
--
--   TDA  R$ 50,00 por conhecimento — destino com dificuldade de acesso.
--        Depende de cadastro do destino na transportadora.
--
-- TDE e TDA ficam gravadas e NÃO são cobradas automaticamente: um mínimo de
-- R$ 300 aplicado por engano num pedido de R$ 199 destruiria a venda. Quando
-- houver venda para shopping, a cobrança é decisão de quem opera.
--
-- Taxa CT-e: isenta nesta tabela.
-- =====================================================================

alter table public.shipping_rate_tables
  add column if not exists toll_per_100kg numeric(10,2) not null default 0,
  add column if not exists tas_fee        numeric(10,2) not null default 0,
  add column if not exists tde_pct        numeric(6,2)  not null default 0,
  add column if not exists tde_min        numeric(10,2) not null default 0,
  add column if not exists tda_fee        numeric(10,2) not null default 0;

comment on column public.shipping_rate_tables.toll_per_100kg is
  'Pedagio: valor por 100 kg OU FRACAO, por CT-e. Nao e proporcional — qualquer peso abaixo de 100 kg paga uma fracao inteira. Incide em toda entrega.';
comment on column public.shipping_rate_tables.tas_fee is
  'TAS (Taxa de Administracao da Secretaria da Fazenda): por CT-e emitido em envio INTERESTADUAL. Aplicada automaticamente quando a UF do destino difere da UF de origem da tabela.';
comment on column public.shipping_rate_tables.tde_pct is
  'TDE (Dificuldade de Entrega): percentual sobre o frete em entrega de shopping center. NAO e aplicada automaticamente — nao da para deduzir por CEP que o endereco e loja de shopping.';
comment on column public.shipping_rate_tables.tde_min is
  'Piso da TDE, em reais. Guardado junto com o percentual; a cobranca e decisao de quem opera.';
comment on column public.shipping_rate_tables.tda_fee is
  'TDA (Taxa de Dificuldade de Acesso): valor por conhecimento em destino de dificil acesso. NAO e aplicada automaticamente — depende do cadastro do destino na transportadora.';

update public.shipping_rate_tables
   set toll_per_100kg = 6.20,
       tas_fee        = 4.50,
       tde_pct        = 30.00,
       tde_min        = 300.00,
       tda_fee        = 50.00
 where name = 'Tabela de frete COFICO';

-- ---------------------------------------------------------------------
-- Cotação com pedágio e TAS
-- ---------------------------------------------------------------------
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
  pedagio     numeric,   -- por 100 kg ou fracao
  tas         numeric,   -- so em envio interestadual
  desconto    numeric,   -- o que a loja banca (so onde a tabela aceita)
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
  v_pedagio   numeric := 0;
  v_tas       numeric := 0;
  v_desconto  numeric := 0;
  v_total     numeric := 0;
begin
  v_cep := nullif(regexp_replace(coalesce(p_cep, ''), '\D', '', 'g'), '')::integer;
  select * into v_tab from shipping_rate_tables where id = p_table_id and is_active;

  if v_cep is null or not found then
    return query select null::text, null::text, null::text, null::integer,
                        null::numeric, null::numeric, null::numeric, null::numeric,
                        null::numeric, null::numeric, null::numeric, false;
    return;
  end if;

  select * into v_cob from shipping_coverage
   where table_id = p_table_id and v_cep between cep_ini and cep_fim
   order by cep_ini limit 1;

  if not found then
    return query select null::text, null::text, null::text, null::integer,
                        null::numeric, null::numeric, null::numeric, null::numeric,
                        null::numeric, null::numeric, null::numeric, false;
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
                          null::numeric, null::numeric, null::numeric, false;
      return;
    end if;
    select r.price into v_adicional from shipping_rates r
     where r.table_id = p_table_id and r.zone_code = v_cob.zone_code and r.weight_kg is null;
    v_base := v_base + coalesce(v_adicional, 0) * greatest(p_peso_kg - v_faixa, 0);
  end if;

  -- Seguro e GRIS incidem sobre o VALOR da mercadoria, não sobre o peso. O
  -- GRIS tem piso: num pedido de R$ 100 o percentual daria R$ 0,20, e o piso
  -- é que manda.
  v_seguro := coalesce(p_valor, 0) * v_tab.insurance_pct / 100.0;
  v_gris   := greatest(coalesce(p_valor, 0) * v_tab.gris_pct / 100.0, v_tab.gris_min);

  -- Pedágio por 100 kg OU FRAÇÃO: sempre pelo menos uma fração, mesmo em
  -- 500 g. Arredondar para cima é a regra da tabela, não um exagero nosso.
  if v_tab.toll_per_100kg > 0 then
    v_pedagio := v_tab.toll_per_100kg * greatest(ceil(greatest(p_peso_kg, 0) / 100.0), 1);
  end if;

  -- TAS: só quando o CT-e cruza a fronteira do estado de origem. Sem UF de
  -- origem cadastrada não dá para afirmar que é interestadual — e cobrar por
  -- suposição é pior que não cobrar.
  if v_tab.tas_fee > 0 and v_tab.origin_uf is not null
     and v_cob.uf is not null and v_cob.uf <> v_tab.origin_uf then
    v_tas := v_tab.tas_fee;
  end if;

  v_total := v_base + v_seguro + v_gris + v_pedagio + v_tas;

  -- O desconto nunca deixa o frete ficar negativo: no máximo, sai de graça.
  v_desconto := least(coalesce(p_subsidio_kg, 0) * greatest(p_peso_kg, 0), v_total);

  return query select v_cob.zone_code, v_cob.uf, v_cob.city, v_cob.days,
                      round(v_base, 2), round(v_seguro, 2), round(v_gris, 2),
                      round(v_pedagio, 2), round(v_tas, 2), round(v_desconto, 2),
                      round(v_total - v_desconto, 2), true;
end $$;

comment on function public.cotar_frete is
  'Frete detalhado da tabela COFICO: transporte por faixa de peso, seguro ad valorem, GRIS (com piso), pedagio (por 100 kg ou fracao) e TAS (so interestadual). Menos o desconto bancado pela loja, quando a tabela aceita. TDE (shopping) e TDA (dificil acesso) ficam cadastradas mas NAO entram automaticamente. atendido=false = CEP fora da area.';

revoke all on function public.cotar_frete(uuid, text, numeric, numeric, numeric) from public;
grant execute on function public.cotar_frete(uuid, text, numeric, numeric, numeric) to anon, authenticated, service_role;
