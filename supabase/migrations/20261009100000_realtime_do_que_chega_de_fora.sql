-- REALTIME NAS TABELAS QUE RECEBEM COISA DE FORA.
--
-- Varredura de 09/10/2026, cobrada pelo Vlademir: "você não pega esses problemas sozinho?".
-- Em vez de ligar o realtime de uma tela por vez, comparei o que o código ESCUTA com o que o
-- banco PUBLICA. Apareceram três buracos:
--
--   1. `b2b_leads` e `candidaturas_representante` — o sininho do admin escuta as duas desde
--      sempre, mas elas nunca estiveram na publicação: escuta morta. Lead e candidatura
--      nunca acenderam o sino sozinhos.
--   2. `orders` — pedido da loja não publica nada. Com o cadastro B2C abrindo, venda nova
--      não ia aparecer nem no sino nem na tela de Pedidos sem F5.
--   3. `embalagem_pedidos` — a loja de embalagem da COFICO nasceu agora e já nasceu muda.
--
-- Realtime respeita RLS: cada um só recebe o que já poderia ler.
do $$
declare t text;
begin
  foreach t in array array[
    'orders', 'order_items', 'embalagem_pedidos', 'b2b_leads',
    'candidaturas_representante', 'notifications',
    -- também escutada pelo código e nunca publicada (src/lib/promoterVisit.ts)
    'promoter_visits'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;   -- já publicada
    end;
  end loop;
end $$;
