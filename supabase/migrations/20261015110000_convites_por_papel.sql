-- =====================================================================
-- Convites: cada papel no seu lugar (15/10/2026)
--
-- O PROBLEMA: as duas únicas policies de repco_invite_codes eram
--
--   repco_invite_codes_ger_all  →  has_role('gerente_comercial')  →  ALL
--   repco_invite_codes_sup_all  →  has_role('supervisor')         →  ALL
--
-- ALL, sem restrição de role_code. As RPCs exigem is_admin(), mas as POLICIES
-- permitiam escrita direta na tabela — e, como não havia CHECK nenhum em
-- role_code, dava para inserir um convite com o papel que a pessoa quisesse.
--
-- Verificado antes de mexer: NENHUMA funcionalidade usa essas policies.
--   · repco_generate_invite / promoter_generate_invite  → SECURITY DEFINER + is_admin()
--   · repco_list_invites / promoter_list_invites        → SECURITY DEFINER + is_admin()
--   · repco_delete_invite / repco_revoke_invite         → SECURITY DEFINER + is_admin()
--   · Edge Function promoter-signup                     → service role (ignora RLS)
-- Não existe `.from('repco_invite_codes')` em nenhuma tela.
-- Ou seja: era permissão sem uso, aberta por acidente. Nada legítimo se perde.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. role_code deixa de aceitar qualquer string
-- ---------------------------------------------------------------------
-- Hoje não há CHECK nenhum (só PK, UNIQUE em code e FK de company_id). É esta
-- trava que impede, estruturalmente, um convite de cliente conceder papel
-- administrativo ou de representante.
do $$
begin
  -- Linhas fora da lista impediriam o constraint de nascer. Hoje só existe
  -- 'promotor', mas a conferência é barata e evita uma migration que falha.
  if exists (select 1 from public.repco_invite_codes
              where role_code not in ('representante', 'promotor', 'cliente_pj')) then
    raise exception 'Há convites com role_code fora da lista permitida. Resolver antes.';
  end if;
end $$;

alter table public.repco_invite_codes
  drop constraint if exists repco_invite_codes_role_code_check;

alter table public.repco_invite_codes
  add constraint repco_invite_codes_role_code_check
  check (role_code in ('representante', 'promotor', 'cliente_pj'));

-- ---------------------------------------------------------------------
-- 2. As policies abertas saem
-- ---------------------------------------------------------------------
drop policy if exists repco_invite_codes_ger_all on public.repco_invite_codes;
drop policy if exists repco_invite_codes_sup_all on public.repco_invite_codes;

-- Leitura para quem acompanha a operação — gerente e supervisor continuam
-- enxergando os convites, que era o único uso plausível das policies antigas.
-- Escrita, nenhuma: quem gera é a RPC, que confere is_admin().
create policy repco_invite_codes_leitura_gestao
  on public.repco_invite_codes for select
  using (public.is_admin() or public.has_role('gerente_comercial') or public.has_role('supervisor'));

comment on table public.repco_invite_codes is
  'Convites de acesso, unificados por role_code (representante, promotor, cliente_pj). Escrita SÓ pelas RPCs SECURITY DEFINER, que exigem is_admin(). Gerente e supervisor leem, não escrevem.';

-- ---------------------------------------------------------------------
-- 3. Quem valida um convite nunca aceita papel de outro
-- ---------------------------------------------------------------------
-- As funções existentes já filtram por role_code ('representante' em
-- repco_validate_invite, 'promotor' em promoter_validate_invite), então um
-- código de cliente não serve para entrar como representante. Ficam como estão;
-- este comentário registra que a separação foi conferida, não presumida.
