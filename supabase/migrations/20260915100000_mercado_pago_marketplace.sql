-- Coffee LiVRE — Unidade 9.1: Mercado Pago em modo marketplace (estrutura + teste).
--
-- DECISÃO DE ARQUITETURA (documentação oficial consultada em 14/09/2026, RAIO-X §17.1.13)
--   O Split de Pagamentos disponível é 1:1: cada pagamento é criado com o
--   access_token OAuth de UM vendedor e leva a comissão da plataforma em
--   `application_fee`. O 1:N depende de contrato comercial. Logo:
--
--     pedido do comprador (lv_orders)
--       → subpedidos (lv_seller_orders)
--         → cobranças (lv_cobrancas): UMA por subpedido, no Mercado Pago do vendedor
--           → application_fee = comissão + tarifa operacional (+ frete do CD, configurável)
--             → reconciliação (lv_mp_reconciliacoes) com o estado oficial do Mercado Pago
--
--   O comprador vê um checkout só; paga uma cobrança por loja.
--
-- SEGURANÇA
--   • Tokens OAuth ficam no Supabase Vault. A tabela de credenciais só guarda o id
--     do segredo e não tem nenhuma permissão para anon/authenticated.
--   • O ambiente sai da marca do banco (ambiente_do_banco): staging = "teste",
--     qualquer outro = "producao". O provedor mock só existe em teste. Em produção
--     o provedor padrão é "desativado" (Mercado Pago real só na U9.2, por ação humana).
--   • Nada de dinheiro é decidido pelo navegador: valores e taxas saem do snapshot
--     do subpedido (U8) e a mudança de status só acontece por função de serviço.

-- =====================================================================
-- 0. Configuração
-- =====================================================================
insert into public.lv_settings (key, value) values
  ('pagamentos', jsonb_build_object(
     'provedor_producao', 'desativado',     -- 'desativado' | 'mercadopago' (somente U9.2, com ação humana)
     'provedor_staging', 'mock',            -- 'mock' | 'mercadopago' (credenciais de teste)
     'frete_no_application_fee', true,      -- frete sai do CD Coffee LiVRE: vai na comissão da plataforma
     'pix_minutos', 30))
on conflict (key) do nothing;

create or replace function public.lv_pagamentos_config()
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (select coalesce((select value from public.lv_settings where key = 'pagamentos'), '{}'::jsonb) as cfg)
  select jsonb_build_object(
    'ambiente', case when public.lv_eh_staging() then 'teste' else 'producao' end,
    'provedor', case
       when public.lv_eh_staging() then case when cfg->>'provedor_staging' = 'mercadopago' then 'mercadopago' else 'mock' end
       -- Produção: mock é impossível; só "mercadopago" liga, e só por decisão explícita.
       else case when cfg->>'provedor_producao' = 'mercadopago' then 'mercadopago' else 'desativado' end end,
    'frete_no_application_fee', coalesce((cfg->>'frete_no_application_fee')::boolean, true),
    'pix_minutos', greatest(30, coalesce((cfg->>'pix_minutos')::int, 30)))
  from c;
$$;

-- =====================================================================
-- 1. Conexão do vendedor com o Mercado Pago (OAuth)
-- =====================================================================
create table if not exists public.lv_mp_conexoes (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references public.lv_sellers(id) on delete cascade,
  ambiente        text not null check (ambiente in ('teste', 'producao')),
  provedor        text not null default 'mercadopago' check (provedor in ('mercadopago', 'mock')),
  status          text not null default 'nao_conectado'
                  check (status in ('nao_conectado', 'conectando', 'conectado', 'atencao', 'expirado', 'desconectado')),
  mp_user_id      text,
  public_key      text,
  escopos         text[] not null default '{}',
  live_mode       boolean,
  conectado_em    timestamptz,
  renovado_em     timestamptz,
  expira_em       timestamptz,
  desconectado_em timestamptz,
  ultimo_erro     text,
  atualizado_em   timestamptz not null default now(),
  unique (seller_id, ambiente)
);
comment on table public.lv_mp_conexoes is
  'Estado da conexao OAuth do vendedor com o Mercado Pago. Nenhum token aqui: tokens ficam no Vault (lv_mp_credenciais).';

-- Só ids de segredos do Vault. Sem nenhuma permissão para o site.
create table if not exists public.lv_mp_credenciais (
  conexao_id        uuid primary key references public.lv_mp_conexoes(id) on delete cascade,
  access_secret_id  uuid not null,
  refresh_secret_id uuid,
  atualizado_em     timestamptz not null default now()
);

create table if not exists public.lv_mp_oauth_estados (
  state_hash         text primary key,
  seller_id          uuid not null references public.lv_sellers(id) on delete cascade,
  user_id            uuid not null,
  ambiente           text not null,
  verifier_secret_id uuid,
  expira_em          timestamptz not null,
  usado_em           timestamptz,
  criado_em          timestamptz not null default now()
);

-- =====================================================================
-- 2. Cobranças (um pagamento no Mercado Pago por subpedido)
-- =====================================================================
create table if not exists public.lv_cobrancas (
  id                              uuid primary key default gen_random_uuid(),
  order_id                        uuid not null references public.lv_orders(id) on delete cascade,
  seller_order_id                 uuid not null references public.lv_seller_orders(id) on delete cascade,
  seller_id                       uuid references public.lv_sellers(id) on delete set null,
  provedor                        text not null check (provedor in ('mock', 'mercadopago')),
  ambiente                        text not null check (ambiente in ('teste', 'producao')),
  metodo                          text not null check (metodo in ('pix', 'cartao')),
  status                          text not null default 'criando'
                                  check (status in ('criando', 'aguardando_pagamento', 'em_analise', 'aprovado', 'recusado',
                                                    'cancelado', 'expirado', 'parcialmente_reembolsado', 'reembolsado',
                                                    'contestado', 'erro')),
  external_reference              text not null,
  idempotency_key                 text not null unique,
  mp_payment_id                   text unique,
  mp_status                       text,
  mp_status_detail                text,
  mp_collector_id                 text,
  -- Snapshot congelado do subpedido (U8) no momento da cobrança.
  valor_cents                     bigint not null check (valor_cents > 0),
  produtos_cents                  bigint not null,
  frete_cents                     bigint not null,
  comissao_cents                  bigint not null,
  tarifa_cents                    bigint not null,
  frete_no_application_fee        boolean not null,
  application_fee_cents           bigint not null check (application_fee_cents >= 0),
  -- Taxa do processador: estimada (hipótese) × real (vem do Mercado Pago). Desconhecida = nulo, nunca zero.
  processor_fee_base              text not null default 'valor_total_estimado',
  processor_fee_bps               integer,
  processor_fee_estimada_cents    bigint,
  processor_fee_real_cents        bigint,
  liquido_seller_estimado_cents   bigint,
  liquido_seller_real_cents       bigint,
  receita_marketplace_estimada_cents bigint not null,
  receita_marketplace_real_cents  bigint,
  reembolsado_cents               bigint not null default 0,
  pix_qr_code                     text,
  pix_qr_base64                   text,
  pix_ticket_url                  text,
  expira_em                       timestamptz,
  status_remoto                   text,
  ultima_reconciliacao_em         timestamptz,
  divergencia                     text,
  precisa_atencao                 boolean not null default false,
  ultimo_erro                     text,
  aprovado_em                     timestamptz,
  criado_em                       timestamptz not null default now(),
  atualizado_em                   timestamptz not null default now()
);
create index if not exists lv_cobrancas_por_pedido on public.lv_cobrancas (order_id);
create index if not exists lv_cobrancas_por_vendedor on public.lv_cobrancas (seller_id, criado_em desc);
create index if not exists lv_cobrancas_atencao on public.lv_cobrancas (precisa_atencao) where precisa_atencao;
-- Uma cobrança "viva" por subpedido: cartão recusado permite tentar de novo; aprovado, não.
create unique index if not exists lv_cobrancas_uma_viva_por_subpedido on public.lv_cobrancas (seller_order_id)
  where status in ('criando', 'aguardando_pagamento', 'em_analise', 'aprovado', 'parcialmente_reembolsado', 'reembolsado', 'contestado');
comment on table public.lv_cobrancas is
  'Um pagamento por subpedido (Split 1:1 do Mercado Pago). Valores congelados do subpedido; taxa do processador estimada e real separadas.';

-- Estado remoto do provedor MOCK (só staging). Faz o papel do GET /v1/payments nos testes.
create table if not exists public.lv_mp_mock_remoto (
  mp_payment_id          text primary key,
  cobranca_id            uuid references public.lv_cobrancas(id) on delete cascade,
  status                 text not null,
  status_detail          text,
  collector_id           text,
  live_mode              boolean not null default false,
  transaction_amount_cents bigint not null,
  processor_fee_cents    bigint,
  application_fee_cents  bigint,
  net_received_cents     bigint,
  refunded_cents         bigint not null default 0,
  reembolsos             jsonb not null default '[]'::jsonb,
  atualizado_em          timestamptz not null default now()
);

create table if not exists public.lv_mp_webhook_eventos (
  id                uuid primary key default gen_random_uuid(),
  provedor          text not null,
  request_id        text not null,
  tipo              text,
  acao              text,
  data_id           text,
  mp_user_id        text,
  live_mode         boolean,
  assinatura_valida boolean not null,
  resultado         text,
  erro              text,
  recebido_em       timestamptz not null default now(),
  processado_em     timestamptz,
  unique (provedor, request_id)
);

create table if not exists public.lv_mp_reconciliacoes (
  id                  uuid primary key default gen_random_uuid(),
  cobranca_id         uuid not null references public.lv_cobrancas(id) on delete cascade,
  origem              text not null check (origem in ('criacao', 'webhook', 'rotina', 'admin', 'pagamento')),
  status_local_antes  text,
  status_local_depois text,
  status_remoto       text,
  divergente          boolean not null,
  acao                text not null,
  erro                text,
  consultado_em       timestamptz not null default now()
);
create index if not exists lv_mp_reconciliacoes_por_cobranca on public.lv_mp_reconciliacoes (cobranca_id, consultado_em desc);

-- Reembolso: estados da U9 e ligação com a cobrança e o provedor.
alter table public.lv_refunds
  add column if not exists cobranca_id uuid references public.lv_cobrancas(id) on delete set null,
  add column if not exists provedor text,
  add column if not exists provider_refund_id text,
  add column if not exists idempotency_key text,
  add column if not exists tentativas integer not null default 0,
  add column if not exists erro text;
alter table public.lv_refunds drop constraint if exists lv_refunds_status_check;
update public.lv_refunds set status = case status
  when 'pendente' then 'refund_pending' when 'aprovado' then 'refund_processing'
  when 'concluido' then 'refunded' when 'recusado' then 'refund_failed' else status end;
alter table public.lv_refunds alter column status set default 'refund_pending';
alter table public.lv_refunds add constraint lv_refunds_status_check
  check (status in ('refund_pending', 'refund_processing', 'refunded', 'refund_failed', 'manual_review'));
update public.lv_refunds set idempotency_key = gen_random_uuid()::text where idempotency_key is null;
alter table public.lv_refunds alter column idempotency_key set default gen_random_uuid()::text;
alter table public.lv_refunds alter column idempotency_key set not null;
create unique index if not exists lv_refunds_idempotency on public.lv_refunds (idempotency_key);
create unique index if not exists lv_refunds_um_aberto_por_cobranca on public.lv_refunds (cobranca_id)
  where cobranca_id is not null and status in ('refund_pending', 'refund_processing', 'manual_review');

-- =====================================================================
-- 3. Estados da cobrança (mesma tabela de _shared/lvMp/status.ts)
-- =====================================================================
create or replace function public.lv_mp_status_local(p_status text, p_detalhe text)
returns text language sql immutable as $$
  select case p_status
    when 'pending' then 'aguardando_pagamento'
    when 'authorized' then 'em_analise'
    when 'in_process' then 'em_analise'
    -- Reembolso parcial mantém o pagamento "approved"; o detalhe diz que foi parcial
    -- (valor do detalhe não confirmado na documentação: usado pelo mock e revisto na U9.2).
    when 'approved' then case when p_detalhe = 'partially_refunded' then 'parcialmente_reembolsado' else 'aprovado' end
    when 'rejected' then 'recusado'
    when 'cancelled' then case when p_detalhe = 'expired' then 'expirado' else 'cancelado' end
    when 'refunded' then 'reembolsado'
    when 'charged_back' then 'contestado'
    when 'in_mediation' then 'contestado'
    else null end;
$$;

create or replace function public.lv_mp_rank(p_status text)
returns integer language sql immutable as $$
  select case p_status
    when 'criando' then 0 when 'aguardando_pagamento' then 1 when 'em_analise' then 2
    when 'recusado' then 3 when 'cancelado' then 3 when 'expirado' then 3 when 'erro' then 3
    when 'aprovado' then 4 when 'parcialmente_reembolsado' then 5 when 'contestado' then 5
    when 'reembolsado' then 6 else -1 end;
$$;

-- Sem regressão: só avança. Exceção: contestação ganha volta a aprovado.
create or replace function public.lv_mp_pode_transicionar(p_de text, p_para text)
returns boolean language sql immutable as $$
  select p_de is distinct from p_para
     and (public.lv_mp_rank(p_para) > public.lv_mp_rank(p_de) or (p_de = 'contestado' and p_para = 'aprovado'));
$$;

-- =====================================================================
-- 4. Funções de conexão (Vault)
-- =====================================================================
create or replace function public.lv_mp_ambiente()
returns text language sql stable security definer set search_path = public as $$
  select case when public.lv_eh_staging() then 'teste' else 'producao' end;
$$;

-- O vendedor logado começa a conectar a PRÓPRIA conta. Devolve o vendedor.
create or replace function public.lv_mp_conexao_iniciar()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_seller uuid; v_amb text := public.lv_mp_ambiente();
begin
  select seller_id into v_seller from public.lv_seller_users where user_id = auth.uid() order by created_at limit 1;
  if v_seller is null then
    raise exception 'Esta conta não está ligada a um vendedor.' using errcode = 'P0001', hint = 'SEM_VENDEDOR';
  end if;
  insert into public.lv_mp_conexoes (seller_id, ambiente, status, atualizado_em)
  values (v_seller, v_amb, 'conectando', now())
  on conflict (seller_id, ambiente) do update
    set status = case when public.lv_mp_conexoes.status = 'conectado' then 'conectado' else 'conectando' end,
        atualizado_em = now();
  return jsonb_build_object('seller_id', v_seller, 'ambiente', v_amb);
end $$;

create or replace function public.lv_mp_oauth_estado_gravar(p_state_hash text, p_seller uuid, p_user uuid, p_verifier text, p_minutos integer)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid;
begin
  if p_verifier is not null then v_id := vault.create_secret(p_verifier, null, 'lv_mp pkce verifier'); end if;
  insert into public.lv_mp_oauth_estados (state_hash, seller_id, user_id, ambiente, verifier_secret_id, expira_em)
  values (p_state_hash, p_seller, p_user, public.lv_mp_ambiente(), v_id, now() + make_interval(mins => greatest(1, p_minutos)));
end $$;

-- Uso único: devolve vendedor e verifier, apaga o verifier e marca o estado como usado.
create or replace function public.lv_mp_oauth_estado_consumir(p_state_hash text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, vault as $$
declare e public.lv_mp_oauth_estados; v_verifier text;
begin
  select * into e from public.lv_mp_oauth_estados where state_hash = p_state_hash for update;
  if e.state_hash is null or e.usado_em is not null or e.expira_em < now() or e.user_id <> p_user or e.ambiente <> public.lv_mp_ambiente() then
    raise exception 'Autorização inválida ou expirada. Conecte de novo.' using errcode = 'P0001', hint = 'OAUTH_ESTADO_INVALIDO';
  end if;
  if e.verifier_secret_id is not null then
    select decrypted_secret into v_verifier from vault.decrypted_secrets where id = e.verifier_secret_id;
    delete from vault.secrets where id = e.verifier_secret_id;
  end if;
  update public.lv_mp_oauth_estados set usado_em = now(), verifier_secret_id = null where state_hash = p_state_hash;
  return jsonb_build_object('seller_id', e.seller_id, 'verifier', v_verifier);
end $$;

create or replace function public.lv_mp_credencial_gravar(
  p_seller uuid, p_provedor text, p_access text, p_refresh text, p_mp_user_id text, p_public_key text,
  p_escopos text[], p_expira_em timestamptz, p_live_mode boolean, p_renovacao boolean)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_amb text := public.lv_mp_ambiente(); c public.lv_mp_conexoes; cr public.lv_mp_credenciais;
begin
  if p_access is null or length(p_access) < 10 then
    raise exception 'Token inválido.' using errcode = 'P0001', hint = 'TOKEN_INVALIDO';
  end if;
  if p_provedor = 'mock' and v_amb <> 'teste' then
    raise exception 'Provedor mock não existe em produção.' using errcode = 'P0001', hint = 'MOCK_EM_PRODUCAO';
  end if;
  -- live_mode informado pelo Mercado Pago precisa bater com o ambiente.
  if p_live_mode is not null and ((v_amb = 'teste' and p_live_mode) or (v_amb = 'producao' and not p_live_mode)) then
    raise exception 'Credencial de outro ambiente (live_mode=%).', p_live_mode using errcode = 'P0001', hint = 'AMBIENTE_ERRADO';
  end if;
  insert into public.lv_mp_conexoes (seller_id, ambiente, provedor, status)
  values (p_seller, v_amb, p_provedor, 'conectado')
  on conflict (seller_id, ambiente) do nothing;
  select * into c from public.lv_mp_conexoes where seller_id = p_seller and ambiente = v_amb for update;
  select * into cr from public.lv_mp_credenciais where conexao_id = c.id for update;
  if cr.conexao_id is null then
    insert into public.lv_mp_credenciais (conexao_id, access_secret_id, refresh_secret_id)
    values (c.id, vault.create_secret(p_access, null, 'lv_mp access'),
            case when p_refresh is null then null else vault.create_secret(p_refresh, null, 'lv_mp refresh') end);
  else
    perform vault.update_secret(cr.access_secret_id, p_access);
    if p_refresh is not null then
      if cr.refresh_secret_id is null then
        update public.lv_mp_credenciais set refresh_secret_id = vault.create_secret(p_refresh, null, 'lv_mp refresh') where conexao_id = c.id;
      else
        perform vault.update_secret(cr.refresh_secret_id, p_refresh);
      end if;
    end if;
    update public.lv_mp_credenciais set atualizado_em = now() where conexao_id = c.id;
  end if;
  update public.lv_mp_conexoes
     set provedor = p_provedor, status = 'conectado', mp_user_id = p_mp_user_id, public_key = p_public_key,
         escopos = coalesce(p_escopos, '{}'), live_mode = p_live_mode, expira_em = p_expira_em,
         conectado_em = case when p_renovacao then conectado_em else now() end,
         renovado_em = case when p_renovacao then now() else renovado_em end,
         desconectado_em = null, ultimo_erro = null, atualizado_em = now()
   where id = c.id;
end $$;

create or replace function public.lv_mp_credencial_ler(p_seller uuid)
returns jsonb language plpgsql security definer set search_path = public, vault as $$
declare c public.lv_mp_conexoes; cr public.lv_mp_credenciais; v_access text; v_refresh text;
begin
  select * into c from public.lv_mp_conexoes where seller_id = p_seller and ambiente = public.lv_mp_ambiente();
  if c.id is null then return null; end if;
  select * into cr from public.lv_mp_credenciais where conexao_id = c.id;
  if cr.conexao_id is not null then
    select decrypted_secret into v_access from vault.decrypted_secrets where id = cr.access_secret_id;
    if cr.refresh_secret_id is not null then
      select decrypted_secret into v_refresh from vault.decrypted_secrets where id = cr.refresh_secret_id;
    end if;
  end if;
  return jsonb_build_object('conexao_id', c.id, 'status', c.status, 'provedor', c.provedor, 'mp_user_id', c.mp_user_id,
    'expira_em', c.expira_em, 'live_mode', c.live_mode, 'access_token', v_access, 'refresh_token', v_refresh);
end $$;

-- Achar o vendedor pelo user_id do Mercado Pago (notificação traz user_id).
create or replace function public.lv_mp_seller_por_mp_user(p_mp_user_id text)
returns uuid language sql stable security definer set search_path = public as $$
  select seller_id from public.lv_mp_conexoes where mp_user_id = p_mp_user_id and ambiente = public.lv_mp_ambiente() limit 1;
$$;

create or replace function public.lv_mp_conexao_marcar(p_seller uuid, p_status text, p_erro text)
returns void language sql security definer set search_path = public as $$
  update public.lv_mp_conexoes set status = p_status, ultimo_erro = left(p_erro, 300), atualizado_em = now()
   where seller_id = p_seller and ambiente = public.lv_mp_ambiente();
$$;

-- Desconectar: o próprio vendedor, um admin ou a operação. Apaga os segredos do Vault.
create or replace function public.lv_mp_desconectar(p_seller uuid default null)
returns jsonb language plpgsql security definer set search_path = public, vault as $$
declare v_seller uuid := p_seller; c public.lv_mp_conexoes; cr public.lv_mp_credenciais;
begin
  if v_seller is null then
    select seller_id into v_seller from public.lv_seller_users where user_id = auth.uid() order by created_at limit 1;
  end if;
  if v_seller is null or not (public.lv_chamada_privilegiada() or v_seller = any(public.lv_meus_vendedores())) then
    raise exception 'Vendedor não encontrado.' using errcode = 'P0001', hint = 'SEM_VENDEDOR';
  end if;
  select * into c from public.lv_mp_conexoes where seller_id = v_seller and ambiente = public.lv_mp_ambiente() for update;
  if c.id is null then return jsonb_build_object('status', 'nao_conectado'); end if;
  select * into cr from public.lv_mp_credenciais where conexao_id = c.id;
  if cr.conexao_id is not null then
    delete from vault.secrets where id in (cr.access_secret_id, cr.refresh_secret_id);
    delete from public.lv_mp_credenciais where conexao_id = c.id;
  end if;
  update public.lv_mp_conexoes set status = 'desconectado', desconectado_em = now(), atualizado_em = now() where id = c.id;
  return jsonb_build_object('status', 'desconectado');
end $$;

create or replace function public.lv_mp_conexoes_a_renovar(p_dias integer)
returns table (seller_id uuid, expira_em timestamptz)
language sql stable security definer set search_path = public as $$
  select c.seller_id, c.expira_em from public.lv_mp_conexoes c
   where c.ambiente = public.lv_mp_ambiente() and c.status in ('conectado', 'atencao')
     and c.expira_em is not null and c.expira_em < now() + make_interval(days => p_dias);
$$;

-- =====================================================================
-- 5. Estoque e pagamento por subpedido
-- =====================================================================
create or replace function public.lv_confirmar_reservas_sub(p_seller_order uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_n integer := 0;
begin
  for r in select id, lot_id, quantidade from public.lv_stock_reservations
            where seller_order_id = p_seller_order and status = 'ativa' order by lot_id for update loop
    if r.lot_id is not null then
      update public.lv_inventory_lots set qtd_reservada = greatest(0, qtd_reservada - r.quantidade) where id = r.lot_id;
    end if;
    update public.lv_stock_reservations set status = 'confirmada', encerrada_em = now() where id = r.id;
    v_n := v_n + r.quantidade;
  end loop;
  return v_n;
end $$;

-- Quando nenhum subpedido ativo aguarda mais pagamento, o pedido pai está pago.
create or replace function public.lv_pedido_recalcular_pagamento(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ord public.lv_orders; v_aguardando integer; v_ativos integer; v_prov text;
begin
  select * into v_ord from public.lv_orders where id = p_order for update;
  if v_ord.status <> 'aguardando_pagamento' then return; end if;
  select count(*) filter (where status = 'aguardando_pagamento'), count(*) filter (where status <> 'cancelado')
    into v_aguardando, v_ativos from public.lv_seller_orders where order_id = p_order;
  if v_aguardando > 0 or v_ativos = 0 then return; end if;
  select provedor into v_prov from public.lv_cobrancas where order_id = p_order and status = 'aprovado' order by aprovado_em limit 1;
  update public.lv_payments set status = 'aprovado', provedor = coalesce(v_prov, provedor)
   where order_id = p_order and status in ('aguardando_pagamento', 'recusado');
  update public.lv_orders set status = 'pago', pago_em = now(), pagamento_status = 'aprovado' where id = p_order;
  perform public.lv_registrar_evento_pedido(p_order, null, 'pagamento_aprovado', 'pagamento',
    jsonb_build_object('provedor', v_prov, 'valor_cents', v_ord.total_cents));
end $$;

-- Prepara as cobranças de um pedido (uma por subpedido que aguarda pagamento).
-- Chamado pelo COMPRADOR (via Edge Function, com o JWT dele). Idempotente.
create or replace function public.lv_cobranca_preparar(p_order uuid, p_metodo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg jsonb := public.lv_pagamentos_config();
  v_prov text := v_cfg->>'provedor';
  v_ord public.lv_orders;
  so record;
  v_viva public.lv_cobrancas;
  v_id uuid;
  v_expira timestamptz;
  v_bps integer;
  v_fee_est bigint;
  v_app bigint;
  v_produtos bigint;
  v_frete_fee boolean := (v_cfg->>'frete_no_application_fee')::boolean;
  v_lista jsonb := '[]'::jsonb;
begin
  if v_prov = 'desativado' then
    raise exception 'Pagamento online ainda não está ativo neste ambiente.' using errcode = 'P0001', hint = 'PAGAMENTO_DESATIVADO';
  end if;
  if p_metodo not in ('pix', 'cartao') then
    raise exception 'Forma de pagamento indisponível.' using errcode = 'P0001', hint = 'PAGAMENTO_INVALIDO';
  end if;
  select * into v_ord from public.lv_orders where id = p_order for update;
  if v_ord.id is null or not (v_ord.user_id = auth.uid() or public.lv_chamada_privilegiada()) then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001', hint = 'PEDIDO_INEXISTENTE';
  end if;
  if v_ord.status <> 'aguardando_pagamento' then
    raise exception 'Este pedido não aguarda pagamento.' using errcode = 'P0001', hint = 'PEDIDO_NAO_AGUARDA';
  end if;

  for so in
    select s.*, (s.politica_comercial->>'plano') as plano
      from public.lv_seller_orders s where s.order_id = p_order and s.status = 'aguardando_pagamento' order by s.numero
  loop
    select * into v_viva from public.lv_cobrancas where seller_order_id = so.id
       and status in ('criando', 'aguardando_pagamento', 'em_analise', 'aprovado', 'parcialmente_reembolsado', 'reembolsado', 'contestado');
    if v_viva.id is not null then
      if v_viva.metodo <> p_metodo and v_viva.status in ('aguardando_pagamento', 'em_analise') then
        raise exception 'Já existe um pagamento em andamento para %.', so.loja_nome using errcode = 'P0001', hint = 'COBRANCA_EM_ANDAMENTO';
      end if;
      v_lista := v_lista || to_jsonb(v_viva) || jsonb_build_object('repetida', true, 'loja_nome', so.loja_nome, 'subpedido', so.numero);
      continue;
    end if;
    if so.comissao_plataforma_cents is null or so.tarifa_operacional_cents is null then
      raise exception 'Política comercial incompleta para %: não é possível calcular a comissão.', so.loja_nome
        using errcode = 'P0001', hint = 'POLITICA_INCOMPLETA';
    end if;
    select min(expira_em) into v_expira from public.lv_stock_reservations where seller_order_id = so.id and status = 'ativa';
    if v_expira is null or v_expira < now() then
      raise exception 'O prazo para pagar este pedido acabou.' using errcode = 'P0001', hint = 'RESERVA_EXPIRADA';
    end if;
    v_produtos := so.subtotal_produtos_cents - so.desconto_produtos_cents;
    v_app := so.comissao_plataforma_cents + so.tarifa_operacional_cents + case when v_frete_fee then so.frete_cents else 0 end;
    -- Estimativa da taxa do processador sobre o VALOR TOTAL da cobrança (produtos + frete): no Split 1:1
    -- a taxa do Mercado Pago é descontada do pagamento recebido pelo vendedor. A base exata não está
    -- confirmada na documentação; o valor real vem da reconciliação.
    select percentual_bps into v_bps from public.lv_regra_livre(coalesce(so.plano, 'zero'), 'pagamento', p_metodo, so.total_cents, null, null);
    v_fee_est := public.lv_aplicar_bps(so.total_cents, v_bps);
    v_id := gen_random_uuid();
    insert into public.lv_cobrancas (
      id, order_id, seller_order_id, seller_id, provedor, ambiente, metodo, external_reference, idempotency_key,
      valor_cents, produtos_cents, frete_cents, comissao_cents, tarifa_cents, frete_no_application_fee, application_fee_cents,
      processor_fee_bps, processor_fee_estimada_cents, liquido_seller_estimado_cents, receita_marketplace_estimada_cents, expira_em)
    values (
      v_id, p_order, so.id, so.seller_id, v_prov, v_cfg->>'ambiente', p_metodo, 'lv:' || v_id::text, gen_random_uuid()::text,
      so.total_cents, v_produtos, so.frete_cents, so.comissao_plataforma_cents, so.tarifa_operacional_cents, v_frete_fee, v_app,
      v_bps, v_fee_est, case when v_fee_est is null then null else so.total_cents - v_fee_est - v_app end, v_app,
      least(v_expira, now() + make_interval(days => 1)));
    select * into v_viva from public.lv_cobrancas where id = v_id;
    v_lista := v_lista || to_jsonb(v_viva) || jsonb_build_object('repetida', false, 'loja_nome', so.loja_nome, 'subpedido', so.numero);
  end loop;

  return jsonb_build_object('order_id', p_order, 'numero', v_ord.numero, 'provedor', v_prov, 'ambiente', v_cfg->>'ambiente',
    'comprador_email', v_ord.comprador_email, 'comprador_nome', v_ord.comprador_nome, 'cobrancas', v_lista);
end $$;

-- A Edge Function registra o que o provedor respondeu na criação.
create or replace function public.lv_cobranca_registrar_criacao(p_cobranca uuid, p_remoto jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.lv_cobrancas
     set mp_payment_id = coalesce(mp_payment_id, p_remoto->>'id'),
         pix_qr_code = coalesce(p_remoto->'pix'->>'qr_code', pix_qr_code),
         pix_qr_base64 = coalesce(p_remoto->'pix'->>'qr_base64', pix_qr_base64),
         pix_ticket_url = coalesce(p_remoto->'pix'->>'ticket_url', pix_ticket_url),
         expira_em = coalesce((p_remoto->'pix'->>'expira_em')::timestamptz, expira_em),
         status = case when status = 'criando' then 'aguardando_pagamento' else status end,
         atualizado_em = now()
   where id = p_cobranca;
  return public.lv_cobranca_aplicar(p_cobranca, p_remoto, 'criacao');
end $$;

create or replace function public.lv_cobranca_falhou(p_cobranca uuid, p_erro text)
returns void language sql security definer set search_path = public as $$
  update public.lv_cobrancas set status = case when status = 'criando' then 'erro' else status end,
         ultimo_erro = left(p_erro, 300), precisa_atencao = true, atualizado_em = now()
   where id = p_cobranca;
$$;

-- Aplica o estado OFICIAL do provedor à cobrança. Idempotente e sem regressão.
-- Fonte: webhook (depois de buscar o pagamento), rotina de reconciliação, admin ou criação.
create or replace function public.lv_cobranca_aplicar(p_cobranca uuid, p_remoto jsonb, p_origem text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.lv_cobrancas;
  v_antes text;
  v_novo text;
  v_mudou boolean := false;
  v_so public.lv_seller_orders;
  v_ord public.lv_orders;
  v_acao text;
begin
  select * into c from public.lv_cobrancas where id = p_cobranca for update;
  if c.id is null then
    raise exception 'Cobrança não encontrada.' using errcode = 'P0001', hint = 'COBRANCA_INEXISTENTE';
  end if;
  v_antes := c.status;
  v_novo := public.lv_mp_status_local(p_remoto->>'status', p_remoto->>'status_detail');
  if v_novo is null then
    insert into public.lv_mp_reconciliacoes (cobranca_id, origem, status_local_antes, status_local_depois, status_remoto, divergente, acao, erro)
    values (c.id, p_origem, v_antes, v_antes, p_remoto->>'status', true, 'status_desconhecido', 'status remoto sem mapeamento');
    update public.lv_cobrancas set precisa_atencao = true, divergencia = 'status remoto desconhecido: ' || coalesce(p_remoto->>'status', '?') where id = c.id;
    return jsonb_build_object('status', v_antes, 'mudou', false, 'acao', 'status_desconhecido');
  end if;
  if c.mp_payment_id is not null and p_remoto ? 'id' and c.mp_payment_id <> p_remoto->>'id' then
    raise exception 'Pagamento remoto não corresponde a esta cobrança.' using errcode = 'P0001', hint = 'PAGAMENTO_TROCADO';
  end if;

  update public.lv_cobrancas set
    mp_payment_id = coalesce(mp_payment_id, p_remoto->>'id'),
    mp_status = p_remoto->>'status', mp_status_detail = p_remoto->>'status_detail', status_remoto = p_remoto->>'status',
    mp_collector_id = coalesce(p_remoto->>'collector_id', mp_collector_id),
    processor_fee_real_cents = coalesce((p_remoto->>'processor_fee_cents')::bigint, processor_fee_real_cents),
    liquido_seller_real_cents = coalesce((p_remoto->>'net_received_cents')::bigint, liquido_seller_real_cents),
    receita_marketplace_real_cents = coalesce((p_remoto->>'application_fee_cents')::bigint, receita_marketplace_real_cents),
    reembolsado_cents = greatest(reembolsado_cents, coalesce((p_remoto->>'refunded_cents')::bigint, 0)),
    ultima_reconciliacao_em = now(), atualizado_em = now()
  where id = c.id;

  if public.lv_mp_pode_transicionar(v_antes, v_novo) then
    v_mudou := true;
    update public.lv_cobrancas set status = v_novo,
      aprovado_em = case when v_novo = 'aprovado' then coalesce(aprovado_em, now()) else aprovado_em end,
      precisa_atencao = (v_novo in ('contestado', 'erro')), divergencia = null
    where id = c.id;

    if v_novo = 'aprovado' then
      select * into v_so from public.lv_seller_orders where id = c.seller_order_id for update;
      select * into v_ord from public.lv_orders where id = c.order_id for update;
      if v_so.status = 'aguardando_pagamento' and v_ord.status = 'aguardando_pagamento' then
        perform public.lv_confirmar_reservas_sub(v_so.id);
        update public.lv_seller_orders set status = 'confirmado' where id = v_so.id;
        perform public.lv_registrar_evento_pedido(v_ord.id, v_so.id, 'cobranca_aprovada', 'pagamento',
          jsonb_build_object('provedor', c.provedor, 'valor_cents', c.valor_cents, 'mp_payment_id', coalesce(c.mp_payment_id, p_remoto->>'id')));
        perform public.lv_registrar_evento_pedido(v_ord.id, v_so.id, 'seller_notificado', 'sistema',
          jsonb_build_object('loja', v_so.loja_nome, 'canal', 'seller_central'));
        perform public.lv_pedido_recalcular_pagamento(v_ord.id);
      else
        -- Pagou depois de o subpedido ser cancelado/expirado: estoque NÃO baixa; o dinheiro precisa voltar.
        if not exists (select 1 from public.lv_refunds where cobranca_id = c.id) then
          insert into public.lv_refunds (order_id, seller_order_id, cobranca_id, provedor, tipo, valor_cents, motivo)
          values (c.order_id, c.seller_order_id, c.id, c.provedor, 'total', c.valor_cents, 'pagamento aprovado depois do cancelamento');
          perform public.lv_registrar_evento_pedido(c.order_id, c.seller_order_id, 'pagamento_apos_cancelamento', 'pagamento',
            jsonb_build_object('provedor', c.provedor, 'valor_cents', c.valor_cents));
          perform public.lv_registrar_evento_pedido(c.order_id, c.seller_order_id, 'reembolso_solicitado', 'sistema',
            jsonb_build_object('valor_cents', c.valor_cents, 'status', 'refund_pending'));
        end if;
        update public.lv_cobrancas set precisa_atencao = true, divergencia = 'pagamento aprovado depois do cancelamento' where id = c.id;
      end if;
    elsif v_novo in ('reembolsado', 'parcialmente_reembolsado') then
      if v_novo = 'reembolsado' then
        update public.lv_refunds set status = 'refunded', updated_at = now()
         where cobranca_id = c.id and status in ('refund_pending', 'refund_processing');
      end if;
      perform public.lv_registrar_evento_pedido(c.order_id, c.seller_order_id, 'reembolso_' || v_novo, 'pagamento',
        jsonb_build_object('reembolsado_cents', coalesce((p_remoto->>'refunded_cents')::bigint, 0)));
    elsif v_novo = 'contestado' then
      perform public.lv_registrar_evento_pedido(c.order_id, c.seller_order_id, 'contestacao_aberta', 'pagamento', '{}'::jsonb);
    elsif v_novo in ('recusado', 'cancelado', 'expirado') then
      perform public.lv_registrar_evento_pedido(c.order_id, c.seller_order_id, 'cobranca_' || v_novo, 'pagamento',
        jsonb_build_object('status_detail', p_remoto->>'status_detail'));
    end if;
    v_acao := 'aplicado';
  elsif v_antes = v_novo then
    v_acao := 'sem_mudanca';
  else
    -- O provedor diz algo "anterior" ao que já registramos (ex.: aprovado → pendente): não aplicar, sinalizar.
    update public.lv_cobrancas set precisa_atencao = true,
      divergencia = format('provedor informou %s depois de %s (não aplicado)', v_novo, v_antes)
    where id = c.id;
    v_acao := 'regressao_recusada';
  end if;

  insert into public.lv_mp_reconciliacoes (cobranca_id, origem, status_local_antes, status_local_depois, status_remoto, divergente, acao)
  values (c.id, p_origem, v_antes, (select status from public.lv_cobrancas where id = c.id), p_remoto->>'status', v_antes <> v_novo, v_acao);

  return jsonb_build_object('status', (select status from public.lv_cobrancas where id = c.id), 'antes', v_antes,
    'mudou', v_mudou, 'acao', v_acao);
end $$;

-- Reembolso: admin pede; a Edge Function executa no provedor.
create or replace function public.lv_reembolso_solicitar(p_cobranca uuid, p_valor_cents bigint, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.lv_cobrancas; v_ref public.lv_refunds;
begin
  if not public.lv_chamada_privilegiada() then
    raise exception 'Somente a equipe solicita reembolso.' using errcode = 'P0001', hint = 'SEM_PERMISSAO';
  end if;
  select * into c from public.lv_cobrancas where id = p_cobranca for update;
  if c.id is null or c.status not in ('aprovado', 'parcialmente_reembolsado') then
    raise exception 'Só cobrança aprovada pode ser reembolsada.' using errcode = 'P0001', hint = 'REEMBOLSO_INVALIDO';
  end if;
  select * into v_ref from public.lv_refunds where cobranca_id = c.id and status in ('refund_pending', 'refund_processing', 'manual_review');
  if v_ref.id is not null then
    return jsonb_build_object('refund_id', v_ref.id, 'status', v_ref.status, 'repetido', true);
  end if;
  if p_valor_cents is not null and (p_valor_cents <= 0 or p_valor_cents > c.valor_cents - c.reembolsado_cents) then
    raise exception 'Valor de reembolso inválido.' using errcode = 'P0001', hint = 'REEMBOLSO_INVALIDO';
  end if;
  insert into public.lv_refunds (order_id, seller_order_id, cobranca_id, provedor, tipo, valor_cents, motivo)
  values (c.order_id, c.seller_order_id, c.id, c.provedor, case when p_valor_cents is null then 'total' else 'parcial' end,
          coalesce(p_valor_cents, c.valor_cents - c.reembolsado_cents), coalesce(nullif(btrim(p_motivo), ''), 'reembolso solicitado pela equipe'))
  returning * into v_ref;
  perform public.lv_registrar_evento_pedido(c.order_id, c.seller_order_id, 'reembolso_solicitado', 'admin',
    jsonb_build_object('valor_cents', v_ref.valor_cents, 'status', v_ref.status));
  return jsonb_build_object('refund_id', v_ref.id, 'status', v_ref.status, 'repetido', false);
end $$;

create or replace function public.lv_reembolso_aplicar(p_refund uuid, p_status text, p_provider_refund_id text, p_erro text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.lv_refunds;
begin
  select * into r from public.lv_refunds where id = p_refund for update;
  if r.id is null then return; end if;
  if r.status = 'refunded' then return; end if;   -- nunca volta de concluído
  update public.lv_refunds set status = p_status, provider_refund_id = coalesce(p_provider_refund_id, provider_refund_id),
         erro = left(p_erro, 300), tentativas = tentativas + 1, updated_at = now()
   where id = p_refund;
  if p_status = 'refunded' then
    update public.lv_cobrancas set reembolsado_cents = least(valor_cents, reembolsado_cents + r.valor_cents), atualizado_em = now()
     where id = r.cobranca_id and r.cobranca_id is not null;
    perform public.lv_registrar_evento_pedido(r.order_id, r.seller_order_id, 'reembolso_concluido', 'pagamento',
      jsonb_build_object('valor_cents', r.valor_cents, 'provider_refund_id', p_provider_refund_id));
  elsif p_status in ('refund_failed', 'manual_review') then
    update public.lv_cobrancas set precisa_atencao = true, divergencia = 'reembolso: ' || p_status where id = r.cobranca_id;
  end if;
end $$;

create or replace function public.lv_reembolsos_a_processar(p_limite integer)
returns table (refund_id uuid, cobranca_id uuid, provedor text, mp_payment_id text, seller_id uuid,
               valor_cents bigint, total_cobranca_cents bigint, idempotency_key text, status text)
language sql stable security definer set search_path = public as $$
  select r.id, c.id, c.provedor, c.mp_payment_id, c.seller_id, r.valor_cents, c.valor_cents, r.idempotency_key, r.status
    from public.lv_refunds r join public.lv_cobrancas c on c.id = r.cobranca_id
   where r.status in ('refund_pending', 'refund_processing') and c.ambiente = public.lv_mp_ambiente()
   order by r.created_at limit p_limite;
$$;

create or replace function public.lv_cobrancas_a_reconciliar(p_limite integer, p_cobranca uuid default null)
returns table (cobranca_id uuid, provedor text, mp_payment_id text, seller_id uuid, status text)
language sql stable security definer set search_path = public as $$
  select c.id, c.provedor, c.mp_payment_id, c.seller_id, c.status from public.lv_cobrancas c
   where c.ambiente = public.lv_mp_ambiente() and c.mp_payment_id is not null
     and (p_cobranca is null or c.id = p_cobranca)
     and (p_cobranca is not null or c.status in ('aguardando_pagamento', 'em_analise', 'contestado', 'parcialmente_reembolsado')
          or c.precisa_atencao
          or (c.status = 'aprovado' and c.processor_fee_real_cents is null)
          or c.ultima_reconciliacao_em is null or c.ultima_reconciliacao_em < now() - interval '6 hours')
   order by c.ultima_reconciliacao_em nulls first limit p_limite;
$$;

-- =====================================================================
-- 6. Funções da U8 que passam a respeitar a cobrança por subpedido
-- =====================================================================
-- Porta da U8 para pagamento de pedido inteiro. Agora só em staging (testes e simulação):
-- em produção o pagamento entra pelas cobranças (webhook/reconciliação).
create or replace function public.lv_pagamento_processar(
  p_provedor text, p_chave text, p_order uuid, p_status text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_evento uuid; v_pag public.lv_payments; v_ord public.lv_orders; so record; v_cob uuid; v_valor bigint;
begin
  if not public.lv_eh_staging() then
    raise exception 'Em produção o pagamento entra pelas cobranças do provedor.' using errcode = 'P0001', hint = 'USE_COBRANCAS';
  end if;
  if p_status not in ('aprovado', 'recusado', 'cancelado') then
    raise exception 'Status de pagamento não suportado: %.', p_status using errcode = 'P0001', hint = 'PAGAMENTO_INVALIDO';
  end if;
  select * into v_ord from public.lv_orders where id = p_order for update;
  if v_ord.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001', hint = 'PEDIDO_INEXISTENTE';
  end if;
  select * into v_pag from public.lv_payments where order_id = p_order for update;
  insert into public.lv_payment_events (provedor, idempotency_key, payment_id, order_id, status, payload)
  values (p_provedor, p_chave, v_pag.id, p_order, p_status, coalesce(p_payload, '{}'::jsonb))
  on conflict (provedor, idempotency_key) do nothing returning id into v_evento;
  if v_evento is null then
    perform public.lv_registrar_evento_pedido(p_order, null, 'pagamento_evento_duplicado', 'pagamento',
      jsonb_build_object('provedor', p_provedor, 'chave', p_chave, 'status', p_status));
    return jsonb_build_object('duplicado', true, 'status_pedido', v_ord.status, 'status_pagamento', v_pag.status);
  end if;

  -- Uma cobrança mock por subpedido (os que aguardam; ou, se o pedido já caiu, os cancelados sem cobrança aprovada).
  for so in select * from public.lv_seller_orders s where s.order_id = p_order
             and (s.status = 'aguardando_pagamento'
                  or (v_ord.status = 'cancelado' and s.status = 'cancelado'
                      and not exists (select 1 from public.lv_cobrancas c where c.seller_order_id = s.id and c.status = 'aprovado')))
             order by s.numero loop
    select id into v_cob from public.lv_cobrancas where seller_order_id = so.id
       and status in ('criando', 'aguardando_pagamento', 'em_analise') limit 1;
    if v_cob is null then
      v_valor := so.total_cents;
      v_cob := gen_random_uuid();
      insert into public.lv_cobrancas (id, order_id, seller_order_id, seller_id, provedor, ambiente, metodo, status, external_reference,
        idempotency_key, mp_payment_id, valor_cents, produtos_cents, frete_cents, comissao_cents, tarifa_cents, frete_no_application_fee,
        application_fee_cents, receita_marketplace_estimada_cents)
      values (v_cob, p_order, so.id, so.seller_id, 'mock', 'teste', v_ord.pagamento_metodo::text, 'aguardando_pagamento', 'lv:' || v_cob,
        p_chave || ':' || so.id, 'sim_' || replace(v_cob::text, '-', ''), v_valor, so.subtotal_produtos_cents - so.desconto_produtos_cents,
        so.frete_cents, coalesce(so.comissao_plataforma_cents, 0), coalesce(so.tarifa_operacional_cents, 0), true,
        coalesce(so.comissao_plataforma_cents, 0) + coalesce(so.tarifa_operacional_cents, 0) + so.frete_cents,
        coalesce(so.comissao_plataforma_cents, 0) + coalesce(so.tarifa_operacional_cents, 0) + so.frete_cents);
    end if;
    perform public.lv_cobranca_aplicar(v_cob,
      jsonb_build_object('status', case p_status when 'aprovado' then 'approved' when 'recusado' then 'rejected' else 'cancelled' end,
                         'status_detail', 'simulado'), 'pagamento');
  end loop;

  if p_status = 'recusado' then
    if v_pag.status in ('aguardando_pagamento', 'pendente') then update public.lv_payments set status = 'recusado' where id = v_pag.id; end if;
    perform public.lv_registrar_evento_pedido(p_order, null, 'pagamento_recusado', 'pagamento', jsonb_build_object('provedor', p_provedor));
  end if;
  update public.lv_orders set pagamento_status = (select status from public.lv_payments where id = v_pag.id)
   where id = p_order and pagamento_status is distinct from (select status from public.lv_payments where id = v_pag.id);

  select * into v_ord from public.lv_orders where id = p_order;
  return jsonb_build_object('duplicado', false, 'status_pedido', v_ord.status,
    'status_pagamento', (select status from public.lv_payments where id = v_pag.id));
end $$;

-- Expiração: agora por subpedido. Quem pagou segue; quem não pagou é cancelado e devolve estoque.
create or replace function public.lv_checkout_expirar()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record; s record;
  v_checkouts integer := 0; v_pedidos integer := 0; v_unidades integer := 0;
  v_cfg jsonb := public.lv_config_checkout();
begin
  for r in select id, cart_id from public.lv_checkouts where status = 'aberto' and expira_em < now() for update skip locked loop
    v_unidades := v_unidades + public.lv_liberar_reservas(r.id, null, null, 'expirada', 'checkout expirado');
    update public.lv_checkouts set status = 'expirado', updated_at = now() where id = r.id;
    update public.lv_carts set status = 'aberto', updated_at = now() where id = r.cart_id and status = 'em_checkout';
    v_checkouts := v_checkouts + 1;
  end loop;

  for r in select o.id from public.lv_orders o
            where o.status = 'aguardando_pagamento'
              and exists (select 1 from public.lv_stock_reservations sr
                           where sr.order_id = o.id and sr.status = 'ativa' and sr.expira_em < now())
            for update skip locked loop
    for s in select id from public.lv_seller_orders where order_id = r.id and status = 'aguardando_pagamento' loop
      v_unidades := v_unidades + public.lv_liberar_reservas(null, r.id, s.id, 'expirada', 'pagamento não confirmado no prazo');
      update public.lv_seller_orders set status = 'cancelado' where id = s.id;
      update public.lv_shipments set status = 'cancelado', updated_at = now() where seller_order_id = s.id;
      update public.lv_cobrancas set status = 'expirado', atualizado_em = now()
       where seller_order_id = s.id and status in ('criando', 'aguardando_pagamento', 'em_analise');
      perform public.lv_registrar_evento_pedido(r.id, s.id, 'cancelado', 'sistema', jsonb_build_object('motivo', 'pagamento não confirmado no prazo'));
    end loop;
    if exists (select 1 from public.lv_seller_orders where order_id = r.id and status <> 'cancelado') then
      perform public.lv_pedido_recalcular_pagamento(r.id);   -- quem pagou segue: pedido pago
    else
      update public.lv_payments set status = 'cancelado' where order_id = r.id and status in ('pendente', 'aguardando_pagamento', 'recusado');
      update public.lv_orders set status = 'cancelado', cancelado_em = now() where id = r.id;
      perform public.lv_registrar_evento_pedido(r.id, null, 'cancelado', 'sistema', jsonb_build_object('motivo', 'pagamento não confirmado no prazo'));
    end if;
    perform public.lv_registrar_evento_pedido(r.id, null, 'estoque_liberado', 'sistema', '{}'::jsonb);
    v_pedidos := v_pedidos + 1;
  end loop;

  update public.lv_carts set status = 'abandonado', updated_at = now()
   where status = 'aberto' and updated_at < now() - make_interval(days => coalesce((v_cfg->>'carrinho_dias')::int, 7));

  return jsonb_build_object('checkouts_expirados', v_checkouts, 'pedidos_cancelados', v_pedidos, 'unidades_liberadas', v_unidades);
end $$;

-- Cancelamento: depois do pagamento, o dinheiro volta pelo PROVEDOR (reembolso por cobrança aprovada).
create or replace function public.lv_pedido_cancelar(p_order uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ord public.lv_orders; v_admin boolean := public.is_admin(); v_origem text; v_unidades integer := 0; c record;
begin
  select * into v_ord from public.lv_orders where id = p_order for update;
  if v_ord.id is null or not (v_admin or v_ord.user_id = auth.uid()) then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001', hint = 'PEDIDO_INEXISTENTE';
  end if;
  v_origem := case when v_ord.user_id = auth.uid() and not v_admin then 'comprador' else 'admin' end;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001', hint = 'DADOS_INVALIDOS';
  end if;

  if v_ord.status = 'aguardando_pagamento' and not exists (select 1 from public.lv_cobrancas where order_id = p_order and status = 'aprovado') then
    v_unidades := public.lv_liberar_reservas(null, p_order, null, 'liberada', 'pedido cancelado');
    update public.lv_payments set status = 'cancelado' where order_id = p_order and status in ('pendente', 'aguardando_pagamento', 'recusado');
    update public.lv_cobrancas set status = 'cancelado', atualizado_em = now()
     where order_id = p_order and status in ('criando', 'aguardando_pagamento', 'em_analise');
  elsif v_admin and v_ord.status in ('aguardando_pagamento', 'pago', 'em_processamento')
        and not exists (select 1 from public.lv_seller_orders where order_id = p_order and status in ('enviado', 'entregue')) then
    v_unidades := public.lv_liberar_reservas(null, p_order, null, 'liberada', 'pedido cancelado')
                + public.lv_devolver_estoque(p_order, null, 'pedido cancelado depois do pagamento');
    update public.lv_cobrancas set status = 'cancelado', atualizado_em = now()
     where order_id = p_order and status in ('criando', 'aguardando_pagamento', 'em_analise');
    if exists (select 1 from public.lv_cobrancas where order_id = p_order and status in ('aprovado', 'parcialmente_reembolsado')) then
      for c in select id, seller_order_id, provedor, valor_cents - reembolsado_cents as saldo from public.lv_cobrancas
                where order_id = p_order and status in ('aprovado', 'parcialmente_reembolsado') loop
        if not exists (select 1 from public.lv_refunds where cobranca_id = c.id and status in ('refund_pending', 'refund_processing', 'manual_review')) then
          insert into public.lv_refunds (order_id, seller_order_id, cobranca_id, provedor, tipo, valor_cents, motivo)
          values (p_order, c.seller_order_id, c.id, c.provedor, 'total', c.saldo, p_motivo);
        end if;
      end loop;
    else
      insert into public.lv_refunds (order_id, tipo, valor_cents, motivo) values (p_order, 'total', v_ord.total_cents, p_motivo);
    end if;
    perform public.lv_registrar_evento_pedido(p_order, null, 'reembolso_solicitado', v_origem,
      jsonb_build_object('valor_cents', v_ord.total_cents, 'status', 'refund_pending'));
  else
    raise exception 'Este pedido não pode mais ser cancelado por aqui.' using errcode = 'P0001', hint = 'CANCELAMENTO_NAO_PERMITIDO';
  end if;

  update public.lv_seller_orders set status = 'cancelado' where order_id = p_order and status <> 'cancelado';
  update public.lv_shipments set status = 'cancelado', updated_at = now() where order_id = p_order;
  update public.lv_orders set status = 'cancelado', cancelado_em = now() where id = p_order;
  perform public.lv_registrar_evento_pedido(p_order, null, 'cancelado', v_origem, jsonb_build_object('motivo', p_motivo));
  perform public.lv_registrar_evento_pedido(p_order, null, 'estoque_liberado', 'sistema', jsonb_build_object('unidades', v_unidades));
  return jsonb_build_object('status', 'cancelado', 'unidades_liberadas', v_unidades);
end $$;

-- =====================================================================
-- 7. RLS e permissões
-- =====================================================================
alter table public.lv_mp_conexoes enable row level security;
alter table public.lv_mp_credenciais enable row level security;
alter table public.lv_mp_oauth_estados enable row level security;
alter table public.lv_cobrancas enable row level security;
alter table public.lv_mp_mock_remoto enable row level security;
alter table public.lv_mp_webhook_eventos enable row level security;
alter table public.lv_mp_reconciliacoes enable row level security;

revoke all on public.lv_mp_conexoes, public.lv_mp_credenciais, public.lv_mp_oauth_estados, public.lv_cobrancas,
              public.lv_mp_mock_remoto, public.lv_mp_webhook_eventos, public.lv_mp_reconciliacoes
  from anon, authenticated, public;
-- Tokens, estados OAuth e o remoto mock: NENHUMA permissão para o site.
grant select on public.lv_mp_conexoes, public.lv_cobrancas, public.lv_mp_webhook_eventos, public.lv_mp_reconciliacoes to authenticated;

drop policy if exists lv_mp_conexoes_leitura on public.lv_mp_conexoes;
create policy lv_mp_conexoes_leitura on public.lv_mp_conexoes for select to authenticated
  using (public.is_admin() or seller_id = any(public.lv_meus_vendedores()));

-- O comprador vê as cobranças do próprio pedido (QR Pix, status); o vendedor, as dele; admin, todas.
drop policy if exists lv_cobrancas_leitura on public.lv_cobrancas;
create policy lv_cobrancas_leitura on public.lv_cobrancas for select to authenticated
  using (public.is_admin() or seller_id = any(public.lv_meus_vendedores()) or order_id = any(public.lv_meus_pedidos()));

drop policy if exists lv_mp_webhook_eventos_leitura on public.lv_mp_webhook_eventos;
create policy lv_mp_webhook_eventos_leitura on public.lv_mp_webhook_eventos for select to authenticated using (public.is_admin());

drop policy if exists lv_mp_reconciliacoes_leitura on public.lv_mp_reconciliacoes;
create policy lv_mp_reconciliacoes_leitura on public.lv_mp_reconciliacoes for select to authenticated using (public.is_admin());

do $$
declare f text;
begin
  foreach f in array array[
    'lv_pagamentos_config()', 'lv_mp_status_local(text,text)', 'lv_mp_rank(text)', 'lv_mp_pode_transicionar(text,text)',
    'lv_mp_ambiente()', 'lv_mp_conexao_iniciar()', 'lv_mp_oauth_estado_gravar(text,uuid,uuid,text,integer)',
    'lv_mp_oauth_estado_consumir(text,uuid)',
    'lv_mp_credencial_gravar(uuid,text,text,text,text,text,text[],timestamptz,boolean,boolean)',
    'lv_mp_credencial_ler(uuid)', 'lv_mp_seller_por_mp_user(text)', 'lv_mp_conexao_marcar(uuid,text,text)',
    'lv_mp_desconectar(uuid)', 'lv_mp_conexoes_a_renovar(integer)', 'lv_confirmar_reservas_sub(uuid)',
    'lv_pedido_recalcular_pagamento(uuid)', 'lv_cobranca_preparar(uuid,text)', 'lv_cobranca_registrar_criacao(uuid,jsonb)',
    'lv_cobranca_falhou(uuid,text)', 'lv_cobranca_aplicar(uuid,jsonb,text)', 'lv_reembolso_solicitar(uuid,bigint,text)',
    'lv_reembolso_aplicar(uuid,text,text,text)', 'lv_reembolsos_a_processar(integer)',
    'lv_cobrancas_a_reconciliar(integer,uuid)', 'lv_pagamento_processar(text,text,uuid,text,jsonb)',
    'lv_checkout_expirar()', 'lv_pedido_cancelar(uuid,text)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- O que o site chama direto (cada função confere o usuário por dentro).
grant execute on function public.lv_pagamentos_config() to anon, authenticated;
grant execute on function public.lv_mp_status_local(text, text) to authenticated;
grant execute on function public.lv_mp_pode_transicionar(text, text) to authenticated;
grant execute on function public.lv_mp_rank(text) to authenticated;
grant execute on function public.lv_mp_desconectar(uuid) to authenticated;
grant execute on function public.lv_reembolso_solicitar(uuid, bigint, text) to authenticated;
grant execute on function public.lv_checkout_expirar() to authenticated;
grant execute on function public.lv_pedido_cancelar(uuid, text) to authenticated;
-- lv_mp_conexao_iniciar e lv_cobranca_preparar: chamadas pela Edge Function COM o JWT do usuário.
grant execute on function public.lv_mp_conexao_iniciar() to authenticated;
grant execute on function public.lv_cobranca_preparar(uuid, text) to authenticated;
