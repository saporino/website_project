-- =====================================================================
-- Uso e custo de IA (09/09/2026)
--
-- O raio-X de custo mostrou que o Studio chama IA em três pontos e NÃO
-- registra nada: nenhuma coluna, nenhuma tabela, nenhuma linha. O `usage`
-- da Anthropic chega em toda resposta e é descartado na mesma linha em que
-- o texto é extraido.
--
-- Esta tabela existe para que isso pare AGORA, antes da geracao de imagem
-- entrar no ar — porque imagem sera o maior custo variavel do produto, e
-- custo que nasce sem medida nunca é medido depois: as chamadas ja feitas
-- nao podem ser reconstituidas.
--
-- Uma linha por CHAMADA de API, nao por peca. Um video gera duas linhas
-- (Whisper + Claude) ligadas pelo mesmo subject_id — e é somando que se
-- responde "quanto custou este conteudo".
-- =====================================================================

create table if not exists public.ai_usage_events (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- Tenant. Hoje é a empresa do grupo; quando existir organizacao do COFICO
  -- Studio, esta coluna passa a apontar para ela sem mudar o resto.
  company_id      uuid references public.companies(id) on delete set null,
  user_id         uuid references auth.users(id) on delete set null,

  operation       text not null,      -- image_generation | analise | legenda | transcricao
  provider        text not null,      -- openai | anthropic
  model           text not null,
  prompt_version  text,               -- versao do prompt de sistema, quando houver

  -- Medidas de consumo. Todas nulas por padrao: cada provedor cobra por uma
  -- unidade diferente, e forcar zero faria somatorio mentir.
  input_tokens    integer,
  output_tokens   integer,
  cached_tokens   integer,
  audio_seconds   numeric(10,2),      -- Whisper cobra por tempo, nao por token
  image_count     integer,
  quality         text,
  width           integer,
  height          integer,

  -- Custo. cost_usd é o unico numero conferivel contra a fatura do provedor.
  -- fx_rate e cost_brl ficam nulos ate existir fonte de cambio no sistema:
  -- gravar cambio inventado seria pior que nao gravar.
  cost_usd        numeric(12,6),
  fx_rate         numeric(10,4),
  cost_brl        numeric(12,4),

  request_id      text,               -- id do provedor, para contestar cobranca
  subject_type    text,               -- generation | video | campaign
  subject_id      uuid,

  -- Chamada que falha DEPOIS de o modelo processar tambem é cobrada. Se so
  -- registrassemos sucesso, o custo medido ficaria sistematicamente abaixo da
  -- fatura — e a diferenca apareceria justamente quando algo esta quebrado.
  status          text not null default 'ok',   -- ok | erro
  error_text      text,
  duration_ms     integer
);

create index if not exists ai_usage_empresa_data on public.ai_usage_events (company_id, created_at desc);
create index if not exists ai_usage_assunto      on public.ai_usage_events (subject_type, subject_id);

comment on table public.ai_usage_events is
  'Uma linha por chamada de API de IA: consumo, custo e a que peca pertence. Base para custo por marca, por conteudo e por cliente. Gravacao é best-effort: falha aqui nunca derruba a geracao.';
comment on column public.ai_usage_events.cost_usd is
  'Custo calculado a partir do usage real devolvido pela API, multiplicado pelo preco oficial do modelo. Nunca estimado.';
comment on column public.ai_usage_events.status is
  'ok | erro. Erro depois do processamento tambem é cobrado pelo provedor e precisa entrar na conta.';

alter table public.ai_usage_events enable row level security;

-- Custo é dado financeiro interno: ADMIN-ONLY, no mesmo padrao de lot_transfers.
drop policy if exists ai_usage_admin on public.ai_usage_events;
create policy ai_usage_admin on public.ai_usage_events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
