-- =====================================================================
-- E-mails do pedido (08/09/2026)
--
-- Hoje o cliente paga e não recebe nada nosso: só o comprovante do
-- Mercado Pago, que fala de pagamento e não sabe o que foi comprado nem
-- quando chega. Do ponto de vista de quem comprou, ela paga e some.
--
-- Esta migration cria o que falta para avisar o cliente em cada etapa,
-- e o registro do que já foi enviado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Dados de retirada e aviso, por empresa
-- ---------------------------------------------------------------------
-- O endereço de retirada NÃO fica no código: são duas empresas vendendo,
-- cada uma com o seu, e mudança de endereço não pode depender de deploy.
-- Endereço, cidade, uf e cep já existem em companies; falta o horário e
-- para quem avisar quando entra pedido.
alter table public.companies
  add column if not exists pickup_hours  text,
  add column if not exists notify_email  text;

comment on column public.companies.pickup_hours is
  'Horario de retirada, em texto livre (ex.: "Segunda a sexta, 9h as 17h"). Vai no e-mail de "pronto para retirada".';
comment on column public.companies.notify_email is
  'Para quem avisar quando entra pedido pago desta empresa. Vazio = ninguem e avisado.';

-- ---------------------------------------------------------------------
-- Registro de e-mails enviados por pedido
-- ---------------------------------------------------------------------
-- Duas razões, e as duas são práticas:
--
--   1. O Mercado Pago reenvia a mesma notificação várias vezes. Sem este
--      registro, o cliente receberia "pedido confirmado" três, quatro
--      vezes pelo mesmo pagamento. A chave única resolve: a segunda
--      tentativa de gravar falha, e o envio não acontece.
--   2. Quando o cliente disser "não recebi nada", dá para responder com
--      fato: foi enviado tal dia, para tal endereço, e o provedor
--      respondeu isto.
create table if not exists public.order_emails (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  kind        text not null
                check (kind in ('pedido_confirmado','pronto_retirada','enviado','entregue','aviso_admin')),
  to_email    text not null,
  provider_id text,
  status      text not null default 'enviado' check (status in ('enviado','falhou')),
  error_text  text,
  created_at  timestamptz not null default now(),

  -- Um e-mail de cada tipo por pedido. É esta linha que impede o reenvio.
  unique (order_id, kind)
);

create index if not exists order_emails_order_idx on public.order_emails (order_id, created_at desc);

alter table public.order_emails enable row level security;

-- Só administrador lê. O cliente não precisa ver o log; ele recebe o e-mail.
drop policy if exists oe_admin on public.order_emails;
create policy oe_admin on public.order_emails
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on table public.order_emails is
  'O que ja foi enviado a cada cliente, por pedido. A chave unica (order_id, kind) e o que impede e-mail repetido quando o Mercado Pago reenvia a notificacao.';

-- ---------------------------------------------------------------------
-- Etapas do pedido que faltavam
-- ---------------------------------------------------------------------
-- order_status já registrava criado / pago / cancelado, mas não tinha como
-- dizer "separado, pode retirar" nem "postado". Sem essas etapas não há o
-- que disparar o aviso ao cliente.
alter table public.orders
  add column if not exists ready_at     timestamptz,
  add column if not exists shipped_at   timestamptz,
  add column if not exists tracking_code text,
  add column if not exists tracking_url  text;

comment on column public.orders.ready_at is
  'Quando o pedido foi separado e ficou disponivel para retirada.';
comment on column public.orders.shipped_at is
  'Quando o pedido foi postado/despachado.';
comment on column public.orders.tracking_code is
  'Codigo de rastreio da transportadora, digitado no painel.';
