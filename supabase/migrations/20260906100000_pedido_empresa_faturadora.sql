-- =====================================================================
-- Roteamento de pagamento pela EMPRESA FATURADORA (06/09/2026)
--
-- Regra de negócio: quem recebe o dinheiro não é decidido pela marca do produto,
-- e sim pela empresa que vende e fatura a operação. O mesmo Café Saporino
-- vendido em cafesaporino.com.br fatura pela Saporino, e vendido na Casa Cofico
-- fatura pela COFICO. Produto igual, recebedor diferente.
--
-- Antes disso, `create-payment` caía em Saporino quando ninguém dizia a empresa.
-- Um padrão silencioso desses manda dinheiro para o CNPJ errado sem erro nenhum.
-- =====================================================================

-- Qual conjunto de credenciais do Mercado Pago pertence a cada empresa.
-- É o elo entre a empresa e os secrets; o valor nunca fica no banco.
alter table public.companies
  add column if not exists payment_account text;

comment on column public.companies.payment_account is
  'Chave do conjunto de credenciais Mercado Pago da empresa (ex.: saporino, cofico). NULL = empresa sem meio de recebimento configurado; pedido dela e recusado no create-payment.';

update public.companies set payment_account = 'saporino' where order_prefix = 'CS' and payment_account is null;
update public.companies set payment_account = 'cofico'   where order_prefix = 'CO' and payment_account is null;
-- Café Fazendinha fica com NULL de propósito: hoje quem vende Fazendinha é a
-- COFICO, nos canais dela. Se um dia a própria Fazendinha faturar direto, ela
-- ganha credencial própria e este campo é preenchido.

-- A empresa faturadora do pedido. Fonte da verdade, persistida no pedido.
-- O domínio ajuda a decidir na CRIAÇÃO; depois disso vale o que está gravado aqui.
alter table public.orders
  add column if not exists seller_company_id uuid references public.companies(id);

-- Registro de para onde o dinheiro foi roteado, para auditoria e conciliação.
alter table public.orders
  add column if not exists mp_account_key text,
  add column if not exists mp_collector_id text;

comment on column public.orders.seller_company_id is
  'Empresa que vende e fatura este pedido. Define a conta Mercado Pago que recebe. NAO inferir pela marca do produto.';
comment on column public.orders.mp_account_key is
  'Conjunto de credenciais efetivamente usado ao criar a preferencia (companies.payment_account).';
comment on column public.orders.mp_collector_id is
  'collector_id devolvido pelo Mercado Pago: prova de qual conta recebeu.';

create index if not exists orders_seller_company_idx on public.orders (seller_company_id);

-- Consulta de apoio: empresa -> credencial. Sem segredo, só o nome do conjunto.
create or replace view public.vw_empresa_recebimento as
  select c.id            as company_id,
         c.name,
         c.cnpj,
         c.order_prefix,
         c.payment_account,
         (c.payment_account is not null) as pode_receber
    from public.companies c;

revoke all on public.vw_empresa_recebimento from public, anon;
grant select on public.vw_empresa_recebimento to authenticated;
