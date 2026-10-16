-- =====================================================================
-- Aprovar ou reprovar cadastro de cliente PJ (16/10/2026)
--
-- O cadastro já nasce em 'em_analise' e ninguém tinha como mudar isso pela
-- tela: a passagem para 'aprovado' era feita à mão no banco. Aqui ela ganha
-- porta, dono e histórico.
--
-- TRÊS REGRAS QUE O BANCO PRECISA GARANTIR, não a tela:
--   1. só admin decide;
--   2. o cliente NUNCA mexe na própria situação (nem por API, nem por DevTools);
--   3. aprovar NÃO concede crédito, limite, prazo nem boleto — isso continua
--      sendo decisão comercial separada, feita a dedo pelo admin.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. O histórico das decisões
-- ---------------------------------------------------------------------
-- Tabela própria, e não duas colunas na ficha, porque uma ficha pode ser
-- recusada, corrigida e aprovada depois. Com colunas, a primeira decisão some
-- quando vem a segunda — e é justamente o rastro que se quer guardar.
create table if not exists public.cliente_pj_decisoes (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.representative_clients(id) on delete cascade,
  decisao      text not null check (decisao in ('aprovado', 'recusado')),
  motivo       text,
  decidido_por uuid references auth.users(id) on delete set null,
  decidido_em  timestamptz not null default now()
);

create index if not exists cliente_pj_decisoes_cliente_idx
  on public.cliente_pj_decisoes (cliente_id, decidido_em desc);

comment on table public.cliente_pj_decisoes is
  'Histórico de aprovação/reprovação de cadastro PJ. Append-only: decisão nova não apaga a anterior.';

alter table public.cliente_pj_decisoes enable row level security;

-- Admin lê tudo; gerente e supervisor acompanham. O CLIENTE lê só as decisões
-- da própria ficha — ele tem direito de saber por que foi recusado (LGPD, art.
-- 20: revisão de decisão), mas não vê a de mais ninguém.
create policy cliente_pj_decisoes_leitura
  on public.cliente_pj_decisoes for select
  using (
    public.is_admin()
    or public.has_role('gerente_comercial')
    or public.has_role('supervisor')
    or cliente_id = public.minha_ficha_pj()
  );

-- Escrita: NINGUÉM, por nenhuma policy. A única porta é a RPC abaixo, que é
-- SECURITY DEFINER e confere is_admin(). Sem policy de insert, um cliente não
-- forja uma aprovação nem com a chave anônima na mão.

-- ---------------------------------------------------------------------
-- 2. O cliente não mexe na própria situação
-- ---------------------------------------------------------------------
-- A policy de edição do cliente já congelava crédito, prazo e representante.
-- Faltava congelar `status_cadastro`: sem isto, um `update ... set
-- status_cadastro='aprovado'` na própria ficha passaria.
drop policy if exists cliente_pj_edita_o_rascunho on public.representative_clients;

create policy cliente_pj_edita_o_rascunho
  on public.representative_clients for update
  using (user_id = auth.uid() and status_cadastro = 'rascunho')
  with check (
    user_id = auth.uid()
    -- A situação cadastral só muda pela RPC do admin. Nunca pelo dono da ficha.
    and status_cadastro is not distinct from (select r.status_cadastro from public.representative_clients r where r.id = representative_clients.id)
    and limite_credito    is not distinct from (select r.limite_credito    from public.representative_clients r where r.id = representative_clients.id)
    and credito_score     is not distinct from (select r.credito_score     from public.representative_clients r where r.id = representative_clients.id)
    and forma_pagamento   is not distinct from (select r.forma_pagamento   from public.representative_clients r where r.id = representative_clients.id)
    and prazo_pagamento   is not distinct from (select r.prazo_pagamento   from public.representative_clients r where r.id = representative_clients.id)
    and representative_id is not distinct from (select r.representative_id from public.representative_clients r where r.id = representative_clients.id)
    and company_id        is not distinct from (select r.company_id        from public.representative_clients r where r.id = representative_clients.id)
  );

-- ---------------------------------------------------------------------
-- 3. A decisão
-- ---------------------------------------------------------------------
create or replace function public.cliente_pj_decidir(
  p_cliente uuid,
  p_decisao text,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare ficha public.representative_clients; me uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores decidem cadastros.';
  end if;
  if p_decisao not in ('aprovado', 'recusado') then
    raise exception 'Decisão inválida: %', p_decisao;
  end if;

  select * into ficha from public.representative_clients where id = p_cliente for update;
  if ficha.id is null then raise exception 'Cadastro não encontrado.'; end if;

  -- Recusar sem dizer por quê deixa o cliente sem ação possível, e o admin sem
  -- memória do motivo daqui a três meses.
  if p_decisao = 'recusado' and coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da reprovação.';
  end if;

  -- APENAS a situação cadastral. Crédito, limite, prazo e forma de pagamento
  -- NÃO são tocados aqui, de propósito: aprovar o cadastro é dizer "esta
  -- empresa existe e pode comprar", não "esta empresa tem crédito".
  update public.representative_clients
     set status_cadastro = p_decisao
   where id = p_cliente;

  insert into public.cliente_pj_decisoes (cliente_id, decisao, motivo, decidido_por)
  values (p_cliente, p_decisao, nullif(btrim(coalesce(p_motivo, '')), ''), me);

  return jsonb_build_object(
    'ok', true,
    'status', p_decisao,
    'credito_concedido', false   -- explícito: nunca é concedido aqui
  );
end;
$$;

comment on function public.cliente_pj_decidir is
  'Aprova ou reprova um cadastro PJ. Só admin. Mexe SOMENTE em status_cadastro — não concede crédito, limite, prazo nem boleto. Grava o histórico em cliente_pj_decisoes.';

-- ---------------------------------------------------------------------
-- 4. A visão da administração, agora com a decisão
-- ---------------------------------------------------------------------
drop view if exists public.vw_cadastros_pj;

create view public.vw_cadastros_pj as
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
         rc.endereco_completo,
         i.code         as codigo_convite,
         quem.full_name as convidado_por,
         (select string_agg(cm.marca, ', ' order by cm.marca)
            from public.cliente_marcas cm
           where cm.cliente_id = rc.id and cm.ativa) as marcas,
         (select count(*) from public.representative_orders ro
           where ro.representative_client_id = rc.id)::int as pedidos,
         d.decisao      as ultima_decisao,
         d.motivo       as ultimo_motivo,
         d.decidido_em  as decidido_em,
         dq.full_name   as decidido_por
    from public.representative_clients rc
    left join public.repco_invite_codes i on i.id = rc.convite_id
    left join public.user_profiles quem on quem.id = i.created_by
    left join lateral (
      select * from public.cliente_pj_decisoes x
       where x.cliente_id = rc.id
       order by x.decidido_em desc limit 1
    ) d on true
    left join public.user_profiles dq on dq.id = d.decidido_por
   where rc.origem = 'autocadastro';

comment on view public.vw_cadastros_pj is
  'Cadastros PJ feitos pelo próprio cliente, com a última decisão (quem, quando, por quê).';

grant select on public.vw_cadastros_pj to authenticated;

-- ---------------------------------------------------------------------
-- 5. Quantos esperam decisão — para o sininho
-- ---------------------------------------------------------------------
-- O sininho do admin monta os alertas na hora, consultando tabelas (não existe
-- tabela `notifications`). Esta função é o que ele vai perguntar.
create or replace function public.cadastros_pj_pendentes()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(count(*), 0)::int
    from public.representative_clients rc
   where rc.origem = 'autocadastro'
     and rc.status_cadastro = 'em_analise'
     and (public.is_admin() or public.has_role('gerente_comercial'));
$$;

comment on function public.cadastros_pj_pendentes is
  'Quantos cadastros PJ aguardam decisão. Devolve 0 para quem não é admin nem gerente.';
