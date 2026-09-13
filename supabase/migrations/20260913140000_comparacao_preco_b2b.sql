-- =====================================================================
-- Coffee LiVRE — Unidade 7: comparação de mercado, preço em um clique,
-- histórico de preço, B2B e iFood como benchmark (13/09/2026)
--
-- "O seller define os limites. O Coffee LiVRE faz o trabalho."
--
-- PREÇO EM UM CLIQUE: o Copiloto recomenda, o vendedor autoriza, o banco
-- executa. A função `lv_aplicar_preco` confere dono e PISO no servidor —
-- nenhum preço abaixo do piso passa por ela, nem chamando a API direto.
--
-- HISTÓRICO À PROVA DE EDIÇÃO: toda troca de preço, por qualquer caminho
-- (Copiloto, editor, admin), é gravada por trigger. O vendedor lê o próprio
-- histórico e não escreve nele: não existe policy de escrita. A origem
-- (manual, copiloto, desfazer, admin) vem do contexto da transação.
--
-- B2B: comprador profissional registra a necessidade por uma função
-- pública que só devolve o número da solicitação. Empresa e demanda são
-- dados de quem pediu: só o admin lê.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Histórico de preço
-- ---------------------------------------------------------------------
create table if not exists public.lv_price_history (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references public.lv_products(id) on delete cascade,
  seller_id            uuid not null references public.lv_sellers(id) on delete cascade,
  preco_anterior_cents bigint,
  preco_novo_cents     bigint not null,
  -- manual | copiloto | promocao | automatico (futuro) | desfazer | admin
  origem               text not null,
  motivo               text,
  -- A recomendação que motivou a troca: mediana, amostra, tipo. Para
  -- auditar depois "por que o Copiloto sugeriu isto".
  recomendacao         jsonb,
  user_id              uuid references auth.users(id) on delete set null,
  desfeito_em          timestamptz,
  desfaz_id            uuid references public.lv_price_history(id) on delete set null,
  is_demo              boolean not null default false,
  created_at           timestamptz not null default clock_timestamp(),
  constraint lv_price_history_origem check (origem in ('manual','copiloto','promocao','automatico','desfazer','admin'))
);

comment on table public.lv_price_history is
  'Toda troca de preco de produto, gravada por trigger. Vendedor le o proprio historico e nao escreve. Origem vem do contexto da transacao (lv.preco_origem).';

create index if not exists lv_price_history_por_produto on public.lv_price_history (product_id, created_at desc);
create index if not exists lv_price_history_por_vendedor on public.lv_price_history (seller_id, created_at desc);

alter table public.lv_price_history enable row level security;

drop policy if exists lv_price_history_admin on public.lv_price_history;
create policy lv_price_history_admin on public.lv_price_history
  for select to authenticated using (public.is_admin());

drop policy if exists lv_price_history_vendedor on public.lv_price_history;
create policy lv_price_history_vendedor on public.lv_price_history
  for select to authenticated using (seller_id = any(public.lv_meus_vendedores()));

create or replace function public.lv_registra_preco()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_origem text;
begin
  if new.preco_cents is not distinct from old.preco_cents or new.preco_cents is null then
    return new;
  end if;
  v_origem := nullif(current_setting('lv.preco_origem', true), '');
  if v_origem is null then
    v_origem := case when public.lv_chamada_privilegiada() then 'admin' else 'manual' end;
  end if;
  insert into public.lv_price_history
    (product_id, seller_id, preco_anterior_cents, preco_novo_cents, origem, motivo, recomendacao, user_id, desfaz_id, is_demo)
  values (
    new.id, new.seller_id, old.preco_cents, new.preco_cents, v_origem,
    nullif(current_setting('lv.preco_motivo', true), ''),
    nullif(current_setting('lv.preco_recomendacao', true), '')::jsonb,
    auth.uid(),
    nullif(current_setting('lv.preco_desfaz', true), '')::uuid,
    new.is_demo
  );
  return new;
end;
$$;

revoke all on function public.lv_registra_preco() from public;

drop trigger if exists lv_registra_preco on public.lv_products;
create trigger lv_registra_preco
  after update of preco_cents on public.lv_products
  for each row execute function public.lv_registra_preco();

-- Limpa o contexto para a próxima escrita da mesma transação não herdar.
create or replace function public.lv_limpar_contexto_de_preco()
returns void
language sql
as $$
  select set_config('lv.preco_origem', '', true), set_config('lv.preco_motivo', '', true),
         set_config('lv.preco_recomendacao', '', true), set_config('lv.preco_desfaz', '', true);
$$;

-- ---------------------------------------------------------------------
-- 2. Aplicar preço (um clique)
-- ---------------------------------------------------------------------
-- SECURITY DEFINER para gravar o contexto e ler o piso; o dono é conferido
-- aqui, explicitamente. O UPDATE continua passando pelo `lv_guarda_produto`
-- como vendedor: queda de preço acima de 50% ainda manda para moderação.
create or replace function public.lv_aplicar_preco(
  p_product uuid,
  p_preco_cents bigint,
  p_origem text default 'copiloto',
  p_motivo text default null,
  p_recomendacao jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_status text;
  v_hist uuid;
begin
  -- "automatico" existe no vocabulário para o futuro, mas nesta fase nada
  -- muda preço sem o vendedor autorizar.
  if p_origem not in ('manual', 'copiloto', 'promocao') then
    raise exception 'Origem de alteração não permitida.';
  end if;

  select id, seller_id, preco_cents, preco_minimo_cents into v
    from public.lv_products where id = p_product;
  if not found or not (v.seller_id = any(public.lv_meus_vendedores()) or public.is_admin()) then
    raise exception 'Produto não encontrado.';
  end if;
  if p_preco_cents is null or p_preco_cents <= 0 then
    raise exception 'Preço inválido.';
  end if;
  if v.preco_minimo_cents is not null and p_preco_cents < v.preco_minimo_cents then
    raise exception 'O novo preço fica abaixo do seu preço mínimo. Nada foi alterado.';
  end if;
  if p_preco_cents = v.preco_cents then
    raise exception 'O produto já está com este preço.';
  end if;

  perform set_config('lv.preco_origem', p_origem, true);
  perform set_config('lv.preco_motivo', coalesce(left(p_motivo, 500), ''), true);
  perform set_config('lv.preco_recomendacao', coalesce(p_recomendacao::text, ''), true);
  perform set_config('lv.preco_desfaz', '', true);

  update public.lv_products set preco_cents = p_preco_cents, updated_at = now()
   where id = p_product
  returning status into v_status;

  perform public.lv_limpar_contexto_de_preco();

  select id into v_hist from public.lv_price_history
   where product_id = p_product order by created_at desc limit 1;

  return jsonb_build_object(
    'history_id', v_hist, 'status', v_status,
    'preco_anterior_cents', v.preco_cents, 'preco_novo_cents', p_preco_cents);
end;
$$;

revoke all on function public.lv_aplicar_preco(uuid, bigint, text, text, jsonb) from public;
grant execute on function public.lv_aplicar_preco(uuid, bigint, text, text, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Desfazer, quando é seguro
-- ---------------------------------------------------------------------
-- Seguro = é a última troca daquele produto, o preço ainda é o que ela
-- colocou, não foi desfeita, tem menos de 24 horas e o preço anterior não
-- fura o piso atual.
create or replace function public.lv_desfazer_preco(p_history uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h record;
  v_status text;
begin
  select ph.*, p.preco_cents as atual, p.preco_minimo_cents as piso
    into h
    from public.lv_price_history ph
    join public.lv_products p on p.id = ph.product_id
   where ph.id = p_history;
  if not found or not (h.seller_id = any(public.lv_meus_vendedores()) or public.is_admin()) then
    raise exception 'Alteração não encontrada.';
  end if;
  if h.desfeito_em is not null then raise exception 'Esta alteração já foi desfeita.'; end if;
  if h.origem = 'desfazer' then raise exception 'Uma alteração de desfazer não pode ser desfeita.'; end if;
  if h.preco_anterior_cents is null then raise exception 'Não há preço anterior para restaurar.'; end if;
  if exists (select 1 from public.lv_price_history x where x.product_id = h.product_id and x.created_at > h.created_at) then
    raise exception 'Houve outra alteração de preço depois desta.';
  end if;
  if h.atual is distinct from h.preco_novo_cents then raise exception 'O preço mudou desde esta alteração.'; end if;
  if h.created_at < now() - interval '24 hours' then raise exception 'Só é possível desfazer em até 24 horas.'; end if;
  if h.piso is not null and h.preco_anterior_cents < h.piso then
    raise exception 'O preço anterior fica abaixo do seu preço mínimo atual.';
  end if;

  perform set_config('lv.preco_origem', 'desfazer', true);
  perform set_config('lv.preco_motivo', 'Desfeita a alteração anterior', true);
  perform set_config('lv.preco_recomendacao', '', true);
  perform set_config('lv.preco_desfaz', p_history::text, true);

  update public.lv_products set preco_cents = h.preco_anterior_cents, updated_at = now()
   where id = h.product_id
  returning status into v_status;

  perform public.lv_limpar_contexto_de_preco();

  update public.lv_price_history set desfeito_em = now() where id = p_history;

  return jsonb_build_object('status', v_status, 'preco_cents', h.preco_anterior_cents);
end;
$$;

revoke all on function public.lv_desfazer_preco(uuid) from public;
grant execute on function public.lv_desfazer_preco(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. B2B
-- ---------------------------------------------------------------------
create table if not exists public.lv_b2b_empresas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  cnpj         text,
  cidade       text,
  uf           char(2),
  tipo_negocio text not null,
  responsavel  text,
  email        text,
  telefone     text,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint lv_b2b_empresas_tipo check (tipo_negocio in (
    'cafeteria','hotel','restaurante','padaria','escritorio','cozinha_industrial','mercado','distribuidor','outro'))
);

create table if not exists public.lv_b2b_solicitacoes (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.lv_b2b_empresas(id) on delete cascade,
  classificacao       text,
  gramatura_g         integer,
  moagem              text,
  -- Volume: consumo do mês e quanto por entrega.
  consumo_mensal_kg   integer,
  quantidade_kg       integer not null,
  -- unica | semanal | quinzenal | mensal. Só a INTENÇÃO: não há cobrança
  -- recorrente nesta fase.
  frequencia          text not null,
  observacao          text,
  -- novo | em_analise | atendido | encerrado
  status              text not null default 'novo',
  nota_interna        text,
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint lv_b2b_solicitacoes_frequencia check (frequencia in ('unica','semanal','quinzenal','mensal')),
  constraint lv_b2b_solicitacoes_status check (status in ('novo','em_analise','atendido','encerrado')),
  constraint lv_b2b_solicitacoes_quantidade check (quantidade_kg > 0 and quantidade_kg <= 100000),
  constraint lv_b2b_solicitacoes_gramatura check (gramatura_g is null or gramatura_g > 0)
);

comment on table public.lv_b2b_solicitacoes is
  'Demanda de comprador profissional: o que quer, quanto e com que frequencia. Frequencia e intencao, nao cobranca recorrente. So admin le.';

create index if not exists lv_b2b_solicitacoes_por_status on public.lv_b2b_solicitacoes (status, created_at desc);

alter table public.lv_b2b_empresas enable row level security;
alter table public.lv_b2b_solicitacoes enable row level security;

drop policy if exists lv_b2b_empresas_admin on public.lv_b2b_empresas;
create policy lv_b2b_empresas_admin on public.lv_b2b_empresas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists lv_b2b_solicitacoes_admin on public.lv_b2b_solicitacoes;
create policy lv_b2b_solicitacoes_admin on public.lv_b2b_solicitacoes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Entrada pública. Cria empresa e solicitação juntas e devolve só o id:
-- o visitante não lê nada do que foi gravado, nem o que outros pediram.
create or replace function public.lv_b2b_solicitar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_id uuid;
  v_nome text := btrim(coalesce(p->>'nome', ''));
  v_tipo text := coalesce(p->>'tipo_negocio', '');
  v_freq text := coalesce(p->>'frequencia', '');
  v_qtd int;
  v_uf text := upper(nullif(btrim(coalesce(p->>'uf', '')), ''));
begin
  if length(v_nome) < 2 or length(v_nome) > 120 then raise exception 'Informe o nome da empresa.'; end if;
  if v_tipo not in ('cafeteria','hotel','restaurante','padaria','escritorio','cozinha_industrial','mercado','distribuidor','outro') then
    raise exception 'Escolha o tipo de negócio.';
  end if;
  if v_freq not in ('unica','semanal','quinzenal','mensal') then raise exception 'Escolha a frequência.'; end if;
  begin
    v_qtd := (p->>'quantidade_kg')::int;
  exception when others then
    raise exception 'Informe a quantidade em kg.';
  end;
  if v_qtd is null or v_qtd <= 0 or v_qtd > 100000 then raise exception 'Informe a quantidade em kg.'; end if;
  if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then raise exception 'UF inválida.'; end if;
  if nullif(btrim(coalesce(p->>'email', '')), '') is not null and (p->>'email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.';
  end if;

  insert into public.lv_b2b_empresas (nome, cnpj, cidade, uf, tipo_negocio, responsavel, email, telefone)
  values (
    v_nome, nullif(regexp_replace(coalesce(p->>'cnpj', ''), '\D', '', 'g'), ''),
    nullif(left(btrim(coalesce(p->>'cidade', '')), 80), ''), v_uf, v_tipo,
    nullif(left(btrim(coalesce(p->>'responsavel', '')), 120), ''),
    nullif(left(btrim(coalesce(p->>'email', '')), 160), ''),
    nullif(left(btrim(coalesce(p->>'telefone', '')), 30), '')
  )
  returning id into v_empresa;

  insert into public.lv_b2b_solicitacoes
    (empresa_id, classificacao, gramatura_g, moagem, consumo_mensal_kg, quantidade_kg, frequencia, observacao)
  values (
    v_empresa,
    nullif(left(btrim(coalesce(p->>'classificacao', '')), 40), ''),
    nullif(p->>'gramatura_g', '')::int,
    nullif(left(btrim(coalesce(p->>'moagem', '')), 40), ''),
    nullif(p->>'consumo_mensal_kg', '')::int,
    v_qtd, v_freq,
    nullif(left(btrim(coalesce(p->>'observacao', '')), 1000), '')
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function public.lv_b2b_solicitar(jsonb) from public;
grant execute on function public.lv_b2b_solicitar(jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. iFood no mesmo modelo de tarifas, como DELIVERY / CONVENIÊNCIA
-- ---------------------------------------------------------------------
alter table public.lv_tarifas_simulacao
  add column if not exists modelo text not null default 'marketplace';

alter table public.lv_tarifas_simulacao drop constraint if exists lv_tarifas_modelo;
alter table public.lv_tarifas_simulacao add constraint lv_tarifas_modelo
  check (modelo in ('marketplace', 'delivery_conveniencia'));

alter table public.lv_tarifas_simulacao drop constraint if exists lv_tarifas_plataforma;
alter table public.lv_tarifas_simulacao add constraint lv_tarifas_plataforma
  check (plataforma in ('coffeelivre','mercado_livre','shopee','amazon','magalu','ifood'));

comment on column public.lv_tarifas_simulacao.modelo is
  'marketplace = comparavel na Calculadora; delivery_conveniencia = economia diferente (entrega rapida, loja de bairro, item de cesta). Nunca comparar os dois como equivalentes.';

insert into public.lv_tarifas_simulacao
  (plataforma, modalidade, componente, percentual_bps, valor_cents, confiabilidade, natureza, modelo,
   rotulo, fonte, verificado_em, observacao, ordem)
select v.plataforma, v.modalidade, v.componente, v.bps, v.valor, 'fonte_secundaria', 'benchmark', 'delivery_conveniencia',
       v.rotulo, 'Relatório "Café no iFood — Raio-X de mercado, preços e taxas", seção 10.3 (valores públicos do iFood e da imprensa, 2026; não medidos na coleta)',
       '2026-09-13', v.obs, v.ordem
  from (values
    ('ifood', 'basico', 'comissao', 1200, null::bigint, 'Comissão plano Básico (loja entrega)', 'Plano em que a própria loja entrega.', 1),
    ('ifood', 'basico', 'pagamento', 320, null::bigint, 'Pagamento online (3,2%)', null, 3),
    ('ifood', 'basico', 'mensalidade', null::integer, 11000::bigint, 'Mensalidade plano Básico', 'Cobrada só acima de R$ 1.800 de venda mensal.', 5),
    ('ifood', 'entrega', 'comissao', 2300, null::bigint, 'Comissão plano Entrega (iFood entrega)', 'Plano em que o iFood entrega.', 1),
    ('ifood', 'entrega', 'pagamento', 350, null::bigint, 'Pagamento online (3,5%)', null, 3),
    ('ifood', 'entrega', 'mensalidade', null::integer, 15000::bigint, 'Mensalidade plano Entrega', 'Cobrada só acima de R$ 1.800 de venda mensal.', 5)
  ) as v(plataforma, modalidade, componente, bps, valor, rotulo, obs, ordem)
 where not exists (select 1 from public.lv_tarifas_simulacao t where t.plataforma = 'ifood');

-- ---------------------------------------------------------------------
-- 6. Mercado de demonstração: cafés equivalentes de verdade
-- ---------------------------------------------------------------------
-- Tradicional · Blend · torra média · moagem média · 500 g, em quatro lojas
-- de demonstração, mais o da Serra Clara que já existe (R$ 24,90). Mediana
-- dos cinco: R$ 26,80. E um Extra Forte do mesmo formato, que aparece como
-- SEMELHANTE e não entra na mediana. Tudo is_demo.
insert into public.lv_products (store_id, seller_id, category_id, slug, titulo, marca, descricao, preco_cents, peso_g, status, is_demo, ordem)
select s.id, s.seller_id, c.id, v.slug, v.titulo, v.marca, v.descricao, v.preco, 500, 'ativo', true, v.ordem
  from (values
    ('torra-viva', 'torra-viva-tradicional-moido-500g', 'Café Tradicional Torrado e Moído 500g', 'Torra Viva', 'Blend equilibrado de torra média, para o café de todo dia.', 2590, 40),
    ('grao-norte-cafes', 'grao-norte-tradicional-moido-500g', 'Café Tradicional do Norte Torrado e Moído 500g', 'Grão Norte', 'Tradicional de torra média, moagem para coador.', 2680, 41),
    ('torrefacao-ponte-velha', 'ponte-velha-tradicional-moido-500g', 'Café Ponte Velha Tradicional Moído 500g', 'Ponte Velha', 'Tradicional torrado em pequenos lotes.', 2790, 42),
    ('fazenda-alto-horizonte', 'alto-horizonte-tradicional-moido-500g', 'Café da Fazenda Tradicional Moído 500g', 'Alto Horizonte', 'O tradicional da fazenda, torra média.', 2890, 43),
    ('torra-viva', 'torra-viva-extra-forte-moido-500g', 'Café Extra Forte Torrado e Moído 500g', 'Torra Viva', 'Extra forte de torra escura.', 2390, 44)
  ) as v(loja, slug, titulo, marca, descricao, preco, ordem)
  join public.lv_stores s on s.slug = v.loja
  join public.lv_categories c on c.slug = 'cafe-torrado-moido'
 where not exists (select 1 from public.lv_products p where p.slug = v.slug);

insert into public.lv_product_attributes (product_id, attribute_id, valor)
select p.id, a.id, x.valor
  from public.lv_products p
  cross join lateral (values
    ('classificacao', case when p.slug like '%extra-forte%' then 'Extra Forte' else 'Tradicional' end),
    ('especie', 'Blend'),
    ('torra', case when p.slug like '%extra-forte%' then 'Escura' else 'Média' end),
    ('moagem', 'Média'),
    ('peso', '500')
  ) as x(chave, valor)
  join public.lv_attributes a on a.chave = x.chave
 where p.slug in ('torra-viva-tradicional-moido-500g', 'grao-norte-tradicional-moido-500g', 'ponte-velha-tradicional-moido-500g',
                  'alto-horizonte-tradicional-moido-500g', 'torra-viva-extra-forte-moido-500g')
on conflict (product_id, attribute_id) do nothing;

insert into public.lv_inventory_lots (product_id, lote, validade, entrada_em, qtd_disponivel, is_demo)
select p.id, 'L2609-' || upper(substr(md5(p.slug), 1, 3)), date '2027-03-01', date '2026-09-01', 40, true
  from public.lv_products p
 where p.slug in ('torra-viva-tradicional-moido-500g', 'grao-norte-tradicional-moido-500g', 'ponte-velha-tradicional-moido-500g',
                  'alto-horizonte-tradicional-moido-500g', 'torra-viva-extra-forte-moido-500g')
   and not exists (select 1 from public.lv_inventory_lots l where l.product_id = p.id);

-- ---------------------------------------------------------------------
-- 7. B2B de demonstração (fictício)
-- ---------------------------------------------------------------------
insert into public.lv_b2b_empresas (nome, cidade, uf, tipo_negocio, responsavel, is_demo)
select v.nome, v.cidade, v.uf, v.tipo, v.resp, true
  from (values
    ('Cafeteria Grão de Bairro (demonstração)', 'Campinas', 'SP', 'cafeteria', 'Responsável fictício'),
    ('Hotel Serra Azul (demonstração)', 'Belo Horizonte', 'MG', 'hotel', 'Responsável fictício'),
    ('Escritório Ponto Norte (demonstração)', 'São Paulo', 'SP', 'escritorio', 'Responsável fictício')
  ) as v(nome, cidade, uf, tipo, resp)
 where not exists (select 1 from public.lv_b2b_empresas e where e.nome = v.nome);

insert into public.lv_b2b_solicitacoes (empresa_id, classificacao, gramatura_g, moagem, consumo_mensal_kg, quantidade_kg, frequencia, status, observacao, is_demo)
select e.id, v.classe, v.g, v.moagem, v.mes, v.qtd, v.freq, v.status, v.obs, true
  from (values
    ('Cafeteria Grão de Bairro (demonstração)', 'Especial', 1000, 'Em grãos', 30, 30, 'mensal', 'em_analise', 'Grão para espresso, entrega no início do mês.'),
    ('Hotel Serra Azul (demonstração)', 'Tradicional', 500, 'Média', 100, 25, 'semanal', 'novo', 'Café do café da manhã, 100 kg por mês.'),
    ('Escritório Ponto Norte (demonstração)', 'Tradicional', 500, 'Média', 20, 20, 'unica', 'atendido', 'Compra única para o evento de fim de ano.')
  ) as v(nome, classe, g, moagem, mes, qtd, freq, status, obs)
  join public.lv_b2b_empresas e on e.nome = v.nome
 where not exists (select 1 from public.lv_b2b_solicitacoes s where s.empresa_id = e.id);
