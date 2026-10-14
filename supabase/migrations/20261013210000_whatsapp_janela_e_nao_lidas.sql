-- A janela de 24 h e o contador de não lidas, em uma operação só.
--
-- Por que não é um UPDATE solto na função de borda: o webhook pode processar o mesmo lote
-- fora de ordem (a Meta não garante ordem) e um reprocessamento não pode esticar a janela
-- para trás nem inflar o contador. `greatest` resolve o primeiro; a função resolve o
-- segundo, porque só é chamada quando a mensagem é NOVA.

create or replace function public.wa_marcar_entrada(p_conversa uuid, p_quando timestamptz)
returns void language sql security definer set search_path to 'public','pg_temp' as $$
  update public.wa_conversas
     set ultima_entrada_em = greatest(coalesce(ultima_entrada_em, p_quando), p_quando),
         nao_lidas         = nao_lidas + 1,
         status            = 'aberta',       -- cliente escreveu: a conversa reabre
         atualizada_em     = now()
   where id = p_conversa;
$$;
comment on function public.wa_marcar_entrada(uuid, timestamptz) is
  'Move a janela de 24h e conta a nao lida. greatest() impede que evento fora de ordem ande para tras.';

-- Só o webhook (service role) e o admin chamam. Quem atende marca como lida por outro caminho.
revoke all on function public.wa_marcar_entrada(uuid, timestamptz) from public, anon, authenticated;

-- Marcar lida: quem atende, na própria empresa. Zera o contador, não mexe na janela.
create or replace function public.wa_marcar_lida(p_conversa uuid)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_empresa uuid;
begin
  select company_id into v_empresa from public.wa_conversas where id = p_conversa;
  if v_empresa is null then return; end if;
  if not (public.is_admin() or public.has_role('atendimento', v_empresa)) then
    raise exception 'sem permissao nesta conversa' using errcode = '42501';
  end if;
  update public.wa_conversas set nao_lidas = 0, atualizada_em = now() where id = p_conversa;
end $$;
revoke all on function public.wa_marcar_lida(uuid) from public, anon;
grant execute on function public.wa_marcar_lida(uuid) to authenticated;

-- Caixa de entrada pronta para a tela: conversa + contato + a conta da janela, já filtrada
-- pela RLS das tabelas de baixo (a view não é security definer).
create or replace view public.vw_wa_caixa as
select cv.id, cv.company_id, cv.status, cv.nao_lidas, cv.responsavel_id,
       cv.ultima_entrada_em, cv.ultima_saida_em, cv.atualizada_em,
       ct.id as contato_id, ct.telefone_e164, ct.nome_perfil, ct.representative_client_id,
       n.rotulo as numero_rotulo,
       (cv.ultima_entrada_em is not null
         and cv.ultima_entrada_em > now() - interval '24 hours')            as janela_aberta,
       greatest(0, floor(extract(epoch from
         (cv.ultima_entrada_em + interval '24 hours' - now())) / 60))::int  as janela_minutos
  from public.wa_conversas cv
  join public.wa_contatos  ct on ct.id = cv.contato_id
  join public.wa_numeros   n  on n.id  = cv.numero_id;

comment on view public.vw_wa_caixa is
  'Caixa de entrada do WhatsApp. janela_aberta diz se ainda da para responder em texto livre; fora dela, so modelo aprovado (cobrado).';

revoke all on public.vw_wa_caixa from anon;
grant select on public.vw_wa_caixa to authenticated;
