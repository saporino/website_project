-- =====================================================================
-- CASA COFICO — o histórico de cada coleta (20/10/2026)
--
-- POR QUE ESTA TABELA EXISTE. Ele perguntou: "onde vou ver os resultados
-- cada vez que puxo?" A resposta honesta era: em lugar nenhum. As consultas à
-- API do Mercado Livre apareciam num terminal e sumiam; o estudo de setembro
-- virou dois arquivos HTML soltos no computador dele. Não havia tela, não
-- havia histórico, e não havia como saber o que tinha falhado.
--
-- O QUE ELA GUARDA. Uma linha por consulta: quando, por qual via (API do
-- Mercado Livre ou Apify — ele escolhe), o que foi pedido, o que voltou, e
-- **o erro quando dá erro**. O erro é tão importante quanto o acerto: foi um
-- 403 que nos ensinou que a busca por palavra está fechada para a nossa
-- aplicação, e isso precisa ficar visível em vez de morrer num terminal.
--
-- O QUE ELA NÃO É. Não guarda os dados coletados — preço de concorrente
-- continua em `ecommerce_price_snapshots`, que já existe e já tem 6.208
-- linhas. Esta tabela é o DIÁRIO DE BORDO: o que foi tentado e o que
-- aconteceu. Separar as duas coisas é o que permite responder "este número é
-- de quando?" sem adivinhar.
-- =====================================================================

create table if not exists public.marketplace_coletas (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references public.companies(id) on delete cascade,

  -- POR ONDE veio. É a escolha dele, peça por peça: a API é de graça e
  -- limitada; o Apify custa e alcança mais. Guardar a via é o que permite
  -- comparar as duas depois com fato em vez de impressão.
  via             text not null check (via in ('api', 'apify')),
  marketplace     text not null,

  -- O QUE foi pedido. `rota` é o endereço consultado (ou o actor do Apify);
  -- `termo` é a busca, quando houver.
  rota            text not null,
  termo           text,
  parametros      jsonb,

  -- O QUE voltou.
  status          integer,                      -- HTTP, quando houver
  resultado       text not null default 'pendente'
                  check (resultado in ('pendente','ok','vazio','erro','sem_permissao')),
  itens           integer not null default 0,
  erro            text,                         -- a mensagem, em português quando dá
  duracao_ms      integer,

  -- QUANTO custou. Null para a API (não cobra). Em dólar para o Apify, que é
  -- como a fatura vem. Sem isto não dá para responder se o Apify valeu a pena.
  custo_usd       numeric(10,4),

  -- Quem mandou puxar, e quando.
  executado_por   uuid references auth.users(id) on delete set null,
  executado_em    timestamptz not null default now()
);

comment on table public.marketplace_coletas is
  'Diário de bordo das coletas de marketplace: o que foi puxado, por qual via (API ou Apify), o que voltou e o que falhou. Responde "onde vejo o resultado de cada puxada".';
comment on column public.marketplace_coletas.via is
  'api = API oficial do marketplace (grátis, limitada). apify = raspagem paga.';
comment on column public.marketplace_coletas.resultado is
  'sem_permissao é separado de erro de propósito: 403 não é defeito nosso, é permissão que a aplicação não tem — e é acionável (pedir ao marketplace).';

create index if not exists idx_mkt_coletas_recentes
  on public.marketplace_coletas (company_id, executado_em desc);
create index if not exists idx_mkt_coletas_por_via
  on public.marketplace_coletas (company_id, marketplace, via, executado_em desc);

-- ---------------------------------------------------------------------
-- RLS — desempenho de loja é dado de empresa, não do representante
-- ---------------------------------------------------------------------
-- A regra de visibilidade do rep é explícita no projeto: ele vê a própria
-- carteira, nunca custo, margem ou dado que não seja dele. Preço de
-- marketplace é decisão de precificação da empresa. Fica só com o admin.
alter table public.marketplace_coletas enable row level security;

drop policy if exists mkt_coletas_admin on public.marketplace_coletas;
create policy mkt_coletas_admin on public.marketplace_coletas
  for all using (public.is_admin()) with check (public.is_admin());

-- `with check` igual ao `using`, e não ausente: política FOR ALL sem
-- WITH CHECK usa o USING também para escrita, e deixar isso implícito é a
-- classe de descuido que a auditoria de 20/10 encontrou em 9 políticas
-- antigas. Aqui já nasce explícito.

-- ---------------------------------------------------------------------
-- A via preferida de cada marketplace — a escolha dele, guardada
-- ---------------------------------------------------------------------
-- "deixa o apify lá, mas usa o API no painel para o mercado livre; deve dar
-- as 2 opções, eu escolho como pegar as informações." A coluna guarda a
-- preferência; o botão na tela continua permitindo a outra via a qualquer
-- momento. Preferência não é trava.
alter table public.ecommerce_sources
  add column if not exists via_preferida text
  check (via_preferida in ('api', 'apify'));

comment on column public.ecommerce_sources.via_preferida is
  'Via que a tela sugere por padrão para este marketplace. Não impede a outra: o painel sempre oferece as duas.';

-- O Mercado Livre tem API nossa funcionando (conta CASACOFICO, token válido),
-- então a sugestão padrão é a API. Os demais só têm Apify hoje.
update public.ecommerce_sources set via_preferida = 'api'   where marketplace = 'mercadolivre';
update public.ecommerce_sources set via_preferida = 'apify' where via_preferida is null;
