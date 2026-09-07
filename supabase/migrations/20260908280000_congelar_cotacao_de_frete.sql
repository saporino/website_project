-- =====================================================================
-- Cotação congelada (08/09/2026)
--
-- O agregador muda o preço entre chamadas: o mesmo fardo foi cotado a
-- R$ 18,34 e, segundos depois, a R$ 15,72. Como o servidor recotava na
-- hora de cobrar, o cliente podia ver um valor e pagar outro — e quando a
-- variação fosse para cima, a diferença sairia do bolso da loja em toda
-- venda.
--
-- Agora a cotação mostrada é gravada e vale por 15 minutos. Na hora de
-- cobrar, o servidor usa o valor congelado, não uma consulta nova.
-- =====================================================================

create table if not exists public.shipping_quotes (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid references public.companies(id) on delete cascade,
  dest_cep       text not null,
  packages       integer not null,
  goods_value    numeric(12,2) not null default 0,
  weight_kg      numeric(10,3),

  service_id     integer,
  service_name   text,
  carrier_logo   text,
  delivery_days  integer,

  -- As três partes do preço, para o pedido registrar quanto a loja bancou.
  base_price     numeric(10,2) not null,
  discount       numeric(10,2) not null default 0,
  price          numeric(10,2) not null,

  expires_at     timestamptz not null default now() + interval '15 minutes',
  created_at     timestamptz not null default now()
);

create index if not exists shipping_quotes_validade on public.shipping_quotes (expires_at);

comment on table public.shipping_quotes is
  'Cotacoes mostradas ao cliente, congeladas por 15 minutos. Na cobranca vale o valor gravado aqui, nao uma consulta nova — o agregador muda o preco entre chamadas.';

alter table public.shipping_quotes enable row level security;

-- Ninguém lê pelo navegador: quem grava e quem lê é o servidor. A cotação vai
-- para a tela pela resposta da função, com o id dela junto.
drop policy if exists sq_admin on public.shipping_quotes;
create policy sq_admin on public.shipping_quotes
  for select to authenticated using (public.is_admin());

-- Cotação velha não serve para nada e a tabela cresce rápido: uma linha por
-- opção, a cada CEP digitado.
create or replace function public.limpar_cotacoes_vencidas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  delete from public.shipping_quotes where expires_at < now() - interval '1 day';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

comment on function public.limpar_cotacoes_vencidas is
  'Apaga cotacoes vencidas ha mais de um dia. Uma linha por opcao a cada CEP digitado enche a tabela depressa.';
