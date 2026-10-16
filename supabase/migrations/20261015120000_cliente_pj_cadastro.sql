-- =====================================================================
-- Cadastro do cliente PJ pela COFICO (15/10/2026)
--
-- A LACUNA CENTRAL: `representative_clients` é uma ficha PJ completa (54
-- campos) que NÃO TEM DONO. Ela tem `representative_id` — pertence a um
-- representante — e nenhuma ligação com uma conta de login. Por isso não existe
-- autocadastro: não é tela que falta, é o vínculo.
--
-- Esta migration cria o vínculo, o papel e a porta — sem tocar em nada do que o
-- representante já usa. Todas as policies existentes de representative_clients
-- (my_rep_id, gerente_comercial, supervisor, contabilidade) continuam como estão;
-- as novas são ADICIONAIS.
--
-- O que o cadastro NÃO concede: crédito, prazo de pagamento, limite de compra ou
-- qualquer permissão administrativa. Isso é decisão comercial do admin, e as
-- colunas correspondentes ficam fora do que o cliente pode escrever.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. A ficha ganha dono
-- ---------------------------------------------------------------------
alter table public.representative_clients
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists origem text not null default 'representante',
  add column if not exists status_cadastro text not null default 'aprovado',
  add column if not exists convite_id uuid references public.repco_invite_codes(id) on delete set null,
  add column if not exists cadastrado_em timestamptz;

-- Ficha de cliente que se cadastrou sozinho não tem representante. O campo era
-- NOT NULL porque, até hoje, toda ficha nascia de um rep.
alter table public.representative_clients
  alter column representative_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'representative_clients_origem_check') then
    alter table public.representative_clients
      add constraint representative_clients_origem_check
      check (origem in ('representante', 'autocadastro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'representative_clients_status_cadastro_check') then
    alter table public.representative_clients
      add constraint representative_clients_status_cadastro_check
      check (status_cadastro in ('rascunho', 'em_analise', 'aprovado', 'recusado'));
  end if;
end $$;

-- Uma conta representa UMA empresa. Sem isto, duas fichas poderiam apontar para
-- a mesma pessoa e o portal não saberia qual abrir.
create unique index if not exists representative_clients_user_id_uidx
  on public.representative_clients (user_id) where user_id is not null;

comment on column public.representative_clients.user_id is
  'Conta de login que representa esta empresa no portal da COFICO. Nulo = ficha criada por representante, sem acesso próprio.';
comment on column public.representative_clients.origem is
  'representante = o rep cadastrou · autocadastro = a empresa se cadastrou pelo site da COFICO com código de convite.';
comment on column public.representative_clients.status_cadastro is
  'rascunho → em_analise → aprovado | recusado. Fichas antigas nascem aprovado, para não mudar o que já funciona.';

-- ---------------------------------------------------------------------
-- 2. A marca que o CLIENTE escolhe
-- ---------------------------------------------------------------------
-- Marca comercial NÃO é a pessoa jurídica que fatura. "Tropeiro Paulista" é
-- linha da Café Saporino Ltda: quem emite a nota continua sendo a empresa
-- vendedora (seller_company_id / company_id do pedido), nunca a marca daqui.
-- São colunas diferentes de propósito — foi assim que a peça da Capital saiu
-- como Saporino no Studio, e não se repete.
create table if not exists public.cliente_marcas (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.representative_clients(id) on delete cascade,
  marca         text not null,
  ativa         boolean not null default true,
  escolhida_em  timestamptz not null default now(),
  escolhida_por uuid references auth.users(id) on delete set null,
  desativada_em timestamptz
);

-- Mesma marca não entra duas vezes para o mesmo cliente; trocar desativa, não apaga.
create unique index if not exists cliente_marcas_unica_idx
  on public.cliente_marcas (cliente_id, marca);

create index if not exists cliente_marcas_cliente_idx
  on public.cliente_marcas (cliente_id) where ativa;

comment on table public.cliente_marcas is
  'Marcas que o PRÓPRIO cliente declara comprar (Saporino, Tropeiro Paulista...). Relacionamento comercial, NÃO rota de faturamento — a nota sai pela empresa vendedora do pedido. Histórico preservado: desativar, nunca apagar.';

alter table public.cliente_marcas enable row level security;

-- ---------------------------------------------------------------------
-- 3. Quem é cliente PJ, e o que ele enxerga
-- ---------------------------------------------------------------------
-- A pergunta "esta conta é dona desta ficha?" em um lugar só.
create or replace function public.minha_ficha_pj()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select rc.id from public.representative_clients rc
   where rc.user_id = auth.uid()
   limit 1;
$$;

comment on function public.minha_ficha_pj() is
  'A ficha PJ da conta logada, ou nulo. Base das policies do portal do cliente.';

-- O cliente lê a PRÓPRIA ficha. Só.
create policy cliente_pj_le_a_propria_ficha
  on public.representative_clients for select
  using (user_id = auth.uid());

-- E edita só enquanto o cadastro é rascunho. Depois de enviado para análise, a
-- ficha congela: alterar razão social ou CNPJ depois da aprovação muda a nota
-- fiscal, e isso é decisão do admin.
create policy cliente_pj_edita_o_rascunho
  on public.representative_clients for update
  using (user_id = auth.uid() and status_cadastro = 'rascunho')
  with check (
    user_id = auth.uid()
    and status_cadastro in ('rascunho', 'em_analise')
    -- Condição comercial NUNCA sai das mãos do admin. O cadastro não concede
    -- crédito, prazo nem limite — é regra de negócio, e aqui ela é estrutural.
    and limite_credito  is not distinct from (select r.limite_credito  from public.representative_clients r where r.id = representative_clients.id)
    and credito_score   is not distinct from (select r.credito_score   from public.representative_clients r where r.id = representative_clients.id)
    and forma_pagamento is not distinct from (select r.forma_pagamento from public.representative_clients r where r.id = representative_clients.id)
    and prazo_pagamento is not distinct from (select r.prazo_pagamento from public.representative_clients r where r.id = representative_clients.id)
    and representative_id is not distinct from (select r.representative_id from public.representative_clients r where r.id = representative_clients.id)
    and company_id      is not distinct from (select r.company_id      from public.representative_clients r where r.id = representative_clients.id)
  );

-- Marcas: o cliente declara as suas, e vê só as suas.
create policy cliente_marcas_do_cliente
  on public.cliente_marcas for select
  using (cliente_id = public.minha_ficha_pj() or public.is_admin()
         or public.has_role('gerente_comercial') or public.has_role('supervisor'));

create policy cliente_marcas_cliente_declara
  on public.cliente_marcas for insert
  with check (cliente_id = public.minha_ficha_pj());

create policy cliente_marcas_cliente_atualiza
  on public.cliente_marcas for update
  using (cliente_id = public.minha_ficha_pj())
  with check (cliente_id = public.minha_ficha_pj());

create policy cliente_marcas_admin
  on public.cliente_marcas for all
  using (public.is_admin()) with check (public.is_admin());

-- O cliente vê os pedidos DA PRÓPRIA EMPRESA — nunca de outra.
create policy cliente_pj_ve_os_proprios_pedidos
  on public.representative_orders for select
  using (representative_client_id = public.minha_ficha_pj());

-- ---------------------------------------------------------------------
-- 4. Convite de cliente PJ
-- ---------------------------------------------------------------------
-- Mesma tabela, mesmo gerador, quarto papel. Nenhum gerador novo.
--
-- Duas diferenças em relação ao convite de representante, as duas de propósito:
--   · preso ao e-mail (vai em `note` no formato "nome <email>") — o código não
--     serve para quem o interceptar;
--   · validade de 7 dias, não 24 h: um comprador precisa reunir CNPJ, IE e
--     dados bancários, e não faz isso numa tarde.
create or replace function public.repco_generate_invite_pj(
  p_note text default null,
  p_email text default null,
  p_company uuid default null,
  p_dias int default 7
)
returns table(code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare c text; v_exp timestamptz; v_email text;
begin
  if not public.is_admin() then raise exception 'apenas admin'; end if;

  v_email := lower(btrim(coalesce(p_email, '')));
  if v_email = '' or v_email not like '%_@_%._%' then
    raise exception 'E-mail do convidado é obrigatório e precisa ser válido.';
  end if;
  if p_dias < 1 or p_dias > 30 then
    raise exception 'Validade fora da faixa (1 a 30 dias).';
  end if;

  v_exp := now() + make_interval(days => p_dias);
  loop
    c := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.repco_invite_codes i where i.code = c);
  end loop;

  insert into public.repco_invite_codes (code, note, created_by, expires_at, role_code, company_id)
  values (c, coalesce(nullif(btrim(p_note), ''), v_email) || ' <' || v_email || '>',
          auth.uid(), v_exp, 'cliente_pj', p_company);

  return query select c, v_exp;
end;
$$;

comment on function public.repco_generate_invite_pj is
  'Gera convite de CLIENTE PJ (uso único, preso ao e-mail, validade em dias). Só admin. Não concede crédito nem permissão administrativa.';

-- Conferir o código sem consumir — para a tela dizer "código válido" antes de
-- a pessoa preencher a ficha inteira e descobrir no fim que estava errado.
create or replace function public.repco_validate_invite_pj(p_code text)
returns table(valido boolean, email text, motivo text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare inv public.repco_invite_codes;
begin
  select * into inv from public.repco_invite_codes
   where upper(code) = upper(btrim(p_code)) and role_code = 'cliente_pj';

  if inv.id is null then
    return query select false, null::text, 'Código não encontrado.'; return;
  end if;
  if inv.used_by is not null then
    return query select false, null::text, 'Este código já foi utilizado.'; return;
  end if;
  if inv.expires_at <= now() then
    return query select false, null::text, 'Este código expirou.'; return;
  end if;

  return query select true,
    nullif(substring(inv.note from '<([^>]+)>'), ''),
    null::text;
end;
$$;

comment on function public.repco_validate_invite_pj is
  'Confere um código de cliente PJ SEM consumir. Devolve o e-mail a que ele está preso.';

-- ---------------------------------------------------------------------
-- 5. Consumir o convite e criar a ficha
-- ---------------------------------------------------------------------
-- Roda com a sessão do cliente recém-criado. Consome o código, cria a ficha em
-- 'em_analise' e grava as marcas que ele escolheu.
create or replace function public.cliente_pj_registrar(
  p_code text,
  p_cnpj text,
  p_razao_social text,
  p_nome_fantasia text default null,
  p_nome_comprador text default null,
  p_email_comprador text default null,
  p_whatsapp text default null,
  p_endereco text default null,
  p_marcas text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare inv public.repco_invite_codes; me uuid := auth.uid(); nova uuid; m text;
begin
  if me is null then raise exception 'Sessão necessária.'; end if;

  -- Uma conta, uma empresa.
  if exists (select 1 from public.representative_clients where user_id = me) then
    raise exception 'Esta conta já possui um cadastro de empresa.';
  end if;

  -- FOR UPDATE trava a linha: dois cliques no mesmo segundo não geram duas fichas.
  select * into inv from public.repco_invite_codes
   where upper(code) = upper(btrim(p_code))
     and role_code = 'cliente_pj'
     and used_by is null
     and expires_at > now()
   for update;

  if inv.id is null then raise exception 'Código inválido, já utilizado ou expirado.'; end if;

  if coalesce(btrim(p_cnpj), '') = '' or coalesce(btrim(p_razao_social), '') = '' then
    raise exception 'CNPJ e razão social são obrigatórios.';
  end if;

  insert into public.representative_clients (
    representative_id, cnpj, razao_social, nome_fantasia,
    nome_comprador, email_comprador, whatsapp_comprador, endereco_completo,
    user_id, origem, status_cadastro, convite_id, company_id, cadastrado_em
  ) values (
    null, regexp_replace(coalesce(p_cnpj,''), '\D', '', 'g'), btrim(p_razao_social), nullif(btrim(coalesce(p_nome_fantasia,'')), ''),
    nullif(btrim(coalesce(p_nome_comprador,'')), ''), lower(nullif(btrim(coalesce(p_email_comprador,'')), '')),
    nullif(btrim(coalesce(p_whatsapp,'')), ''), nullif(btrim(coalesce(p_endereco,'')), ''),
    me, 'autocadastro', 'em_analise', inv.id, inv.company_id, now()
  ) returning id into nova;

  foreach m in array coalesce(p_marcas, '{}') loop
    if btrim(m) <> '' then
      insert into public.cliente_marcas (cliente_id, marca, escolhida_por)
      values (nova, btrim(m), me)
      on conflict (cliente_id, marca) do nothing;
    end if;
  end loop;

  -- O código morre aqui. Uso único de verdade.
  update public.repco_invite_codes set used_by = me, used_at = now() where id = inv.id;

  -- O papel sai do convite, nunca do que o cliente pediu.
  insert into public.user_roles (user_id, role_code, is_active, granted_at)
  values (me, 'cliente_pj', true, now())
  on conflict do nothing;

  return nova;
end;
$$;

comment on function public.cliente_pj_registrar is
  'Consome um convite cliente_pj e cria a ficha em em_analise. O papel vem do convite. Não concede crédito, prazo nem limite.';

-- ---------------------------------------------------------------------
-- 6. O que a administração vê (item 5 do briefing)
-- ---------------------------------------------------------------------
create or replace view public.vw_cadastros_pj as
  select rc.id,
         rc.razao_social,
         rc.nome_fantasia,
         rc.cnpj,
         rc.status_cadastro,
         rc.origem,
         rc.cadastrado_em,
         rc.nome_comprador,
         rc.email_comprador,
         rc.whatsapp_comprador,
         i.code            as codigo_convite,
         i.note            as convite_para,
         quem.full_name    as convidado_por,
         (select string_agg(cm.marca, ', ' order by cm.marca)
            from public.cliente_marcas cm
           where cm.cliente_id = rc.id and cm.ativa) as marcas,
         (select count(*) from public.representative_orders ro
           where ro.representative_client_id = rc.id)::int as pedidos
    from public.representative_clients rc
    left join public.repco_invite_codes i on i.id = rc.convite_id
    left join public.user_profiles quem on quem.id = i.created_by
   where rc.origem = 'autocadastro';

comment on view public.vw_cadastros_pj is
  'Cadastros PJ feitos pelo próprio cliente: empresa, CNPJ, código usado, quem convidou, marcas declaradas e situação.';

grant select on public.vw_cadastros_pj to authenticated;
