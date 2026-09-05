-- =====================================================================
-- Todos os canais consomem o MESMO estoque, e os alertas (06/09/2026)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Canal RepCo: representante lança pedido
-- ---------------------------------------------------------------------
-- Antes descontava de products.stock e o recálculo apagava. Agora sai do lote.
create or replace function public.repco_apply_stock_on_item()
returns trigger
language plpgsql security definer set search_path = public
as $$
DECLARE
  v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.representative_orders WHERE id = NEW.order_id;

  PERFORM public.consume_stock_fifo(
    NEW.product_id, NEW.quantity, 'repco', 'representative_order', NEW.order_id, v_company, 'venda'
  );

  NEW.stock_applied := true;
  RETURN NEW;
END;
$$;

-- Cancelamento do pedido do representante devolve ao lote de origem.
create or replace function public.repco_return_stock_on_cancel()
returns trigger
language plpgsql security definer set search_path = public
as $$
BEGIN
  IF NEW.status = 'cancelled' AND coalesce(OLD.status, '') <> 'cancelled' THEN
    PERFORM public.return_stock_by_reference('representative_order', NEW.id, 'Pedido cancelado');
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- Canal loja (B2C e B2B pelo site): consome quando o pagamento é APROVADO
-- ---------------------------------------------------------------------
-- De propósito não consome ao criar o pedido: pedido pendente que nunca é pago
-- comeria estoque que não saiu. A baixa acontece quando o dinheiro entra.
create or replace function public.consume_stock_on_order_paid()
returns trigger
language plpgsql security definer set search_path = public
as $$
DECLARE
  v_item record;
  v_canal text;
BEGIN
  IF NEW.status <> 'approved' OR coalesce(OLD.status, '') = 'approved' THEN
    RETURN NEW;
  END IF;

  -- O canal vem da empresa que faturou, que já está no pedido.
  SELECT CASE WHEN c.order_prefix = 'CO' THEN 'cofico' ELSE 'saporino' END
    INTO v_canal
    FROM public.companies c WHERE c.id = NEW.seller_company_id;

  FOR v_item IN
    SELECT product_id, quantity FROM public.order_items
     WHERE order_id = NEW.id AND product_id IS NOT NULL
  LOOP
    PERFORM public.consume_stock_fifo(
      v_item.product_id, v_item.quantity, coalesce(v_canal, 'saporino'),
      'order', NEW.id, NEW.seller_company_id, 'venda'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

drop trigger if exists trg_consume_stock_on_order_paid on public.orders;
create trigger trg_consume_stock_on_order_paid
  after update of status on public.orders
  for each row execute function public.consume_stock_on_order_paid();

-- Pedido da loja cancelado ou estornado devolve ao lote.
create or replace function public.return_stock_on_order_cancelled()
returns trigger
language plpgsql security definer set search_path = public
as $$
BEGIN
  IF NEW.status IN ('rejected', 'refunded', 'cancelled') AND coalesce(OLD.status, '') = 'approved' THEN
    PERFORM public.return_stock_by_reference('order', NEW.id, 'Pedido ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

drop trigger if exists trg_return_stock_on_order_cancelled on public.orders;
create trigger trg_return_stock_on_order_cancelled
  after update of status on public.orders
  for each row execute function public.return_stock_on_order_cancelled();

-- ---------------------------------------------------------------------
-- Para onde foi cada lote
-- ---------------------------------------------------------------------
create or replace view public.vw_lote_destino as
  select m.batch_number,
         p.name                                        as produto,
         c.name                                        as empresa,
         m.channel                                     as canal,
         sum(-m.quantity) filter (where m.quantity < 0) as saiu,
         sum(m.quantity)  filter (where m.quantity > 0) as voltou,
         count(*)                                      as movimentos,
         max(m.created_at)                             as ultimo_movimento
    from public.stock_movements m
    join public.products p  on p.id = m.product_id
    left join public.companies c on c.id = m.company_id
   group by m.batch_number, p.name, c.name, m.channel
   order by max(m.created_at) desc;

revoke all on public.vw_lote_destino from public, anon;
grant select on public.vw_lote_destino to authenticated;

-- ---------------------------------------------------------------------
-- Alertas
-- ---------------------------------------------------------------------
-- 1) Validade chegando: avisar com 2 meses para dar tempo de girar o lote com
--    desconto agressivo, em vez de descobrir vencido.
-- 2) Reposição: quanto ainda tem, quanto sai por dia e em quantos dias acaba.
--    A velocidade sai do próprio livro-razão — é a semente da inteligência de
--    produção: se o lote de 750 kg dura duas semanas, a cadência precisa mudar.
create or replace view public.vw_estoque_alertas as
with venda_30d as (
  select product_id, sum(-quantity)::numeric as vendidos
    from public.stock_movements
   where quantity < 0
     and movement_type = 'venda'
     and created_at > now() - interval '30 days'
   group by product_id
),
saldo as (
  select l.product_id,
         sum(l.quantity_packages)::int                         as pacotes,
         min(l.expiry_date) filter (where l.quantity_packages > 0) as validade_mais_proxima
    from public.green_coffee_lots l
   where l.status = 'active'
   group by l.product_id
)
select p.id                                                      as product_id,
       p.name                                                    as produto,
       c.name                                                    as empresa,
       coalesce(s.pacotes, 0)                                    as pacotes_disponiveis,
       coalesce(v.vendidos, 0)                                   as vendidos_30d,
       round(coalesce(v.vendidos, 0) / 30.0, 2)                  as media_por_dia,
       case when coalesce(v.vendidos, 0) > 0
            then floor(coalesce(s.pacotes, 0) / (v.vendidos / 30.0))::int
       end                                                       as dias_de_estoque,
       s.validade_mais_proxima,
       case when s.validade_mais_proxima is not null
            then (s.validade_mais_proxima - current_date)
       end                                                       as dias_ate_vencer,
       -- o alerta que o administrador precisa ver, em ordem de urgência
       case
         when coalesce(s.pacotes, 0) = 0                                              then 'SEM ESTOQUE — produzir lote'
         when s.validade_mais_proxima is not null
              and s.validade_mais_proxima <= current_date + 60                        then 'VALIDADE PROXIMA — girar com desconto'
         when coalesce(v.vendidos, 0) > 0
              and coalesce(s.pacotes, 0) / (v.vendidos / 30.0) < 15                   then 'ACABANDO — produzir lote'
         when coalesce(v.vendidos, 0) > 0
              and coalesce(s.pacotes, 0) / (v.vendidos / 30.0) < 30                   then 'ATENCAO — planejar producao'
         else 'OK'
       end                                                       as alerta
  from public.products p
  left join saldo s     on s.product_id = p.id
  left join venda_30d v on v.product_id = p.id
  left join public.companies c on c.id = p.company_id
 where p.is_active
 order by case
            when coalesce(s.pacotes, 0) = 0 then 0
            when s.validade_mais_proxima <= current_date + 60 then 1
            else 2
          end, p.name;

revoke all on public.vw_estoque_alertas from public, anon;
grant select on public.vw_estoque_alertas to authenticated;

comment on view public.vw_estoque_alertas is
  'Alertas de estoque: sem estoque, validade em ate 60 dias e velocidade de venda (dias de estoque restantes). Base para decidir cadencia de producao.';
