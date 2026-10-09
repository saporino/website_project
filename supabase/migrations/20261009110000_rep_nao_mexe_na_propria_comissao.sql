-- O REPRESENTANTE NÃO MEXE NO QUE VALE DINHEIRO.
--
-- Achado da varredura de 09/10/2026, provado em bancada: a política "RepCo can update own
-- record" deixa o rep atualizar a PRÓPRIA linha inteira, sem restringir colunas. Na prática
-- ele se deu `commission_rate = 8` e `has_personal_delivery = true` — ou seja, aumentou a
-- própria comissão e ligou o bônus de entrega pessoal, que é liberação do admin.
--
-- Não dá para resolver só com RLS: política decide QUAIS LINHAS, não quais colunas. Então
-- a trava é um gatilho que, quando quem edita não é admin nem gerente, devolve as colunas
-- de valor ao que estavam. O rep continua editando o que é dele de verdade — telefone,
-- presença, posição no mapa.
--
-- Vale para toda empresa e todo papel: a decisão de quanto alguém ganha é do admin.

create or replace function public.representante_nao_muda_o_proprio_dinheiro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- admin e gerente comercial mandam; o resto não encosta nestas colunas.
  if public.is_admin() or public.has_role('gerente_comercial') then
    return new;
  end if;

  new.commission_rate       := old.commission_rate;
  new.has_personal_delivery := old.has_personal_delivery;
  new.status                := old.status;
  new.approved_at           := old.approved_at;
  new.blocked_reason        := old.blocked_reason;
  new.experience_start_date := old.experience_start_date;
  new.company_id            := old.company_id;
  new.user_id               := old.user_id;   -- senão dá para sequestrar a conta de outro
  new.cpf                   := old.cpf;
  new.cnpj                  := old.cnpj;
  return new;
end $$;

comment on function public.representante_nao_muda_o_proprio_dinheiro() is
  'Congela comissao, bonus, status e documento quando quem edita nao e admin nem gerente.';

drop trigger if exists representantes_colunas_do_admin on public.representatives;
create trigger representantes_colunas_do_admin
  before update on public.representatives
  for each row execute function public.representante_nao_muda_o_proprio_dinheiro();

-- ------------------------------------------------------------------------------------
-- ITEM DE PEDIDO DE EMBALAGEM: só junto com o pedido, e só enquanto ele é novo.
--
-- A política estava `with check (true)`: qualquer visitante podia pendurar item em QUALQUER
-- pedido, inclusive num já fechado de outra pessoa — mudando o que a COFICO vai produzir e
-- cobrar. Agora o item só entra se o pedido existir e ainda estiver como 'novo'.
drop policy if exists embalagem_pedido_itens_envio on public.embalagem_pedido_itens;
create policy embalagem_pedido_itens_envio on public.embalagem_pedido_itens
  for insert to anon, authenticated
  with check (exists (
    select 1 from public.embalagem_pedidos p
     where p.id = pedido_id and p.status = 'novo'
       and p.criado_em > now() - interval '10 minutes'
  ));
comment on policy embalagem_pedido_itens_envio on public.embalagem_pedido_itens is
  'Item entra so no pedido recem-aberto e ainda novo: fecha a janela de pendurar item em pedido alheio.';
