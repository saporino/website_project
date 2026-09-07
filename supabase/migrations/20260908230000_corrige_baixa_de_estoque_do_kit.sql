-- =====================================================================
-- Correção: a baixa de estoque voltou a apontar para a tabela certa
--
-- A migration dos kits reescreveu consume_stock_fifo lendo de `stock_lots`,
-- tabela que não existe. A de verdade é `green_coffee_lots`, com
-- quantity_packages e status. Do jeito que ficou, a próxima venda teria
-- falhado na baixa.
--
-- Aqui o corpo original volta inteiro, e a única adição é a tradução do
-- kit: um kit de 3 vendido tira 3 pacotes do lote do café.
-- =====================================================================

create or replace function public.consume_stock_fifo(
  p_product_id     uuid,
  p_quantity       int,
  p_channel        text default null,
  p_reference_type text default null,
  p_reference_id   uuid default null,
  p_company_id     uuid default null,
  p_movement_type  text default 'venda'
) returns jsonb
language plpgsql security definer set search_path = public
as $$
DECLARE
  v_restante int;
  v_tirar    int;
  v_lote     record;
  v_saidas   jsonb := '[]'::jsonb;
  v_produto  uuid := p_product_id;
  v_qtd      int  := p_quantity;
  v_kit      record;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('consumido', 0, 'sem_lote', 0, 'saidas', v_saidas);
  END IF;

  -- Kit não tem estoque próprio: a baixa acontece no café, multiplicada pelo
  -- tamanho do kit. A tradução fica aqui, dentro da função que todo canal
  -- chama, para que ninguém esqueça de multiplicar num canal novo.
  SELECT kit_of_product_id, kit_quantity INTO v_kit
    FROM public.products WHERE id = p_product_id;
  IF v_kit.kit_of_product_id IS NOT NULL AND coalesce(v_kit.kit_quantity, 0) > 0 THEN
    v_produto := v_kit.kit_of_product_id;
    v_qtd     := p_quantity * v_kit.kit_quantity;
  END IF;

  v_restante := v_qtd;

  FOR v_lote IN
    SELECT id, batch_number, quantity_packages, company_id
      FROM public.green_coffee_lots
     WHERE product_id = v_produto
       AND status = 'active'
       AND coalesce(quantity_packages, 0) > 0
     ORDER BY production_date NULLS LAST, batch_number   -- o mais antigo sai primeiro
     FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;

    v_tirar := LEAST(v_restante, v_lote.quantity_packages);

    UPDATE public.green_coffee_lots
       SET quantity_packages = quantity_packages - v_tirar,
           status = CASE WHEN quantity_packages - v_tirar <= 0 THEN 'consumed' ELSE status END,
           updated_at = now()
     WHERE id = v_lote.id;

    INSERT INTO public.stock_movements
      (product_id, lot_id, batch_number, quantity, movement_type, channel, company_id, reference_type, reference_id)
    VALUES
      (v_produto, v_lote.id, v_lote.batch_number, -v_tirar, p_movement_type, p_channel,
       coalesce(p_company_id, v_lote.company_id), p_reference_type, p_reference_id);

    v_saidas := v_saidas || jsonb_build_object('lote', v_lote.batch_number, 'quantidade', v_tirar);
    v_restante := v_restante - v_tirar;
  END LOOP;

  IF v_restante > 0 THEN
    INSERT INTO public.stock_movements
      (product_id, lot_id, batch_number, quantity, movement_type, channel, company_id,
       reference_type, reference_id, sem_lote, notes)
    VALUES
      (v_produto, NULL, NULL, -v_restante, p_movement_type, p_channel, p_company_id,
       p_reference_type, p_reference_id, true, 'Venda sem lote disponivel: repor estoque');
  END IF;

  RETURN jsonb_build_object(
    'consumido', v_qtd - v_restante,
    'sem_lote',  v_restante,
    'saidas',    v_saidas
  );
END;
$$;

revoke execute on function public.consume_stock_fifo(uuid,int,text,text,uuid,uuid,text) from public, anon;
grant execute on function public.consume_stock_fifo(uuid,int,text,text,uuid,uuid,text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- SKU do produto
-- ---------------------------------------------------------------------
-- Não existia: só havia `barcode` (o EAN). SKU é o código interno, que o kit
-- precisa para se identificar na expedição e no marketplace.
alter table public.products
  add column if not exists sku text;

comment on column public.products.sku is
  'Codigo interno do produto. Diferente de barcode, que e o EAN-13 do varejo.';

-- criar_kits usava products.sku, que não existia. Agora existe; a função é
-- recriada aqui só para ficar registrada depois da coluna.
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
          THEN ' — Fardo ' || trim(to_char(v_qtd * coalesce(nullif(v_base.weight_grams,0),500) / 1000.0, 'FM999D9')) || ' kg'
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
