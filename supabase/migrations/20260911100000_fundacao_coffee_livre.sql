-- =====================================================================
-- Coffee LiVRE — fundação e portão da demonstração (11/09/2026)
--
-- Primeira estrutura persistente do Coffee LiVRE. Até aqui a página era
-- estática: nenhuma tabela, nenhuma chamada de rede, todos os dados num
-- arquivo TypeScript.
--
-- DUAS REGRAS QUE VALEM PARA TUDO QUE VIER DEPOIS:
--
-- 1. PREFIXO lv_. Nenhuma tabela do Coffee LiVRE se mistura com Saporino,
--    RepCo ou COFICO Last Mile. Uma `lv_sellers` nunca vai ser confundida
--    com `representatives`, e isso e' de proposito: o Coffee LiVRE e' uma
--    plataforma propria que hoje mora na mesma infraestrutura.
--
-- 2. RLS DESDE A PRIMEIRA TABELA. Nao existe "ligo depois". Ligar RLS em
--    tabela que ja tem dado e codigo lendo dela e' onde os incidentes
--    acontecem.
--
-- O QUE ESTA MIGRACAO RESOLVE: o portao da demonstracao. Hoje o codigo de
-- acesso vive numa variavel de ambiente comparada NO NAVEGADOR, o que o
-- deixa visivel no pacote JavaScript e impossivel de trocar sem um novo
-- deploy. Aqui ele passa a viver no banco, como HASH, e a comparacao
-- acontece no servidor. Continua sendo barreira de conveniencia e nao
-- seguranca de verdade — mas para de estar escrito na vitrine.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Configuração da plataforma
-- ---------------------------------------------------------------------
-- Chave/valor em JSON, e não uma coluna por opção. A configuração do
-- Coffee LiVRE ainda vai mudar muito nas próximas semanas, e cada nova
-- opção seria uma migration se virasse coluna.
create table if not exists public.lv_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

comment on table public.lv_settings is
  'Configuracao da plataforma Coffee LiVRE em chave/valor. Admin-only: nada aqui e publico.';

alter table public.lv_settings enable row level security;

drop policy if exists lv_settings_admin on public.lv_settings;
create policy lv_settings_admin on public.lv_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Códigos de acesso da demonstração
-- ---------------------------------------------------------------------
-- Vários códigos, não um só: dá para entregar um código por convidado e
-- desativar aquele que vazou sem derrubar o acesso de todo mundo. O MVP
-- usa um; o esquema já aceita quantos forem.
--
-- `code_hash` guarda sha256 do código normalizado. Nem o administrador
-- relê um código antigo, e é por isso que `label` existe: é o apelido que
-- diz para quem aquele código foi dado.
create table if not exists public.lv_demo_access (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  code_hash   text not null unique,
  ativo       boolean not null default true,
  expires_at  timestamptz,
  last_used_at timestamptz,
  uses        integer not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

comment on table public.lv_demo_access is
  'Codigos de acesso da demonstracao privada do Coffee LiVRE. Guarda HASH, nunca o codigo. Barreira de conveniencia para apresentacao a convidados — NAO e autenticacao de marketplace.';

create index if not exists lv_demo_access_ativos on public.lv_demo_access (ativo) where ativo;

alter table public.lv_demo_access enable row level security;

-- Admin-only. O visitante nunca lê esta tabela: ele chama a função abaixo,
-- que roda com os privilégios do dono e devolve apenas sim ou não.
drop policy if exists lv_demo_access_admin on public.lv_demo_access;
create policy lv_demo_access_admin on public.lv_demo_access
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Normalização do código
-- ---------------------------------------------------------------------
-- Espaço colado e caixa trocada não podem travar quem recebeu o código por
-- mensagem. A mesma regra vale na hora de gravar e na hora de conferir, e
-- por isso ela vive numa função só.
-- `extensions.digest` com o schema escrito por extenso: o pgcrypto deste
-- projeto NAO mora em public, e funcao com search_path fixo nao o alcanca.
-- Sem isto a validacao falha com "function digest does not exist".
create or replace function public.lv_normalizar_codigo(bruto text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(lower(btrim(coalesce(bruto, ''))), 'sha256'), 'hex');
$$;

comment on function public.lv_normalizar_codigo is
  'sha256 do codigo sem espacos nas pontas e sem caixa. Usada para gravar e para conferir — as duas pontas precisam concordar.';

-- ---------------------------------------------------------------------
-- A conferência, no servidor
-- ---------------------------------------------------------------------
-- SECURITY DEFINER porque o visitante é anônimo e não pode ler
-- lv_demo_access. Ele manda o código e recebe verdadeiro ou falso; o hash
-- nunca sai daqui, e a lista de códigos tampouco.
create or replace function public.lv_validar_acesso(codigo text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
begin
  if codigo is null or btrim(codigo) = '' then
    return false;
  end if;

  select id into alvo
    from public.lv_demo_access
   where code_hash = public.lv_normalizar_codigo(codigo)
     and ativo
     and (expires_at is null or expires_at > now())
   limit 1;

  if alvo is null then
    return false;
  end if;

  -- Uso registrado para o admin enxergar movimento na demonstração. Não
  -- identifica ninguém: só conta e carimba a hora.
  update public.lv_demo_access
     set uses = uses + 1, last_used_at = now()
   where id = alvo;

  return true;
end;
$$;

comment on function public.lv_validar_acesso is
  'Confere um codigo de acesso da demonstracao SEM expor a tabela. Devolve apenas verdadeiro ou falso e contabiliza o uso.';

revoke all on function public.lv_validar_acesso(text) from public;
grant execute on function public.lv_validar_acesso(text) to anon, authenticated, service_role;

revoke all on function public.lv_normalizar_codigo(text) from public;
grant execute on function public.lv_normalizar_codigo(text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Semente: o código que já estava valendo
-- ---------------------------------------------------------------------
-- Continuidade importa: quem já entrou com este código continua entrando.
-- Trocar por um de verdade agora é operação de admin, não de migration.
insert into public.lv_demo_access (label, code_hash)
select 'Código inicial da demonstração', public.lv_normalizar_codigo('TROCAR_ESTE_CODIGO')
 where not exists (
   select 1 from public.lv_demo_access
    where code_hash = public.lv_normalizar_codigo('TROCAR_ESTE_CODIGO')
 );

-- Quanto tempo a sessão de demonstração dura. Ficava fixo em 30 dias no
-- código do navegador; agora é ajustável sem deploy.
insert into public.lv_settings (key, value)
select 'demo_access', '{"dias_de_sessao": 30}'::jsonb
 where not exists (select 1 from public.lv_settings where key = 'demo_access');
