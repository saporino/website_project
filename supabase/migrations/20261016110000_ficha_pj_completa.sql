-- =====================================================================
-- Ficha cadastral PJ: contatos por departamento e endereços (16/10/2026)
--
-- O cliente precisa dizer QUEM COMPRA, QUEM PAGA, QUEM RECEBE A NOTA e ONDE
-- ENTREGAR. Hoje a ficha tem três campos soltos (nome_comprador,
-- email_comprador, whatsapp_comprador) e um endereço só.
--
-- DEFEITO QUE ISTO CORRIGE, e que bloquearia tudo:
--   a policy de edição do cliente exige `status_cadastro = 'rascunho'`, mas o
--   cadastro NASCE em 'em_analise'. Resultado: o cliente nunca conseguiu editar
--   a própria ficha. Descoberto conferindo a policy, não o código.
--
-- Regra de quem edita o quê:
--   · contatos, endereços, telefone e observações → o cliente, sempre;
--   · CNPJ, razão social e IE → o cliente até ser aprovado; depois só o admin,
--     porque mudar razão social depois da aprovação muda a nota fiscal;
--   · crédito, limite, prazo, forma de pagamento, representante → só o admin,
--     nunca o cliente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Contatos por departamento
-- ---------------------------------------------------------------------
-- Tabela, e não colunas na ficha, porque uma rede tem comprador titular e
-- substituto, financeiro e financeiro alternativo — e amanhã, contatos por
-- loja. Com colunas, cada caso novo vira ALTER TABLE.
create table if not exists public.cliente_contatos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.representative_clients(id) on delete cascade,
  tipo        text not null,
  nome        text not null,
  cargo       text,
  email       text,
  telefone    text,
  whatsapp    text,
  observacoes text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cliente_contatos_tipo_check') then
    alter table public.cliente_contatos add constraint cliente_contatos_tipo_check check (tipo in (
      'comprador', 'comprador_substituto',
      'financeiro', 'financeiro_alternativo',
      'fiscal', 'contabilidade',
      'responsavel_legal', 'proprietario', 'socio_administrador',
      'gerente_comercial', 'gerente_loja',
      'recebimento'
    ));
  end if;
end $$;

create index if not exists cliente_contatos_cliente_idx
  on public.cliente_contatos (cliente_id, tipo) where ativo;

comment on table public.cliente_contatos is
  'Quem compra, quem paga, quem recebe a nota e quem recebe a mercadoria. Um cliente tem vários; o tipo diz o papel.';

alter table public.cliente_contatos enable row level security;

-- O cliente cuida dos próprios contatos. Admin, gerente e supervisor leem;
-- o representante vê os contatos dos clientes da carteira dele.
create policy cliente_contatos_do_cliente
  on public.cliente_contatos for all
  using (cliente_id = public.minha_ficha_pj())
  with check (cliente_id = public.minha_ficha_pj());

create policy cliente_contatos_gestao_le
  on public.cliente_contatos for select
  using (
    public.is_admin()
    or public.has_role('gerente_comercial')
    or public.has_role('supervisor')
    or public.has_role('contabilidade')
    or exists (select 1 from public.representative_clients rc
                where rc.id = cliente_contatos.cliente_id
                  and rc.representative_id = public.my_rep_id())
  );

create policy cliente_contatos_admin_escreve
  on public.cliente_contatos for all
  using (public.is_admin() or public.has_role('gerente_comercial'))
  with check (public.is_admin() or public.has_role('gerente_comercial'));

-- ---------------------------------------------------------------------
-- 2. O que faltava na ficha
-- ---------------------------------------------------------------------
alter table public.representative_clients
  add column if not exists telefone_comercial text,
  add column if not exists email_institucional text,
  add column if not exists observacoes_cadastrais text,
  -- Endereço de ENTREGA, separado do cadastral. Quase sempre é o mesmo — por
  -- isso o booleano: marcar "é o mesmo" evita digitar duas vezes, e deixa
  -- explícito que foi uma escolha, não um campo esquecido em branco.
  add column if not exists entrega_mesmo_endereco boolean not null default true,
  add column if not exists entrega_cep text,
  add column if not exists entrega_logradouro text,
  add column if not exists entrega_numero text,
  add column if not exists entrega_complemento text,
  add column if not exists entrega_bairro text,
  add column if not exists entrega_municipio text,
  add column if not exists entrega_uf text,
  add column if not exists entrega_referencia text,
  add column if not exists ficha_atualizada_em timestamptz;

comment on column public.representative_clients.entrega_mesmo_endereco is
  'true = entregar no endereço cadastral. false = usar os campos entrega_*.';
comment on column public.representative_clients.observacoes_cadastrais is
  'Observações do cliente sobre o próprio cadastro. Não é observação interna da COFICO.';

-- ---------------------------------------------------------------------
-- 3. O cliente volta a poder editar a própria ficha
-- ---------------------------------------------------------------------
drop policy if exists cliente_pj_edita_o_rascunho on public.representative_clients;

create policy cliente_pj_edita_a_propria_ficha
  on public.representative_clients for update
  using (
    user_id = auth.uid()
    and status_cadastro in ('rascunho', 'em_analise', 'aprovado')
  )
  with check (
    user_id = auth.uid()
    -- A situação cadastral só muda pela RPC do admin.
    and status_cadastro is not distinct from (select r.status_cadastro from public.representative_clients r where r.id = representative_clients.id)
    -- Condição comercial: nunca pelo cliente.
    and limite_credito    is not distinct from (select r.limite_credito    from public.representative_clients r where r.id = representative_clients.id)
    and credito_score     is not distinct from (select r.credito_score     from public.representative_clients r where r.id = representative_clients.id)
    and forma_pagamento   is not distinct from (select r.forma_pagamento   from public.representative_clients r where r.id = representative_clients.id)
    and prazo_pagamento   is not distinct from (select r.prazo_pagamento   from public.representative_clients r where r.id = representative_clients.id)
    and representative_id is not distinct from (select r.representative_id from public.representative_clients r where r.id = representative_clients.id)
    and company_id        is not distinct from (select r.company_id        from public.representative_clients r where r.id = representative_clients.id)
    and desconto_financeiro_pct is not distinct from (select r.desconto_financeiro_pct from public.representative_clients r where r.id = representative_clients.id)
    and desconto_logistico_pct  is not distinct from (select r.desconto_logistico_pct  from public.representative_clients r where r.id = representative_clients.id)
    -- Identificação fiscal: o cliente corrige enquanto está em análise. Depois
    -- de aprovado, mudar razão social ou CNPJ muda a nota — passa pelo admin.
    and (
      (select r.status_cadastro from public.representative_clients r where r.id = representative_clients.id) <> 'aprovado'
      or (
        cnpj                is not distinct from (select r.cnpj                from public.representative_clients r where r.id = representative_clients.id)
        and razao_social    is not distinct from (select r.razao_social    from public.representative_clients r where r.id = representative_clients.id)
        and inscricao_estadual is not distinct from (select r.inscricao_estadual from public.representative_clients r where r.id = representative_clients.id)
      )
    )
  );

-- ---------------------------------------------------------------------
-- 4. Quanto da ficha está preenchido
-- ---------------------------------------------------------------------
-- O cliente precisa ver o que falta sem ler a ficha inteira, e a Lilian precisa
-- saber de quem cobrar. Calculado no banco: a tela só mostra.
create or replace function public.ficha_pj_completude(p_cliente uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with f as (select * from public.representative_clients where id = p_cliente),
       c as (select tipo from public.cliente_contatos where cliente_id = p_cliente and ativo)
  select jsonb_build_object(
    'empresa',   (select coalesce(btrim(f.razao_social),'') <> '' and coalesce(btrim(f.cnpj),'') <> '' from f),
    'fiscal_ie', (select coalesce(btrim(f.inscricao_estadual),'') <> '' from f),
    'contato',   (select coalesce(btrim(f.telefone_comercial),'') <> '' or coalesce(btrim(f.email_institucional),'') <> '' from f),
    'endereco',  (select coalesce(btrim(f.endereco_completo),'') <> '' from f),
    'comprador', exists (select 1 from c where tipo = 'comprador'),
    'financeiro',exists (select 1 from c where tipo = 'financeiro'),
    'fiscal',    exists (select 1 from c where tipo = 'fiscal'),
    'responsavel', exists (select 1 from c where tipo in ('responsavel_legal','proprietario','socio_administrador','gerente_comercial')),
    'marcas',    exists (select 1 from public.cliente_marcas m where m.cliente_id = p_cliente and m.ativa)
  );
$$;

comment on function public.ficha_pj_completude is
  'Quais seções da ficha já estão preenchidas. Base do "o que falta" na tela do cliente e no painel.';

-- ---------------------------------------------------------------------
-- 5. A administração enxerga a ficha inteira
-- ---------------------------------------------------------------------
drop view if exists public.vw_cadastros_pj;

create view public.vw_cadastros_pj as
  select rc.id,
         rc.razao_social, rc.nome_fantasia, rc.cnpj, rc.inscricao_estadual,
         rc.status_cadastro, rc.origem, rc.cadastrado_em, rc.ficha_atualizada_em,
         rc.telefone_comercial, rc.email_institucional,
         rc.nome_comprador, rc.email_comprador, rc.whatsapp_comprador,
         rc.endereco_completo, rc.cep, rc.municipio, rc.uf, rc.bairro,
         rc.entrega_mesmo_endereco, rc.entrega_cep, rc.entrega_logradouro,
         rc.entrega_numero, rc.entrega_complemento, rc.entrega_bairro,
         rc.entrega_municipio, rc.entrega_uf, rc.entrega_referencia,
         rc.observacoes_cadastrais,
         i.code         as codigo_convite,
         quem.full_name as convidado_por,
         (select string_agg(cm.marca, ', ' order by cm.marca)
            from public.cliente_marcas cm
           where cm.cliente_id = rc.id and cm.ativa) as marcas,
         (select count(*) from public.representative_orders ro
           where ro.representative_client_id = rc.id)::int as pedidos,
         (select jsonb_agg(jsonb_build_object(
                   'tipo', ct.tipo, 'nome', ct.nome, 'cargo', ct.cargo,
                   'email', ct.email, 'telefone', ct.telefone, 'whatsapp', ct.whatsapp)
                 order by ct.tipo)
            from public.cliente_contatos ct
           where ct.cliente_id = rc.id and ct.ativo) as contatos,
         public.ficha_pj_completude(rc.id) as completude,
         d.decisao      as ultima_decisao,
         d.motivo       as ultimo_motivo,
         d.decidido_em  as decidido_em,
         dq.full_name   as decidido_por
    from public.representative_clients rc
    left join public.repco_invite_codes i on i.id = rc.convite_id
    left join public.user_profiles quem on quem.id = i.created_by
    left join lateral (
      select * from public.cliente_pj_decisoes x
       where x.cliente_id = rc.id order by x.decidido_em desc limit 1
    ) d on true
    left join public.user_profiles dq on dq.id = d.decidido_por
   where rc.origem = 'autocadastro';

comment on view public.vw_cadastros_pj is
  'Ficha PJ completa para a administração: empresa, contatos por departamento, endereços, marcas, completude e decisão.';

grant select on public.vw_cadastros_pj to authenticated;

-- ---------------------------------------------------------------------
-- 6. Carimbo de "ficha mexida"
-- ---------------------------------------------------------------------
create or replace function public.marcar_ficha_atualizada()
returns trigger language plpgsql as $$
begin
  new.ficha_atualizada_em := now();
  return new;
end; $$;

drop trigger if exists trg_ficha_pj_atualizada on public.representative_clients;
create trigger trg_ficha_pj_atualizada
  before update on public.representative_clients
  for each row execute function public.marcar_ficha_atualizada();
