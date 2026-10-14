-- WhatsApp Cloud API — caixa de entrada da COFICO dentro do RepCo.
--
-- Cinco tabelas, nascidas com isolamento por empresa. O resto do sistema tem essa dívida
-- (a própria política de privacidade publicada admite, em §8.2, que hoje o controle é por
-- papel e não separação técnica completa). Este módulo nasce do lado certo da frase.
--
-- Decisões que a estrutura IMPÕE, não confia:
--   1. A empresa vem do `phone_number_id` que a Meta manda no evento, via `wa_numeros`.
--      Não existe empresa padrão: número desconhecido não vira mensagem (FK), só evento cru.
--   2. Contato externo NÃO é usuário. Nenhuma tabela de contato aponta para auth.users.
--   3. Reenvio do mesmo evento não duplica nada: `wamid` é único e o corpo tem impressão
--      digital própria.
--   4. `anon` perde todos os privilégios nestas tabelas, explicitamente. RLS já barraria,
--      mas conteúdo de conversa não depende de uma única linha de defesa.
--
-- NADA aqui ativa a integração. É só onde o dado vai morar.

-- ───────────────────────────────────────────────────── papel de quem atende
insert into public.roles (code, label, description) values
  ('atendimento', 'Atendimento', 'Lê e responde as conversas de WhatsApp da empresa a que foi vinculado')
on conflict (code) do nothing;

-- ───────────────────────────────────────── 1. wa_numeros — o elo número ↔ empresa
-- É a tabela que impede mensagem de uma marca cair na caixa da outra.
create table if not exists public.wa_numeros (
  id                   uuid primary key default gen_random_uuid(),
  phone_number_id      text not null unique,          -- o que a Meta manda em metadata
  waba_id              text,
  numero_e164          text not null,
  company_id           uuid not null references public.companies(id) on delete restrict,
  -- nome do CONJUNTO de secrets (mesmo padrão de companies.payment_account). O valor do
  -- token nunca entra no banco.
  conjunto_credencial  text not null,
  ambiente             text not null default 'teste' check (ambiente in ('teste','producao')),
  ativo                boolean not null default true,
  rotulo               text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);
comment on table public.wa_numeros is
  'Numero do WhatsApp por empresa. O phone_number_id do evento decide o dono da mensagem; nao existe empresa padrao.';
comment on column public.wa_numeros.conjunto_credencial is
  'Nome do conjunto de secrets (ex.: cofico). O token em si NUNCA fica no banco.';

-- ──────────────────────────────────── 2. wa_contatos — quem escreve, sem ser usuário
create table if not exists public.wa_contatos (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies(id) on delete cascade,
  telefone_e164           text not null,
  nome_perfil             text,
  -- vínculo OPCIONAL com o cadastro comercial. Contato externo existe sem cliente, sem
  -- usuário e sem nada: é só um telefone que escreveu.
  representative_client_id uuid references public.representative_clients(id) on delete set null,
  marketing_contact_id    uuid references public.marketing_contacts(id) on delete set null,
  primeira_mensagem_em    timestamptz,
  ultima_mensagem_em      timestamptz,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),
  constraint wa_contatos_telefone_digitos check (telefone_e164 ~ '^[0-9]{8,15}$'),
  constraint wa_contatos_unico_por_empresa unique (company_id, telefone_e164)
);
comment on table public.wa_contatos is
  'Contato externo de WhatsApp. NAO referencia auth.users: quem escreve de fora nunca e usuario do sistema.';

-- ─────────────────────────── 3. wa_conversas — o fio, e a janela de 24 h do atendimento
create table if not exists public.wa_conversas (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  numero_id          uuid not null references public.wa_numeros(id) on delete restrict,
  contato_id         uuid not null references public.wa_contatos(id) on delete cascade,
  status             text not null default 'aberta' check (status in ('aberta','fechada')),
  -- a conta da janela: a Meta só deixa responder em texto livre nas 24 h seguintes à
  -- ÚLTIMA mensagem que o cliente mandou. Fora dela, só modelo aprovado, que é cobrado.
  ultima_entrada_em  timestamptz,
  ultima_saida_em    timestamptz,
  nao_lidas          integer not null default 0 check (nao_lidas >= 0),
  -- quem assumiu o atendimento, para duas pessoas não responderem a mesma conversa
  responsavel_id     uuid references auth.users(id) on delete set null,
  assumida_em        timestamptz,
  criada_em          timestamptz not null default now(),
  atualizada_em      timestamptz not null default now(),
  constraint wa_conversas_uma_por_contato_e_numero unique (contato_id, numero_id)
);
comment on column public.wa_conversas.ultima_entrada_em is
  'Ultima mensagem RECEBIDA. E a base da janela de 24h: fora dela, so modelo aprovado (cobrado).';

-- ───────────────────────────────── 4. wa_mensagens — o conteúdo, com idempotência
create table if not exists public.wa_mensagens (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  conversa_id    uuid not null references public.wa_conversas(id) on delete cascade,
  -- wamid. UNICO: reenvio do mesmo evento pela Meta nao duplica a mensagem.
  id_externo     text not null unique,
  direcao        text not null check (direcao in ('entrada','saida')),
  tipo           text not null default 'texto'
    check (tipo in ('texto','imagem','documento','audio','video','figurinha',
                    'localizacao','contato','botao','lista','reacao','modelo','outro')),
  texto          text,
  midia_id       text,                      -- id na Meta; o arquivo vai para o bucket privado
  midia_mime     text,
  midia_url      text,                      -- caminho no storage privado, nunca URL publica
  -- estado só existe para o que NÓS enviamos; o que entra já chegou.
  estado         text check (estado in ('enviada','entregue','lida','falhou')),
  erro_codigo    text,
  erro_texto     text,
  enviada_por    uuid references auth.users(id) on delete set null,
  ocorrida_em    timestamptz not null,
  criada_em      timestamptz not null default now(),
  constraint wa_mensagens_saida_tem_estado check (direcao = 'entrada' or estado is not null),
  constraint wa_mensagens_entrada_sem_autor check (direcao = 'saida' or enviada_por is null)
);
comment on column public.wa_mensagens.id_externo is
  'wamid da Meta. UNICO: e a idempotencia contra reenvio de webhook.';

-- ──────────────────── 5. wa_eventos — o que a Meta mandou, cru, para auditar e reprocessar
-- Aceita evento de numero DESCONHECIDO (company_id nulo) de proposito: e assim que se vê
-- uma configuracao errada ou alguem batendo na URL. Linha sem empresa so o admin le.
create table if not exists public.wa_eventos (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references public.companies(id) on delete set null,
  phone_number_id  text,
  -- impressao digital do corpo CRU recebido. Entrega repetida e identica nao vira linha nova.
  assinatura       text not null unique,
  corpo            jsonb not null,
  mensagens        integer not null default 0,
  statuses         integer not null default 0,
  ignorados        integer not null default 0,
  resultado        text not null default 'recebido'
    check (resultado in ('recebido','processado','numero_desconhecido','assinatura_invalida','erro')),
  detalhe          text,
  recebido_em      timestamptz not null default now()
);
comment on table public.wa_eventos is
  'Evento cru da Meta. Permite reprocessar sem pedir nada a ela e explicar qualquer numero depois.';
comment on column public.wa_eventos.company_id is
  'Nulo quando o phone_number_id nao esta em wa_numeros - e esse o sinal de configuracao errada.';

-- ─────────────────────────────────────────────────────────────────────── índices
create index if not exists wa_numeros_empresa on public.wa_numeros (company_id) where ativo;
create index if not exists wa_contatos_empresa on public.wa_contatos (company_id, ultima_mensagem_em desc);
create index if not exists wa_contatos_cliente on public.wa_contatos (representative_client_id)
  where representative_client_id is not null;
create index if not exists wa_conversas_caixa on public.wa_conversas (company_id, status, ultima_entrada_em desc);
create index if not exists wa_conversas_responsavel on public.wa_conversas (responsavel_id)
  where responsavel_id is not null;
create index if not exists wa_mensagens_fio on public.wa_mensagens (conversa_id, ocorrida_em desc);
create index if not exists wa_mensagens_empresa on public.wa_mensagens (company_id, ocorrida_em desc);
create index if not exists wa_eventos_recentes on public.wa_eventos (recebido_em desc);
create index if not exists wa_eventos_problema on public.wa_eventos (resultado, recebido_em desc)
  where resultado <> 'processado';

-- ───────────────────────────────── a empresa vem do número, sempre, sem padrão
create or replace function public.wa_empresa_do_numero(p_phone_number_id text)
returns uuid language sql stable security definer set search_path to 'public','pg_temp' as $$
  select company_id from public.wa_numeros
   where phone_number_id = p_phone_number_id and ativo
   limit 1;
$$;
comment on function public.wa_empresa_do_numero(text) is
  'Empresa dona do numero. NULL quando o numero nao esta cadastrado - e nunca ha empresa padrao.';

-- A empresa da mensagem e da conversa tem de ser a MESMA do número e do contato. Sem isto,
-- um insert com company_id trocado passaria pela RLS de quem tem papel na outra empresa.
create or replace function public.wa_coerencia_de_empresa()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_empresa uuid;
begin
  if tg_table_name = 'wa_conversas' then
    select company_id into v_empresa from public.wa_numeros where id = new.numero_id;
    if v_empresa is distinct from new.company_id then
      raise exception 'conversa % nao pertence a empresa do numero', new.id
        using errcode = 'check_violation';
    end if;
    select company_id into v_empresa from public.wa_contatos where id = new.contato_id;
    if v_empresa is distinct from new.company_id then
      raise exception 'conversa % nao pertence a empresa do contato', new.id
        using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'wa_mensagens' then
    select company_id into v_empresa from public.wa_conversas where id = new.conversa_id;
    if v_empresa is distinct from new.company_id then
      -- a mensagem NAO entra na exceção: conteudo de conversa nao vaza em texto de erro.
      raise exception 'mensagem % nao pertence a empresa da conversa', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists wa_conversas_coerencia on public.wa_conversas;
create trigger wa_conversas_coerencia before insert or update on public.wa_conversas
  for each row execute function public.wa_coerencia_de_empresa();
drop trigger if exists wa_mensagens_coerencia on public.wa_mensagens;
create trigger wa_mensagens_coerencia before insert or update on public.wa_mensagens
  for each row execute function public.wa_coerencia_de_empresa();

-- ──────────────────────────────────────────────────────────────────────── RLS
alter table public.wa_numeros   enable row level security;
alter table public.wa_contatos  enable row level security;
alter table public.wa_conversas enable row level security;
alter table public.wa_mensagens enable row level security;
alter table public.wa_eventos   enable row level security;

-- Defesa em profundidade: RLS ja barraria, mas conteudo de conversa nao depende de uma
-- unica linha. `anon` (visitante nao autenticado) perde tudo, explicitamente.
revoke all on public.wa_numeros, public.wa_contatos, public.wa_conversas,
              public.wa_mensagens, public.wa_eventos from anon;

do $$
declare t text;
begin
  foreach t in array array['wa_numeros','wa_contatos','wa_conversas','wa_mensagens'] loop
    execute format('drop policy if exists %I_admin on public.%I', t, t);
    execute format($p$create policy %I_admin on public.%I for all to authenticated
                     using (public.is_admin()) with check (public.is_admin())$p$, t, t);
    execute format('drop policy if exists %I_atendimento on public.%I', t, t);
    execute format($p$create policy %I_atendimento on public.%I for all to authenticated
                     using (public.has_role('atendimento', company_id))
                     with check (public.has_role('atendimento', company_id))$p$, t, t);
  end loop;
end $$;

-- O evento cru e material de auditoria: so admin. Inclui as linhas sem empresa, que sao
-- justamente o sinal de configuracao errada ou de alguem batendo na URL.
drop policy if exists wa_eventos_admin on public.wa_eventos;
create policy wa_eventos_admin on public.wa_eventos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
