-- A operação da plataforma (chave de serviço) também avança subpedidos.
--
-- Até aqui só o vendedor dono ou um admin logado chamavam
-- lv_subpedido_mudar_status. A chave de serviço — scripts da operação e, na
-- Unidade 10, o aviso da transportadora — recebia "subpedido não encontrado".
-- Agora ela passa, registrada com origem "sistema". A trigger de estados
-- continua recusando pulo ou volta para qualquer um, e os passos aceitos
-- continuam só os operacionais (separação, pronto, enviado, entregue).

create or replace function public.lv_subpedido_mudar_status(p_seller_order uuid, p_status text, p_nota text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_so public.lv_seller_orders;
  v_admin boolean := public.is_admin();
  v_servico boolean := coalesce(auth.role(), '') = 'service_role';
  v_dono boolean;
  v_origem text;
  v_tipo text;
begin
  select * into v_so from public.lv_seller_orders where id = p_seller_order for update;
  v_dono := v_so.seller_id = any(public.lv_meus_vendedores());
  if v_so.id is null or not (v_admin or v_servico or v_dono) then
    raise exception 'Subpedido não encontrado.' using errcode = 'P0001', hint = 'PEDIDO_INEXISTENTE';
  end if;
  if p_status not in ('separacao', 'pronto_para_envio', 'enviado', 'entregue') then
    raise exception 'Esta mudança não é feita por aqui.' using errcode = 'P0001', hint = 'STATUS_NAO_PERMITIDO';
  end if;
  update public.lv_seller_orders set status = p_status where id = v_so.id;
  update public.lv_shipments
     set status = case p_status when 'separacao' then 'em_preparo' when 'pronto_para_envio' then 'em_preparo' else p_status end,
         updated_at = now()
   where seller_order_id = v_so.id;
  v_origem := case when v_dono then 'vendedor' when v_admin then 'admin' else 'sistema' end;
  v_tipo := case p_status when 'separacao' then 'em_separacao' else p_status end;
  perform public.lv_registrar_evento_pedido(v_so.order_id, v_so.id, v_tipo, v_origem,
    jsonb_build_object('de', v_so.status, 'para', p_status, 'nota', p_nota));
  perform public.lv_derivar_status_pedido(v_so.order_id);
  return jsonb_build_object('status', p_status,
    'status_pedido', (select status from public.lv_orders where id = v_so.order_id));
end $$;

revoke all on function public.lv_subpedido_mudar_status(uuid, text, text) from public, anon;
grant execute on function public.lv_subpedido_mudar_status(uuid, text, text) to authenticated, service_role;
