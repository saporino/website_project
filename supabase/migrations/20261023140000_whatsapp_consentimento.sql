-- =====================================================================
-- Consentimento de WhatsApp — a peça que falta para enviar algo comercial
--
-- O QUE A AUDITORIA DE 23/10/2026 ENCONTROU. A caixa de entrada do WhatsApp
-- está pronta: cinco tabelas (`wa_contatos`, `wa_conversas`, `wa_mensagens`,
-- `wa_numeros`, `wa_eventos`), duas Edge Functions e a tela no RepCo — tudo
-- na `main`, tudo funcionando em staging.
--
-- E **não existe nenhum registro de consentimento**. Nenhuma coluna, nenhuma
-- tabela, nada que diga "esta pessoa autorizou receber oferta nossa".
--
-- POR QUE ISSO BLOQUEIA O OBJETIVO DELE. Responder quem escreveu primeiro é
-- atendimento e não precisa de autorização prévia. **Mandar oferta é outra
-- coisa**: a LGPD exige base legal, e as regras da Meta exigem opt-in com
-- registro de origem e momento. Sem isto, a conta pode ser restringida pela
-- própria Meta e a empresa fica exposta.
--
-- Tem contato espalhado em sete lugares (marketing_contacts, b2b_leads,
-- representative_clients, user_profiles, b2b_contatos, cliente_contatos,
-- candidaturas_representante). Nenhum deles guarda consentimento — foram
-- feitos para cadastro, não para marketing.
--
-- A DECISÃO: consentimento é registro PRÓPRIO, não coluna em cadastro.
-- Coluna booleana num cadastro responde "pode?" e não responde "desde
-- quando, por qual canal, com qual texto, e quem desmarcou". Quando alguém
-- reclamar — e numa operação de WhatsApp alguém reclama — é a segunda
-- pergunta que importa.
--
-- ⚠️ APLICADA SÓ EM STAGING. Nada aqui envia mensagem nem gera custo, mas a
-- estrutura de consentimento vale para o dia em que o envio existir, e ele
-- pediu para não mexer em produção sem autorização.
-- =====================================================================

create table if not exists public.wa_consentimentos (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,

  -- O telefone é a identidade aqui. A pessoa pode não ter cadastro nenhum e
  -- mesmo assim ter autorizado — ou revogado.
  telefone_e164   text not null,

  -- Para que ela autorizou. Separados de propósito: quem aceitou receber
  -- a confirmação do pedido NÃO aceitou receber promoção, e tratar as duas
  -- como a mesma coisa é o erro que gera denúncia.
  finalidade      text not null
                  check (finalidade in ('transacional', 'marketing', 'atendimento')),

  -- O estado atual. `pendente` existe porque confirmação em dois passos
  -- (pediu, ainda não confirmou) é o padrão mais seguro para marketing.
  estado          text not null default 'pendente'
                  check (estado in ('pendente', 'concedido', 'revogado')),

  -- ---- a prova, que é o que importa quando alguém reclama ----
  origem          text,          -- 'site_rodape', 'checkout', 'cadastro_pj', 'whatsapp_resposta'…
  texto_aceito    text,          -- a frase EXATA que a pessoa leu ao aceitar
  ip              text,
  agente          text,          -- user-agent, quando veio da web
  concedido_em    timestamptz,
  revogado_em     timestamptz,
  revogado_por    text,          -- 'titular', 'admin', 'meta_block', 'bounce'

  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),

  constraint wa_consent_telefone_digitos check (telefone_e164 ~ '^[0-9]{8,15}$'),
  -- Um registro por (empresa, telefone, finalidade): o histórico de mudanças
  -- vive em `wa_consentimento_eventos`, não em linhas duplicadas.
  constraint wa_consent_unico unique (company_id, telefone_e164, finalidade)
);

comment on table public.wa_consentimentos is
  'Quem autorizou receber o quê, desde quando, por qual canal e com qual texto. Responder quem escreveu é atendimento; mandar oferta exige isto.';
comment on column public.wa_consentimentos.finalidade is
  'transacional (confirmação de pedido), marketing (oferta) e atendimento são DIFERENTES. Aceitar um não é aceitar o outro.';
comment on column public.wa_consentimentos.texto_aceito is
  'A frase exata que a pessoa leu. Sem isto, "ela aceitou" é palavra contra palavra.';

create index if not exists idx_wa_consent_busca
  on public.wa_consentimentos (company_id, telefone_e164);
create index if not exists idx_wa_consent_envio
  on public.wa_consentimentos (company_id, finalidade, estado)
  where estado = 'concedido';

-- ---------------------------------------------------------------------
-- O histórico: toda mudança fica, nenhuma é sobrescrita
-- ---------------------------------------------------------------------
-- Consentimento revogado não vira linha apagada. A pergunta "quando ela
-- descadastrou?" só tem resposta se a mudança virou registro.
create table if not exists public.wa_consentimento_eventos (
  id              uuid primary key default gen_random_uuid(),
  consentimento_id uuid not null references public.wa_consentimentos(id) on delete cascade,
  de              text,
  para            text not null,
  motivo          text,
  por             text,
  em              timestamptz not null default now()
);

create index if not exists idx_wa_consent_ev
  on public.wa_consentimento_eventos (consentimento_id, em desc);

-- ⚠️ DOIS GATILHOS, e a separação não é preciosismo.
--
-- A primeira versão fazia tudo num BEFORE INSERT OR UPDATE — e quebrou no
-- teste com violação de chave estrangeira: no BEFORE INSERT a linha ainda não
-- existe, então o histórico apontava para um id que não estava no banco.
--
-- As duas coisas acontecem em momentos diferentes:
--   BEFORE  -> carimbar as datas, porque é preciso mexer no NEW antes de gravar
--   AFTER   -> escrever o histórico, porque é preciso que a linha exista

create or replace function public.wa_consentimento_datas()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  if new.estado = 'concedido' and new.concedido_em is null then new.concedido_em := now(); end if;
  if new.estado = 'revogado'  and new.revogado_em  is null then new.revogado_em  := now(); end if;
  return new;
end $$;

create or replace function public.wa_consentimento_historico()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.wa_consentimento_eventos (consentimento_id, de, para, motivo, por)
    values (new.id, null, new.estado, new.origem, current_user);
  elsif new.estado is distinct from old.estado then
    insert into public.wa_consentimento_eventos (consentimento_id, de, para, motivo, por)
    values (new.id, old.estado, new.estado, new.revogado_por, current_user);
  end if;
  return null;
end $$;

drop trigger if exists trg_wa_consent_hist on public.wa_consentimentos;
drop trigger if exists trg_wa_consent_datas on public.wa_consentimentos;

create trigger trg_wa_consent_datas
  before insert or update on public.wa_consentimentos
  for each row execute function public.wa_consentimento_datas();

create trigger trg_wa_consent_hist
  after insert or update of estado on public.wa_consentimentos
  for each row execute function public.wa_consentimento_historico();

-- ---------------------------------------------------------------------
-- A pergunta que o envio tem de fazer, SEMPRE
-- ---------------------------------------------------------------------
-- Fail closed: sem registro, a resposta é NÃO. Silêncio não é consentimento,
-- e "achei que podia" não é defesa.
create or replace function public.wa_pode_enviar(
  p_company uuid, p_telefone text, p_finalidade text default 'marketing')
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wa_consentimentos c
     where c.company_id = p_company
       and c.telefone_e164 = p_telefone
       and c.finalidade = p_finalidade
       and c.estado = 'concedido'
  );
$$;

comment on function public.wa_pode_enviar(uuid, text, text) is
  'Fail closed: sem registro de consentimento concedido, devolve false. Silêncio não é consentimento.';

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.wa_consentimentos        enable row level security;
alter table public.wa_consentimento_eventos enable row level security;

drop policy if exists wa_consent_admin on public.wa_consentimentos;
create policy wa_consent_admin on public.wa_consentimentos
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists wa_consent_ev_admin on public.wa_consentimento_eventos;
create policy wa_consent_ev_admin on public.wa_consentimento_eventos
  for all using (public.is_admin()) with check (public.is_admin());
