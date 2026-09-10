-- =====================================================================
-- Geração de imagem no Studio (09/09/2026)
--
-- Até aqui o Studio gerava o PROMPT e o humano levava a um gerador externo,
-- criava a imagem fora e voltava. Esta tabela guarda a geração feita DENTRO
-- do Studio: cada tentativa, com o que foi pedido, o que saiu e o que a
-- pessoa decidiu.
--
-- Por que não reaproveitar `studio_campaigns`: aquela tabela guarda a peça
-- que vai ser publicada — uma linha por campanha, com media_path. Aqui é o
-- oposto: interessa TODA tentativa, inclusive a rejeitada, porque é a razão
-- entre pedidos e aprovações que diz quanto custa de verdade um conteúdo
-- aprovado. Sobrescrever media_path perderia exatamente o dado que importa.
-- =====================================================================

create table if not exists public.studio_generations (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),

  company_id     uuid not null references public.companies(id) on delete cascade,
  created_by     uuid references auth.users(id) on delete set null,

  -- 'feed' (4:5) | 'story' (9:16). Formato pedido, não o que a API devolveu.
  format         text not null,
  -- O que a pessoa escreveu, em português comum. Não é o prompt técnico.
  brief          text not null,
  -- O prompt realmente enviado, montado pelo servidor. Guardado para auditoria
  -- e para saber com que instrução a imagem nasceu.
  prompt         text,
  -- Ativo de referência usado, quando houver (caminho no bucket studio-videos).
  reference_path text,

  provider       text not null default 'openai',
  model          text,
  width          integer,
  height         integer,
  storage_path   text,               -- no bucket studio-generations

  status         text not null default 'pendente',  -- pendente | pronta | erro
  error_text     text,

  -- Decisão de quem pediu. É daqui que sai a taxa de aprovação na primeira
  -- tentativa — a métrica que liga custo de IA a valor entregue.
  outcome        text,               -- aprovada | rejeitada | (null = sem decisão)
  outcome_at     timestamptz,
  downloaded_at  timestamptz,

  -- "Gerar outra" cria uma linha NOVA apontando para a primeira. Assim dá para
  -- contar quantas tentativas um pedido precisou até ser aprovado.
  parent_id      uuid references public.studio_generations(id) on delete set null
);

create index if not exists studio_gen_empresa on public.studio_generations (company_id, created_at desc);
create index if not exists studio_gen_pai     on public.studio_generations (parent_id) where parent_id is not null;

comment on table public.studio_generations is
  'Cada tentativa de geracao de imagem do Studio, aprovada ou nao. parent_id liga as tentativas do mesmo pedido: e a razao pedidos/aprovacoes que da o custo real por conteudo aprovado.';

alter table public.studio_generations enable row level security;

-- Isolamento por empresa, já no formato que o COFICO Studio vai precisar.
-- Hoje só o administrador entra no Studio, então `is_admin()` responde por
-- todos os acessos; a condição de company_id fica escrita desde já para que
-- ligar o tenant depois não exija reescrever a policy.
drop policy if exists studio_gen_admin on public.studio_generations;
create policy studio_gen_admin on public.studio_generations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Bucket das imagens geradas
-- ---------------------------------------------------------------------
-- PRIVADO. O acesso é por URL assinada com validade curta — a imagem de uma
-- marca não pode ficar legível por quem souber adivinhar o caminho.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio-generations', 'studio-generations', false, 26214400,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Caminho: {company_id}/{ano}/{mes}/{generation_id}.png
-- A segurança está no tenant e na função, nunca no nome do arquivo.
--
-- Deliberadamente SEM policy para anon/authenticated: com RLS ligada e nenhuma
-- policy, o bucket nega tudo a quem não é service_role. O navegador nunca fala
-- com este bucket — quem grava e quem emite a URL assinada é a edge function
-- `studio-image`, que já confere quem está pedindo e a qual empresa pertence.
-- Fecha mais que uma policy de admin e tem uma porta a menos para errar.
