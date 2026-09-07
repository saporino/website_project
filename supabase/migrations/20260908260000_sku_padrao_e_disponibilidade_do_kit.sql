-- =====================================================================
-- SKU no padrão da casa, e disponibilidade do kit (08/09/2026)
--
-- Padrão definido pelo dono: MARCA(3)-LINHA(3)-GRAMATURA+MOAGEM(4)-VENDA(3)
--   TRP-TRD-500M-U01  1 pacote
--   TRP-TRD-500M-K02  kit com 2
--   TRP-TRD-500M-F01  1 fardo (10 pacotes)
--
-- O sufixo é o que muda: U = unidade, K = kit, F = fardo. O resto vem do
-- produto base, então kits herdam o código da família sozinhos.
--
-- E a regra que faltava: kit não tem estoque próprio, mas TEM
-- disponibilidade. Com 9 pacotes no lote, o fardo de 10 não pode ser
-- vendido — senão a loja vende café que não existe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SKU do degrau, derivado do SKU do produto base
-- ---------------------------------------------------------------------
create or replace function public.kit_sku(p_base_sku text, p_produto_id uuid, p_qtd integer)
returns text
language sql
immutable
as $$
  select
    -- Família: o SKU do avulso sem o último segmento (U01). Sem SKU cadastrado,
    -- cai num código derivado do id, que é feio mas nunca colide.
    coalesce(
      nullif(regexp_replace(coalesce(p_base_sku, ''), '-[A-Z]\d+$', ''), ''),
      'P' || upper(left(replace(p_produto_id::text, '-', ''), 6))
    )
    || '-'
    || case
         -- Fardo é medido em fardos, não em pacotes: 10 pacotes = F01.
         when p_qtd >= 10 and p_qtd % 10 = 0 then 'F' || lpad((p_qtd / 10)::text, 2, '0')
         else 'K' || lpad(p_qtd::text, 2, '0')
       end;
$$;

comment on function public.kit_sku is
  'SKU do degrau no padrao MARCA-LINHA-GRAMATURA-VENDA. F conta fardos (10 pacotes cada), K conta pacotes.';

-- ---------------------------------------------------------------------
-- Quantos kits dá para vender com o estoque que existe
-- ---------------------------------------------------------------------
-- Kit não tem saldo próprio: a disponibilidade vem do café, dividida pelo
-- tamanho do kit. 9 pacotes no lote = nenhum fardo de 10 disponível.
create or replace function public.kit_disponivel(p_produto_id uuid)
returns integer
language sql
stable
as $$
  select case
    when p.kit_of_product_id is null then coalesce(p.stock, 0)
    else floor(coalesce(b.stock, 0)::numeric / greatest(p.kit_quantity, 1))::int
  end
  from public.products p
  left join public.products b on b.id = p.kit_of_product_id
  where p.id = p_produto_id;
$$;

comment on function public.kit_disponivel is
  'Quantas unidades daquele produto da para vender. Para kit, e o estoque do cafe dividido pelo tamanho do kit.';

grant execute on function public.kit_disponivel(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Visão da loja: produto com a disponibilidade já calculada
-- ---------------------------------------------------------------------
-- A loja precisa saber se pode vender ANTES de deixar o cliente pagar, e não
-- pode fazer essa conta no navegador — quem decide é o servidor.
create or replace view public.products_com_disponibilidade as
  select p.*,
         case
           when p.kit_of_product_id is null then coalesce(p.stock, 0)
           else floor(coalesce(b.stock, 0)::numeric / greatest(p.kit_quantity, 1))::int
         end as disponivel,
         b.stock as estoque_do_cafe
    from public.products p
    left join public.products b on b.id = p.kit_of_product_id;

comment on view public.products_com_disponibilidade is
  'Produtos com a coluna `disponivel`: para kit, o estoque do cafe dividido pelo tamanho do kit.';

grant select on public.products_com_disponibilidade to anon, authenticated;

-- ---------------------------------------------------------------------
-- criar_kits passa a usar o padrão de SKU
-- ---------------------------------------------------------------------
create or replace function public.criar_kits(
  p_produto_id uuid,
  p_degraus    jsonb
)
returns table (quantidade integer, sku text, preco numeric, por_pacote numeric, por_kg numeric, criado boolean)
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_base    record;
  v_d       jsonb;
  v_qtd     int;
  v_ppp     numeric;
  v_total   numeric;
  v_kg      numeric;
  v_ant_kg  numeric;
  v_sku     text;
  v_id      uuid;
  v_novo    boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'apenas administrador';
  END IF;

  SELECT * INTO v_base FROM public.products WHERE id = p_produto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'produto nao encontrado'; END IF;
  IF v_base.kit_of_product_id IS NOT NULL THEN
    RAISE EXCEPTION 'nao da para criar kit de um kit';
  END IF;

  -- O avulso é o primeiro degrau: o R$/kg dele é o teto de todos os outros.
  v_ant_kg := v_base.price / (coalesce(nullif(v_base.weight_grams, 0), 500) / 1000.0);

  FOR v_d IN SELECT value FROM jsonb_array_elements(p_degraus) t(value)
             ORDER BY (t.value->>'quantidade')::int
  LOOP
    v_qtd := (v_d->>'quantidade')::int;
    v_ppp := (v_d->>'preco_por_pacote')::numeric;
    IF v_qtd IS NULL OR v_qtd < 2 THEN RAISE EXCEPTION 'kit precisa de 2 pacotes ou mais'; END IF;
    IF v_ppp IS NULL OR v_ppp <= 0 THEN RAISE EXCEPTION 'preco por pacote invalido no kit de %', v_qtd; END IF;

    v_total := round(v_ppp * v_qtd, 2);
    v_kg    := round(v_total / (v_qtd * coalesce(nullif(v_base.weight_grams, 0), 500) / 1000.0), 2);

    IF v_kg >= v_ant_kg THEN
      RAISE EXCEPTION
        'O kit de % sai a R$ %/kg e o degrau anterior sai a R$ %/kg. O preco por quilo tem que cair sempre — senao o cliente paga mais e leva menos cafe.',
        v_qtd, to_char(v_kg, 'FM999G990D00'), to_char(v_ant_kg, 'FM999G990D00');
    END IF;
    v_ant_kg := v_kg;

    v_sku := public.kit_sku(v_base.sku, p_produto_id, v_qtd);

    SELECT id INTO v_id FROM public.products
      WHERE kit_of_product_id = p_produto_id AND kit_quantity = v_qtd;
    v_novo := v_id IS NULL;

    IF v_novo THEN
      INSERT INTO public.products (
        name, description, price, category, image_url, company_id, product_line,
        roast_type, flavor_notes, weight_grams, is_active, sales_channels,
        kit_of_product_id, kit_quantity, sku, display_order
      ) VALUES (
        public.kit_nome(v_base.name, v_qtd, v_base.weight_grams),
        v_base.description, v_total, v_base.category, v_base.image_url, v_base.company_id,
        v_base.product_line, v_base.roast_type, v_base.flavor_notes,
        v_qtd * coalesce(nullif(v_base.weight_grams, 0), 500), true, v_base.sales_channels,
        p_produto_id, v_qtd, v_sku, coalesce(v_base.display_order, 0) + v_qtd
      ) RETURNING id INTO v_id;
    ELSE
      UPDATE public.products SET
        name = public.kit_nome(v_base.name, v_qtd, v_base.weight_grams),
        price = v_total,
        weight_grams = v_qtd * coalesce(nullif(v_base.weight_grams, 0), 500),
        description = v_base.description,
        image_url = v_base.image_url,
        sales_channels = v_base.sales_channels,
        sku = v_sku,
        is_active = true
      WHERE id = v_id;
    END IF;

    RETURN QUERY SELECT v_qtd, v_sku, v_total, v_ppp, v_kg, v_novo;
  END LOOP;
END $$;

revoke all on function public.criar_kits(uuid, jsonb) from public;
grant execute on function public.criar_kits(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- SKU do Tropeiro, no padrão
-- ---------------------------------------------------------------------
update public.products
   set sku = 'TRP-TRD-500M-U01'
 where name = 'Tropeiro Paulista Tradicional'
   and kit_of_product_id is null
   and coalesce(sku, '') = '';

-- Renomeia os SKUs dos kits que já foram criados com o código provisório.
update public.products k
   set sku = public.kit_sku(b.sku, b.id, k.kit_quantity)
  from public.products b
 where k.kit_of_product_id = b.id
   and k.sku is distinct from public.kit_sku(b.sku, b.id, k.kit_quantity);
