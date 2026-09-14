-- Marca de ambiente dentro do próprio banco.
--
-- As bancadas destrutivas do Coffee LiVRE (scripts/_ambiente.mjs) só rodam
-- quando ESTA linha diz "staging" com o ref do projeto a que se conectaram.
-- O nome do projeto no painel não conta; o arquivo .env também não basta.
--
-- A tabela nasce vazia em todo banco. Quem marca é um passo explícito:
--   staging  → scripts/coffeelivre-staging.mjs marcar  (parte da reconstrução)
--   produção → a mesma ferramenta com --producao, uma vez só.
-- Banco sem marca é tratado como "não sei quem sou" e recusa a bancada.
--
-- Só a service role lê e escreve: nenhum papel do site precisa disto.

create table if not exists public.ambiente_do_banco (
  id smallint primary key default 1 check (id = 1),
  nome text not null check (nome in ('producao', 'staging')),
  project_ref text not null check (project_ref ~ '^[a-z0-9]{20}$'),
  marcado_em timestamptz not null default now()
);

alter table public.ambiente_do_banco enable row level security;

revoke all on public.ambiente_do_banco from anon, authenticated, public;
grant select, insert, update on public.ambiente_do_banco to service_role;

-- Sem policy para anon/authenticated de propósito: RLS ligada e nenhuma
-- permissão = invisível para o site. A service role ignora RLS.
drop policy if exists ambiente_do_banco_sem_acesso on public.ambiente_do_banco;
create policy ambiente_do_banco_sem_acesso on public.ambiente_do_banco
  for all to authenticated using (false) with check (false);

-- Trocar a marca de um banco para o nome oposto é recusado: um staging nunca
-- vira produção por engano (nem o contrário) — para isso, apague a linha.
create or replace function public.ambiente_do_banco_guarda()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.nome <> new.nome then
    raise exception 'ambiente_do_banco: não se troca % por % — apague a marca antes', old.nome, new.nome;
  end if;
  return new;
end $$;

drop trigger if exists ambiente_do_banco_guarda on public.ambiente_do_banco;
create trigger ambiente_do_banco_guarda before update on public.ambiente_do_banco
  for each row execute function public.ambiente_do_banco_guarda();
