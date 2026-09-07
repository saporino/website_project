-- Nome do fardo saía como "Fardo 5. kg": to_char com FM999D9 deixa o separador
-- decimal sozinho quando não há casa. Agora o número é formatado e a casa
-- decimal só aparece quando existe — "Fardo 5 kg", "Fardo 2,5 kg".
create or replace function public.kit_peso_texto(p_gramas numeric)
returns text
language sql
immutable
as $$
  select replace(
           rtrim(rtrim((p_gramas / 1000.0)::numeric(10,1)::text, '0'), '.'),
           '.', ','
         );
$$;

comment on function public.kit_peso_texto is
  'Peso em kg para o nome do produto, sem casa decimal inutil: 5000 g vira "5", 2500 g vira "2,5".';


-- criar_kits recriada usando o helper acima.
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

    v_sku := coalesce(nullif(v_base.sku, ''), 'P' || upper(left(replace(p_produto_id::text, '-', ''), 6)));
    v_sku := CASE WHEN v_qtd >= 10 THEN 'FARDO-' ELSE 'KIT-' END || v_sku || '-' || v_qtd;

    SELECT id INTO v_id FROM public.products
      WHERE kit_of_product_id = p_produto_id AND kit_quantity = v_qtd;
    v_novo := v_id IS NULL;

    IF v_novo THEN
      INSERT INTO public.products (
        name, description, price, category, image_url, company_id, product_line,
        roast_type, flavor_notes, weight_grams, is_active, sales_channels,
        kit_of_product_id, kit_quantity, sku, display_order
      ) VALUES (
        v_base.name || CASE WHEN v_qtd >= 10
          THEN ' — Fardo ' || public.kit_peso_texto(v_qtd * coalesce(nullif(v_base.weight_grams,0),500)) || ' kg'
          ELSE ' — Kit ' || v_qtd || ' × ' || coalesce(nullif(v_base.weight_grams,0),500) || ' g' END,
        v_base.description, v_total, v_base.category, v_base.image_url, v_base.company_id,
        v_base.product_line, v_base.roast_type, v_base.flavor_notes,
        v_qtd * coalesce(nullif(v_base.weight_grams, 0), 500), true, v_base.sales_channels,
        p_produto_id, v_qtd, v_sku, coalesce(v_base.display_order, 0) + v_qtd
      ) RETURNING id INTO v_id;
    ELSE
      UPDATE public.products SET
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
