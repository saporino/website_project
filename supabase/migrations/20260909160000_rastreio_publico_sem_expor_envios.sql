-- =====================================================================
-- MOVIMENTO 1 (conclusão) — rastreio público sem expor a tabela de envios
--
-- `shipments` tinha QUATRO policies, e três estavam certas:
--
--   Service role can manage shipments   ALL     jwt.role = 'service_role'
--   admin all shipments                 ALL     is_admin()
--   Users can view own shipments        SELECT  order_id in (pedidos do usuário)
--   public read shipments               SELECT  USING (true)     <-- esta
--
-- Policies se somam por OU. A última anulava as outras três: qualquer
-- visitante, sem login, podia ler TODOS os envios. E a página /rastrear
-- aproveitava isso com `select('*, orders(order_number, customer_name))`,
-- de modo que um anônimo lia inclusive o NOME do cliente de cada pedido.
-- A tabela está com zero linhas, então nada vazou — mas vazaria no primeiro
-- envio real, e o dado é enumerável.
--
-- A correção tem duas partes: remover a policy permissiva (as outras três já
-- cobrem dono e administrador) e dar ao rastreio público um caminho próprio
-- que devolve só o necessário, no mesmo padrão de `get_order_public`.
-- =====================================================================

drop policy if exists "public read shipments" on public.shipments;

comment on table public.shipments is
  'Envios. Leitura restrita: dono do pedido, admin e service_role. O rastreio publico passa por rastrear_envio(), que devolve so transportadora, status e data de despacho.';

-- ---------------------------------------------------------------------
-- Rastreio público por código
-- ---------------------------------------------------------------------
-- Devolve o MENOR conjunto de campos que a tela precisa. Hoje /rastrear usa
-- apenas `carrier_name` (para saber a qual rastreador perguntar); status e
-- data de despacho entram porque são do próprio envio e não identificam
-- ninguém. Ficam de fora, deliberadamente: order_id, label_url,
-- carrier_api_shipment_id, tracking_events e qualquer dado do comprador.
--
-- Não revela se o código existe: código inválido e código inexistente
-- devolvem o mesmo NULL, igual a get_order_public.
create or replace function public.rastrear_envio(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
begin
  -- Piso de tamanho: sem isto, uma string de 1 ou 2 caracteres viraria uma
  -- consulta ampla. O código de rastreio é o segredo — trate-o como um.
  if length(v_codigo) < 8 then
    return null;
  end if;

  select jsonb_build_object(
           'carrier_name',  s.carrier_name,
           'status',        s.status,
           'dispatch_date', s.dispatch_date
         )
    into v
    from public.shipments s
   where upper(s.tracking_code) = v_codigo
   limit 1;

  return v;   -- NULL quando não encontra: resposta idêntica à do código inválido
end $$;

comment on function public.rastrear_envio is
  'Rastreio publico por codigo. Devolve so transportadora, status e data de despacho — nunca dados do comprador, nem revela se o codigo existe.';

revoke all on function public.rastrear_envio(text) from public;
grant execute on function public.rastrear_envio(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Cupons deixam de ser públicos
-- ---------------------------------------------------------------------
-- Achado equivalente na mesma varredura, e este já estava vazando de fato:
-- `cp_leitura` permitia a anon listar todo cupom ativo. O VOLTA10, que existe
-- para trazer de volta quem abandonou o carrinho, era legível por qualquer
-- visitante — inclusive por quem nunca abandonou nada.
--
-- Ninguém no navegador lê esta tabela: o checkout valida por `validar_cupom`
-- e o `create-checkout-order` incrementa o uso com service role.
drop policy if exists cp_leitura on public.coupons;

comment on table public.coupons is
  'Cupons de desconto. ADMIN-ONLY na leitura: cupom listavel publicamente deixa de ser incentivo dirigido. A validacao publica passa por validar_cupom().';
