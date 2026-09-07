-- =====================================================================
-- Integração SuperFrete (08/09/2026)
--
-- A tabela da COFICO cobra R$ 34,50 num pacote de 500 g para Jundiaí. Pelo
-- SuperFrete, o mesmo trajeto sai a R$ 5,12 na Loggi. A diferença não é
-- detalhe: com a tabela própria, o frete custa mais que o café e o carrinho
-- é abandonado no CEP.
--
-- O SuperFrete é um agregador: compra volume de Correios, Loggi e Jadlog e
-- revende com desconto. Não exige contrato com cada transportadora — só uma
-- conta e um token.
--
-- O TOKEN NÃO FICA AQUI. Ele emite etiqueta e gasta saldo de verdade, então
-- vive nos secrets da função, onde o navegador nunca alcança. Esta tabela
-- guarda só o que é configuração, e pode ser lida pela loja.
-- =====================================================================

create table if not exists public.superfrete_settings (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies(id) on delete cascade,
  is_active     boolean not null default false,
  origin_cep    text,
  -- Códigos de serviço do SuperFrete, separados por vírgula. Fica configurável
  -- porque cada conta tem transportadoras diferentes habilitadas, e a lista
  -- muda sem aviso do lado deles.
  services      text not null default '1,2,17',
  -- Margem sobre o preço do agregador, se a loja quiser ganhar no frete.
  -- Zero = repassa o custo exato.
  markup_pct    numeric(6,2) not null default 0,
  markup_fixo   numeric(10,2) not null default 0,
  -- Última cotação de teste bem-sucedida: serve de "conectado" na tela sem
  -- precisar expor o token.
  last_ok_at    timestamptz,
  last_error    text,
  updated_at    timestamptz not null default now(),
  unique (company_id)
);

comment on table public.superfrete_settings is
  'Configuracao da integracao com o agregador de frete, por empresa. O token NAO fica aqui: vive nos secrets da edge function.';

-- Uma linha por empresa que vende, já com o CD de Várzea como origem.
insert into public.superfrete_settings (company_id, origin_cep, services)
select id, '13225875', '1,2,17'
from public.companies where order_prefix in ('CS', 'CO')
on conflict (company_id) do nothing;

alter table public.superfrete_settings enable row level security;

-- A loja precisa saber se a integração está ligada antes de cotar, e o
-- checkout é público. Nada aqui é segredo.
drop policy if exists sf_leitura on public.superfrete_settings;
create policy sf_leitura on public.superfrete_settings
  for select to anon, authenticated using (true);

drop policy if exists sf_admin on public.superfrete_settings;
create policy sf_admin on public.superfrete_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
