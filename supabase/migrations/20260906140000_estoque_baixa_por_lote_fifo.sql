-- =====================================================================
-- Estoque único, com a venda saindo do LOTE (06/09/2026)
--
-- Regra do Vlademir: o lote mais antigo vende até o último pacote; quando acaba,
-- o seguinte entra em linha automaticamente. Vale para TODOS os canais — loja da
-- Saporino, B2B pelo site, representantes do portal RepCo e afiliados nas
-- plataformas. O inventário é UM só.
--
-- O QUE ESTAVA ERRADO
-- 1. Venda no site não descontava nada. Nem um pacote.
-- 2. Venda do representante descontava de `products.stock`, mas não do lote.
--    Como `products.stock` é RECALCULADO somando os lotes ativos toda vez que
--    alguém mexe em qualquer lote, esse desconto era apagado e o estoque subia
--    sozinho. Prova real no banco hoje: lote 750-001 com 1500 pacotes e o produto
--    marcando 1376 — 124 já vendidos que sumiriam no próximo recálculo.
--
-- A CORREÇÃO
-- A venda passa a sair do lote. Com isso o recálculo existente deixa de destruir
-- o dado e passa a estar certo: somar os lotes vira a verdade, porque os lotes
-- encolhem de verdade.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Livro-razão do estoque
-- ---------------------------------------------------------------------
-- Cada linha é um movimento real: saiu tanto, deste lote, por este canal, por
-- causa deste pedido. É daqui que sai o "de qual lote saiu e para onde foi".
create table if not exists public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  lot_id         uuid references public.green_coffee_lots(id) on delete set null,
  batch_number   text,                       -- copiado: sobrevive se o lote for apagado
  quantity       int  not null,              -- negativo = saída, positivo = entrada
  movement_type  text not null check (movement_type in ('venda','devolucao','ajuste','producao','perda')),
  channel        text check (channel in ('saporino','repco','cofico','marketplaces','ajuste')),
  company_id     uuid references public.companies(id),
  reference_type text,                       -- representative_order | order | manual
  reference_id   uuid,
  sem_lote       boolean not null default false,  -- venda sem lote disponível
  notes          text,
  created_by     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now()
);

create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index if not exists stock_movements_lot_idx     on public.stock_movements (lot_id);
create index if not exists stock_movements_ref_idx     on public.stock_movements (reference_type, reference_id);

alter table public.stock_movements enable row level security;

drop policy if exists sm_admin_all on public.stock_movements;
create policy sm_admin_all on public.stock_movements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- O representante enxerga o movimento dos próprios pedidos.
drop policy if exists sm_rep_own on public.stock_movements;
create policy sm_rep_own on public.stock_movements
  for select to authenticated using (
    reference_type = 'representative_order'
    and exists (
      select 1 from public.representative_orders o
       where o.id = stock_movements.reference_id
         and o.representative_id = public.my_rep_id()
    )
  );

comment on table public.stock_movements is
  'Livro-razao do estoque: cada saida e entrada, com lote, canal e pedido de origem. Fonte do relatorio "de qual lote saiu e para onde foi".';

-- ---------------------------------------------------------------------
-- Consumo FIFO
-- ---------------------------------------------------------------------
-- Percorre os lotes ATIVOS do produto, do mais antigo para o mais novo, tirando
-- o que couber de cada um até completar a quantidade.
--
-- Se o estoque não cobrir tudo, o que falta NÃO é descartado: vira um movimento
-- marcado `sem_lote`. Perder o registro de uma venda porque o estoque estava
-- errado é pior do que registrar que faltou lote.
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
  v_restante int := p_quantity;
  v_tirar    int;
  v_lote     record;
  v_saidas   jsonb := '[]'::jsonb;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('consumido', 0, 'sem_lote', 0, 'saidas', v_saidas);
  END IF;

  FOR v_lote IN
    SELECT id, batch_number, quantity_packages, company_id
      FROM public.green_coffee_lots
     WHERE product_id = p_product_id
       AND status = 'active'
       AND coalesce(quantity_packages, 0) > 0
     ORDER BY production_date NULLS LAST, batch_number   -- o mais antigo sai primeiro
     FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;

    v_tirar := LEAST(v_restante, v_lote.quantity_packages);

    UPDATE public.green_coffee_lots
       SET quantity_packages = quantity_packages - v_tirar,
           -- lote zerado sai de linha; o proximo assume sozinho na proxima venda
           status = CASE WHEN quantity_packages - v_tirar <= 0 THEN 'consumed' ELSE status END,
           updated_at = now()
     WHERE id = v_lote.id;

    INSERT INTO public.stock_movements
      (product_id, lot_id, batch_number, quantity, movement_type, channel, company_id, reference_type, reference_id)
    VALUES
      (p_product_id, v_lote.id, v_lote.batch_number, -v_tirar, p_movement_type, p_channel,
       coalesce(p_company_id, v_lote.company_id), p_reference_type, p_reference_id);

    v_saidas := v_saidas || jsonb_build_object('lote', v_lote.batch_number, 'quantidade', v_tirar);
    v_restante := v_restante - v_tirar;
  END LOOP;

  IF v_restante > 0 THEN
    INSERT INTO public.stock_movements
      (product_id, lot_id, batch_number, quantity, movement_type, channel, company_id,
       reference_type, reference_id, sem_lote, notes)
    VALUES
      (p_product_id, NULL, NULL, -v_restante, p_movement_type, p_channel, p_company_id,
       p_reference_type, p_reference_id, true, 'Venda sem lote disponivel: repor estoque');
  END IF;

  RETURN jsonb_build_object(
    'consumido', p_quantity - v_restante,
    'sem_lote',  v_restante,
    'saidas',    v_saidas
  );
END;
$$;

revoke execute on function public.consume_stock_fifo(uuid,int,text,text,uuid,uuid,text) from public, anon;
grant execute on function public.consume_stock_fifo(uuid,int,text,text,uuid,uuid,text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Devolução: desfaz exatamente o que aquele pedido consumiu
-- ---------------------------------------------------------------------
create or replace function public.return_stock_by_reference(
  p_reference_type text,
  p_reference_id   uuid,
  p_notes          text default 'Cancelamento'
) returns jsonb
language plpgsql security definer set search_path = public
as $$
DECLARE
  v_mov     record;
  v_total   int := 0;
BEGIN
  FOR v_mov IN
    SELECT * FROM public.stock_movements
     WHERE reference_type = p_reference_type
       AND reference_id = p_reference_id
       AND movement_type = 'venda'
       AND quantity < 0
  LOOP
    IF v_mov.lot_id IS NOT NULL THEN
      UPDATE public.green_coffee_lots
         SET quantity_packages = coalesce(quantity_packages, 0) + abs(v_mov.quantity),
             status = CASE WHEN status = 'consumed' THEN 'active' ELSE status END,
             updated_at = now()
       WHERE id = v_mov.lot_id;
    END IF;

    INSERT INTO public.stock_movements
      (product_id, lot_id, batch_number, quantity, movement_type, channel, company_id,
       reference_type, reference_id, notes)
    VALUES
      (v_mov.product_id, v_mov.lot_id, v_mov.batch_number, abs(v_mov.quantity), 'devolucao',
       v_mov.channel, v_mov.company_id, p_reference_type, p_reference_id, p_notes);

    v_total := v_total + abs(v_mov.quantity);
  END LOOP;

  RETURN jsonb_build_object('devolvido', v_total);
END;
$$;

revoke execute on function public.return_stock_by_reference(text,uuid,text) from public, anon;
grant execute on function public.return_stock_by_reference(text,uuid,text) to authenticated, service_role;
