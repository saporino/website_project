-- A central de WhatsApp precisa ver a mensagem chegar sem alguém apertar F5.
--
-- Sem publicar as tabelas, a caixa só atualizaria ao recarregar — e numa tela de atendimento
-- isso significa cliente esperando sem ninguém saber. A publicação respeita a RLS: cada
-- assinante só recebe o que já poderia ler.

do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname='supabase_realtime' and tablename='wa_mensagens') then
    alter publication supabase_realtime add table public.wa_mensagens;
  end if;
  if not exists (select 1 from pg_publication_tables
                  where pubname='supabase_realtime' and tablename='wa_conversas') then
    alter publication supabase_realtime add table public.wa_conversas;
  end if;
end $$;

-- Assumir / largar o atendimento. Mesmo porteiro de `wa_marcar_lida`: admin ou papel
-- `atendimento` DA EMPRESA daquela conversa. Representante não entra.
create or replace function public.wa_assumir(p_conversa uuid, p_assumir boolean)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_empresa uuid; v_atual uuid;
begin
  select company_id, responsavel_id into v_empresa, v_atual
    from public.wa_conversas where id = p_conversa;
  if v_empresa is null then return; end if;
  if not (public.is_admin() or public.has_role('atendimento', v_empresa)) then
    raise exception 'sem permissao nesta conversa' using errcode = '42501';
  end if;
  -- Largar só vale para quem assumiu (ou para o admin): ninguém tira a conversa do colega.
  if not p_assumir and v_atual is distinct from auth.uid() and not public.is_admin() then
    raise exception 'esta conversa esta com outro atendente' using errcode = '42501';
  end if;
  update public.wa_conversas
     set responsavel_id = case when p_assumir then auth.uid() else null end,
         assumida_em    = case when p_assumir then now() else null end,
         atualizada_em  = now()
   where id = p_conversa;
end $$;
revoke all on function public.wa_assumir(uuid, boolean) from public, anon;
grant execute on function public.wa_assumir(uuid, boolean) to authenticated;

-- Quem é o responsável, em nome legível. `user_profiles` só deixa o próprio dono ler, então
-- sem isto a tela mostraria um UUID. Devolve SÓ o nome — nada de e-mail ou telefone — e só
-- para quem já pode ver aquela conversa.
create or replace function public.wa_nome_do_atendente(p_conversa uuid)
returns text language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare v_empresa uuid; v_resp uuid; v_nome text;
begin
  select company_id, responsavel_id into v_empresa, v_resp
    from public.wa_conversas where id = p_conversa;
  if v_resp is null then return null; end if;
  if not (public.is_admin() or public.has_role('atendimento', v_empresa)) then return null; end if;
  select full_name into v_nome from public.user_profiles where id = v_resp;
  return coalesce(nullif(btrim(v_nome), ''), 'Atendente');
end $$;
revoke all on function public.wa_nome_do_atendente(uuid) from public, anon;
grant execute on function public.wa_nome_do_atendente(uuid) to authenticated;
