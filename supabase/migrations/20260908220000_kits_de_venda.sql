-- =====================================================================
-- Kits e fardos (08/09/2026)
--
-- O mesmo café vendido em 1, 2, 3, 4 pacotes e no fardo de 10, com o preço
-- por pacote caindo a cada degrau. Cada degrau é um produto próprio, com
-- SKU e código de barras — é assim que marketplace e supermercado exigem.
--
-- O que NÃO pode acontecer: dois estoques. O kit não tem estoque próprio;
-- ele consome o do café. Um kit de 3 vendido tira 3 pacotes do lote.
-- =====================================================================

alter table public.products
  add column if not exists kit_of_product_id uuid references public.products(id) on delete cascade,
  add column if not exists kit_quantity      integer;

comment on column public.products.kit_of_product_id is
  'Se preenchido, este produto e um kit do produto apontado. Nao tem estoque proprio: consome o do café.';
comment on column public.products.kit_quantity is
  'Quantos pacotes vao dentro do kit. Um kit de 3 baixa 3 unidades do lote.';

create index if not exists products_kit_of_idx on public.products (kit_of_product_id)
  where kit_of_product_id is not null;

-- ---------------------------------------------------------------------
-- A baixa de estoque resolve o kit sozinha
-- ---------------------------------------------------------------------
-- A tradução fica AQUI, dentro da função que todo canal chama, e não em cada
-- lugar que vende. Assim RepCo, loja e reconciliação funcionam sem saber que
-- kit existe — e ninguém esquece de multiplicar num canal novo.
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

  -- Kit: a baixa acontece no café, multiplicada pelo tamanho do kit.
  SELECT kit_of_product_id, kit_quantity INTO v_kit
    FROM public.products WHERE id = p_product_id;
  IF v_kit.kit_of_product_id IS NOT NULL AND coalesce(v_kit.kit_quantity, 0) > 0 THEN
    v_produto := v_kit.kit_of_product_id;
    v_qtd     := p_quantity * v_kit.kit_quantity;
  END IF;

  v_restante := v_qtd;

  FOR v_lote IN
    SELECT id, batch_number, remaining_units
      FROM public.stock_lots
     WHERE product_id = v_produto
       AND remaining_units > 0
     ORDER BY expires_at NULLS LAST, created_at
  LOOP
    EXIT WHEN v_restante <= 0;
    v_tirar := least(v_restante, v_lote.remaining_units);

    UPDATE public.stock_lots
       SET remaining_units = remaining_units - v_tirar
     WHERE id = v_lote.id;

    INSERT INTO public.stock_movements
      (product_id, lot_id, batch_number, quantity, movement_type, channel, company_id, reference_type, reference_id)
    VALUES
      (v_produto, v_lote.id, v_lote.batch_number, -v_tirar, p_movement_type, p_channel,
       p_company_id, p_reference_type, p_reference_id);

    v_saidas := v_saidas || jsonb_build_object('lote', v_lote.batch_number, 'unidades', v_tirar);
    v_restante := v_restante - v_tirar;
  END LOOP;

  -- Sobrou o que nenhum lote cobriu: registra assim mesmo, para o estoque
  -- refletir a venda e o buraco aparecer no relatório.
  IF v_restante > 0 THEN
    INSERT INTO public.stock_movements
      (product_id, lot_id, batch_number, quantity, movement_type, channel, company_id,
       reference_type, reference_id)
    VALUES
      (v_produto, NULL, NULL, -v_restante, p_movement_type, p_channel, p_company_id,
       p_reference_type, p_reference_id);
  END IF;

  RETURN jsonb_build_object(
    'consumido', v_qtd - v_restante,
    'sem_lote',  v_restante,
    'saidas',    v_saidas,
    'produto',   v_produto
  );
END;
$$;

-- ---------------------------------------------------------------------
-- Criar ou atualizar os kits de um café
-- ---------------------------------------------------------------------
-- A trava do R$/kg vive aqui, e não na tela: preço por quilo tem que cair a
-- cada degrau. Foi exatamente esse o erro encontrado num concorrente, onde o
-- kit de 3 x 250 g saía mais caro por quilo que o de 2 x 500 g — o cliente
-- pagava mais e levava menos café.
create or replace function public.criar_kits(
  p_produto_id uuid,
  p_degraus    jsonb   -- [{"quantidade":2,"preco_por_pacote":22.90}, ...]
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
  v_ant_kg := v_base.price / 0.5;

  FOR v_d IN SELECT * FROM jsonb_array_elements(p_degraus) ORDER BY (value->>'quantidade')::int
  LOOP
    v_qtd := (v_d->>'quantidade')::int;
    v_ppp := (v_d->>'preco_por_pacote')::numeric;
    IF v_qtd IS NULL OR v_qtd < 2 THEN RAISE EXCEPTION 'kit precisa de 2 pacotes ou mais'; END IF;
    IF v_ppp IS NULL OR v_ppp <= 0 THEN RAISE EXCEPTION 'preco por pacote invalido no kit de %', v_qtd; END IF;

    v_total := round(v_ppp * v_qtd, 2);
    v_kg    := round(v_total / (v_qtd * 0.5), 2);

    IF v_kg >= v_ant_kg THEN
      RAISE EXCEPTION
        'O kit de % sai a R$ %/kg, e o degrau anterior sai a R$ %/kg. O preco por quilo tem que cair sempre — senao o cliente paga mais e leva menos cafe.',
        v_qtd, to_char(v_kg, 'FM999G990D00'), to_char(v_ant_kg, 'FM999G990D00');
    END IF;
    v_ant_kg := v_kg;

    v_sku := coalesce(nullif(v_base.sku, ''), 'P' || left(replace(p_produto_id::text, '-', ''), 6));
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
          THEN ' — Fardo ' || (v_qtd * 0.5)::text || ' kg'
          ELSE ' — Kit ' || v_qtd || ' × 500 g' END,
        v_base.description, v_total, v_base.category, v_base.image_url, v_base.company_id,
        v_base.product_line, v_base.roast_type, v_base.flavor_notes,
        (v_qtd * 500), true, v_base.sales_channels,
        p_produto_id, v_qtd, v_sku, coalesce(v_base.display_order, 0) + v_qtd
      ) RETURNING id INTO v_id;
    ELSE
      UPDATE public.products SET
        price = v_total,
        weight_grams = v_qtd * 500,
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

comment on function public.criar_kits is
  'Cria ou atualiza os kits de um cafe. Recusa qualquer degrau cujo R$/kg nao seja menor que o do degrau anterior.';

revoke all on function public.criar_kits(uuid, jsonb) from public;
grant execute on function public.criar_kits(uuid, jsonb) to authenticated;
