-- =====================================================================
-- Ficha PJ: cobrança, recebimento, perfil comercial e documentos (16/10/2026)
--
-- Comparando a ficha em PDF que a Saporino usa hoje (128 campos) com o que o
-- portal já guarda, faltavam quatro grupos. Três são da ficha comercial; o
-- quarto é a via contrária — os documentos que a COFICO entrega ao cliente.
--
-- E UMA FALHA MINHA: o briefing pedia "endereço de cobrança E entrega" e eu
-- publiquei só o de entrega. A cobrança entra aqui.
--
-- Fica de fora de propósito: limite de crédito, prazo pretendido, referências
-- comerciais, documentos do cliente. Isso é a etapa de ANÁLISE DE CRÉDITO, que
-- é separada por decisão do Vlademir — cadastro aprovado não é crédito aprovado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Endereço de cobrança (o que faltava)
-- ---------------------------------------------------------------------
alter table public.representative_clients
  add column if not exists cobranca_mesmo_endereco boolean not null default true,
  add column if not exists cobranca_cep text,
  add column if not exists cobranca_logradouro text,
  add column if not exists cobranca_numero text,
  add column if not exists cobranca_complemento text,
  add column if not exists cobranca_bairro text,
  add column if not exists cobranca_municipio text,
  add column if not exists cobranca_uf text;

comment on column public.representative_clients.cobranca_mesmo_endereco is
  'true = cobrar no endereço cadastral. false = usar os campos cobranca_*. Boleto no endereço errado volta.';

-- ---------------------------------------------------------------------
-- 2. Recebimento de mercadoria
-- ---------------------------------------------------------------------
-- Sem isto a entrega chega em dia de inventário, ou às 17h num lugar que
-- recebe até as 11h — e volta. É a informação que a logística pede primeiro.
alter table public.representative_clients
  add column if not exists recebimento_dias text,
  add column if not exists recebimento_horario text,
  add column if not exists recebimento_agendamento boolean,
  add column if not exists recebimento_agenda_contato text,
  add column if not exists recebimento_agenda_telefone text,
  add column if not exists recebimento_observacoes text;

comment on column public.representative_clients.recebimento_agendamento is
  'true = a entrega precisa ser agendada antes. Rede grande quase sempre precisa.';

-- ---------------------------------------------------------------------
-- 3. Perfil comercial
-- ---------------------------------------------------------------------
alter table public.representative_clients
  add column if not exists tipo_estabelecimento text,
  add column if not exists qtd_lojas integer,
  add column if not exists volume_mensal_estimado text,
  add column if not exists frequencia_pedidos text,
  add column if not exists regiao_atuacao text;

comment on column public.representative_clients.qtd_lojas is
  'Quantas lojas a empresa tem. 1 = loja única. Acima disso vira rede — o cadastro de cada unidade é etapa posterior.';

-- ---------------------------------------------------------------------
-- 4. Documentos que a COFICO entrega ao cliente
-- ---------------------------------------------------------------------
-- Via contrária da ficha: todo cliente pede os dados cadastrais do fornecedor
-- para abrir o cadastro no sistema dele. Hoje isso vai por e-mail, à mão.
--
-- `visibilidade` nasce 'restrito' de propósito: documento novo fica fechado até
-- alguém decidir abrir. O contrário — nascer aberto e depender de lembrar de
-- fechar — é como CPF de sócio vaza.
create table if not exists public.documentos_fornecedor (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies(id) on delete set null,
  marca         text,
  titulo        text not null,
  descricao     text,
  tipo          text not null default 'cadastral',
  visibilidade  text not null default 'restrito',
  arquivo_path  text not null,
  arquivo_nome  text not null,
  tamanho_bytes integer,
  ordem         integer not null default 0,
  ativo         boolean not null default true,
  criado_por    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documentos_fornecedor_vis_check') then
    alter table public.documentos_fornecedor add constraint documentos_fornecedor_vis_check
      check (visibilidade in ('comercial', 'restrito'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'documentos_fornecedor_tipo_check') then
    alter table public.documentos_fornecedor add constraint documentos_fornecedor_tipo_check
      check (tipo in ('cadastral', 'ficha_tecnica', 'certificado', 'contrato', 'outro'));
  end if;
end $$;

comment on table public.documentos_fornecedor is
  'Documentos que a COFICO disponibiliza ao cliente PJ. visibilidade=comercial é o que cliente autenticado baixa; restrito só sai por liberação.';
comment on column public.documentos_fornecedor.marca is
  'Marca a que o documento se refere (ficha técnica). Nulo = documento da empresa, não de um produto.';

alter table public.documentos_fornecedor enable row level security;

-- Quem LÊ a listagem: cliente PJ autenticado vê só os 'comercial'. Visitante e
-- cliente PF não veem nada — não há policy que os alcance.
create policy documentos_fornecedor_cliente_le
  on public.documentos_fornecedor for select
  using (
    ativo
    and visibilidade = 'comercial'
    and public.minha_ficha_pj() is not null
  );

create policy documentos_fornecedor_equipe
  on public.documentos_fornecedor for select
  using (public.is_admin() or public.has_role('gerente_comercial')
         or public.has_role('supervisor') or public.my_rep_id() is not null);

create policy documentos_fornecedor_admin_escreve
  on public.documentos_fornecedor for all
  using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 5. O arquivo em si — protegido por Edge Function, nao por policy de storage
-- ---------------------------------------------------------------------
-- O bucket `documentos-fornecedor` e PRIVADO e ninguem le direto dele. Quem
-- entrega o arquivo e a Edge Function `documento-fornecedor`: confere a sessao,
-- confere que a pessoa tem ficha PJ, confere que o documento esta marcado como
-- 'comercial', e so entao gera uma URL assinada de validade curta.
--
-- Por que nao uma policy em storage.objects: cria-la exige ser DONO daquela
-- tabela, e o papel que aplica migrations em producao nao e. A tentativa falhou
-- com 'must be owner of table objects'. A Edge Function resolve melhor de todo
-- jeito: a decisao fica num lugar so, legivel, sem privilegio especial.
