-- =====================================================================
-- Coffee LiVRE — Calculadora de Economia LiVRE (13/09/2026) — Unidade 6.5
--
-- O vendedor coloca os próprios números e vê quanto sobra em cada
-- plataforma. Esta migration guarda as REGRAS da conta; a conta em si é
-- uma função pura no front (calculadora/economia.ts).
--
-- POR QUE TABELA: tarifa muda. Se a comissão da Shopee ou a tabela de
-- envio do Mercado Livre estivessem escritas num componente React, cada
-- reajuste seria um deploy e, pior, um número velho na frente do vendedor.
-- Aqui cada regra carrega de onde veio, quando foi conferida e quão
-- confiável é — e o admin edita sem programador.
--
-- DUAS NATUREZAS, NUNCA MISTURADAS:
--   benchmark        regra pública de outra plataforma, com fonte e data;
--   hipotese_livre   valor do Coffee LiVRE ainda EM ESTUDO (não é tarifa
--                    contratual — a tela diz isso).
--
-- REGRA DE OURO: o que não é público fica NULO, nunca zero. Um custo
-- desconhecido que vira R$ 0,00 fabricaria uma economia que não existe.
--
-- Fontes: benchmarks de 11 e 12/09/2026 (MERCADOLIVRE_TAXAS,
-- MERCADOLIVRE_COMPLEMENTO, SIMULACAO_ML_CAFE_500G, ESTRUTURA_SHOPEE,
-- AMAZON_BRASIL_RAIO_X, AMAZON_COMPLEMENTO, MAGALU_RAIO_X_COMPLETO) e a
-- seção 7 do RAIO-X Operacional. Nenhuma pesquisa nova.
-- =====================================================================

create table if not exists public.lv_tarifas_simulacao (
  id               uuid primary key default gen_random_uuid(),
  plataforma       text not null,
  -- Nulo = vale para todas as modalidades da plataforma (ex.: tabela de
  -- envio do ML serve ao Clássico e ao Premium).
  modalidade       text,
  componente       text not null,
  -- Alternativa escolhida pela pessoa (ex.: pagamento em cartão ou Pix).
  cenario          text,
  -- Valores. Percentual em pontos-base (1400 = 14%); dinheiro em centavos;
  -- micros para tarifa menor que um centavo (R$ 1 = 1.000.000 micros).
  percentual_bps   integer,
  valor_cents      bigint,
  valor_micros     bigint,
  minimo_cents     bigint,
  -- Faixa de preço sobre o VALOR DO PEDIDO, inclusiva nas duas pontas.
  preco_min_cents  bigint,
  preco_max_cents  bigint,
  -- Faixa de peso: 'envio' = peso do pedido embalado; 'unidade' =
  -- gramatura do pacote. Mínimo exclusivo, máximo inclusivo, como as
  -- tabelas ("de 0,5 a 1 kg").
  peso_sobre       text,
  peso_min_g       integer,
  peso_max_g       integer,
  confiabilidade   text not null,
  natureza         text not null,
  rotulo           text,
  fonte            text,
  fonte_url        text,
  verificado_em    date,
  vigencia_inicio  date,
  vigencia_fim     date,
  observacao       text,
  ordem            integer not null default 0,
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id) on delete set null,
  constraint lv_tarifas_plataforma check (plataforma in ('coffeelivre','mercado_livre','shopee','amazon','magalu')),
  constraint lv_tarifas_componente check (componente in (
    'comissao','tarifa_fixa_pedido','tarifa_unidade','logistica_pedido','armazenagem_unidade',
    'pagamento','mensalidade','frete','frete_gratis_limiar')),
  constraint lv_tarifas_confiabilidade check (confiabilidade in (
    'verificado','fonte_secundaria','calculado','premissa','conflitante','nao_publico',
    'em_estudo','desatualizado','nao_se_aplica')),
  constraint lv_tarifas_natureza check (natureza in ('benchmark','hipotese_livre')),
  constraint lv_tarifas_peso_sobre check (peso_sobre is null or peso_sobre in ('envio','unidade')),
  constraint lv_tarifas_valores_positivos check (
    coalesce(percentual_bps, 0) >= 0 and coalesce(valor_cents, 0) >= 0
    and coalesce(valor_micros, 0) >= 0 and coalesce(minimo_cents, 0) >= 0)
);

comment on table public.lv_tarifas_simulacao is
  'Regras da Calculadora de Economia LiVRE. benchmark = regra publica de outra plataforma, com fonte e data; hipotese_livre = valor do Coffee LiVRE EM ESTUDO. Desconhecido fica NULO, nunca zero.';

create index if not exists lv_tarifas_simulacao_busca
  on public.lv_tarifas_simulacao (plataforma, componente) where ativo;

alter table public.lv_tarifas_simulacao enable row level security;

-- Pública: é a conta que o vendedor vê. "Você não precisa acreditar no
-- Coffee LiVRE. Veja a conta." só funciona se a conta for legível.
drop policy if exists lv_tarifas_simulacao_publicas on public.lv_tarifas_simulacao;
create policy lv_tarifas_simulacao_publicas on public.lv_tarifas_simulacao
  for select to anon, authenticated using (ativo);

drop policy if exists lv_tarifas_simulacao_admin on public.lv_tarifas_simulacao;
create policy lv_tarifas_simulacao_admin on public.lv_tarifas_simulacao
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Premissas da simulação: números que não são tarifa de ninguém, mas
-- mudam a conta. Ficam visíveis e editáveis pelo mesmo motivo.
create table if not exists public.lv_simulacao_premissas (
  chave       text primary key,
  valor       integer not null,
  rotulo      text not null,
  unidade     text,
  fonte       text,
  observacao  text,
  updated_at  timestamptz not null default now()
);

alter table public.lv_simulacao_premissas enable row level security;

drop policy if exists lv_simulacao_premissas_publicas on public.lv_simulacao_premissas;
create policy lv_simulacao_premissas_publicas on public.lv_simulacao_premissas
  for select to anon, authenticated using (true);

drop policy if exists lv_simulacao_premissas_admin on public.lv_simulacao_premissas;
create policy lv_simulacao_premissas_admin on public.lv_simulacao_premissas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.lv_simulacao_premissas (chave, valor, rotulo, unidade, fonte, observacao) values
  ('peso_embalagem_g', 14, 'Peso da embalagem por pacote', 'g',
   'Pacote de 500 g cadastrado na Amazon com 514 g (ASIN B08S1NXKS1), estudo AMAZON_BRASIL_RAIO_X de 12/09/2026',
   'Soma-se à gramatura para achar a faixa de peso do envio. Reproduz as faixas usadas nos estudos de ML e Amazon (1 pacote 500 g = faixa de 0,5 a 1 kg).'),
  ('margem_proximo_piso_bps', 500, 'Margem de "próximo do piso"', 'pontos-base',
   'Decisão de produto da Unidade 6.5',
   'Acima do piso, mas a menos de 5% dele: qualquer reajuste de tarifa pode derrubar para baixo do piso.')
on conflict (chave) do nothing;

-- =====================================================================
-- SEMENTES — só quando a tabela está vazia, para nunca sobrescrever o
-- que o admin corrigiu depois.
-- =====================================================================
do $$
begin
if exists (select 1 from public.lv_tarifas_simulacao) then
  return;
end if;

-- ---------------------------------------------------------------------
-- MERCADO LIVRE
-- ---------------------------------------------------------------------
insert into public.lv_tarifas_simulacao
  (plataforma, modalidade, componente, percentual_bps, confiabilidade, natureza, rotulo, fonte, fonte_url, verificado_em, observacao, ordem)
values
  ('mercado_livre', 'classico', 'comissao', 1400, 'verificado', 'benchmark', 'Tarifa de venda (14%)',
   'Simulador de custos oficial do Mercado Livre, categoria Café Moído e em Grão, conta CASACOFICO',
   'https://www.mercadolivre.com.br/simulador-de-custos', '2026-09-12',
   'Já inclui o custo de cobrar pelo Mercado Pago: não há taxa de pagamento separada.', 1),
  ('mercado_livre', 'premium', 'comissao', 1900, 'verificado', 'benchmark', 'Tarifa de venda (19%)',
   'Simulador de custos oficial do Mercado Livre, categoria Café Moído e em Grão, conta CASACOFICO',
   'https://www.mercadolivre.com.br/simulador-de-custos', '2026-09-12',
   'Inclui o Mercado Pago e o parcelamento sem acréscimo oferecido ao comprador.', 1);

-- Custo de envio: por envio, pela faixa de peso do pedido embalado e pela
-- faixa de preço. Acima de R$ 99,99 e acima de 3 kg a tabela estudada não
-- cobre: a calculadora mostra "não disponível", não inventa.
insert into public.lv_tarifas_simulacao
  (plataforma, componente, valor_cents, preco_min_cents, preco_max_cents, peso_sobre, peso_min_g, peso_max_g,
   confiabilidade, natureza, rotulo, fonte, fonte_url, verificado_em, observacao, ordem)
select 'mercado_livre', 'logistica_pedido', f.valor, f.pmin, f.pmax, 'envio', v.gmin, v.gmax,
       'verificado', 'benchmark', 'Custo de envio',
       'Central de Ajuda do Mercado Livre — Custos dos Envios para MercadoLíder, reputação verde ou sem reputação',
       'https://www.mercadolivre.com.br/ajuda/40538', '2026-09-12',
       'Cobrado por envio, mesmo com frete grátis ao comprador. Já inclui o desconto de reputação verde. De R$ 19 a R$ 78,99 o frete do comprador é bancado pelo ML; a partir de R$ 79 o vendedor oferece frete grátis e a faixa sobe.',
       2
  from (values
    (0, 300, array[685, 815, 1295]),
    (300, 500, array[695, 825, 1385]),
    (500, 1000, array[715, 845, 1445]),
    (1000, 1500, array[735, 865, 1475]),
    (1500, 2000, array[745, 875, 1505]),
    (2000, 3000, array[865, 915, 1645])
  ) as v(gmin, gmax, valores)
  cross join lateral unnest(array[1900, 4900, 7900], array[4899, 7899, 9999], v.valores) as f(pmin, pmax, valor);

-- ---------------------------------------------------------------------
-- SHOPEE (vendedor CNPJ, desde 01/03/2026)
-- ---------------------------------------------------------------------
insert into public.lv_tarifas_simulacao
  (plataforma, modalidade, componente, percentual_bps, valor_cents, preco_min_cents, preco_max_cents,
   confiabilidade, natureza, rotulo, fonte, fonte_url, verificado_em, observacao, ordem)
select 'shopee', 'padrao', c.componente, c.bps, c.valor, f.pmin, f.pmax,
       'verificado', 'benchmark', c.rotulo,
       'Centro de Educação do Vendedor Shopee — comissão para vendedor CNPJ',
       'https://seller.shopee.com.br/edu/article/18483', '2026-09-12',
       'O valor já inclui a taxa de transação do pagamento. Pedido de N pacotes considerado como um item (kit), como nos estudos: a tarifa fixa sai uma vez e a faixa é o valor do pedido.',
       c.ordem
  from (values
    (800, 7999, 2000, 400),
    (8000, 9999, 1400, 1600),
    (10000, 19999, 1400, 2000),
    (20000, null, 1400, 2600)
  ) as f(pmin, pmax, bps_faixa, fixa_faixa)
  cross join lateral (values
    ('comissao', f.bps_faixa, null::bigint, 'Comissão', 1),
    ('tarifa_fixa_pedido', null::integer, f.fixa_faixa::bigint, 'Tarifa fixa por item', 2)
  ) as c(componente, bps, valor, rotulo, ordem);

insert into public.lv_tarifas_simulacao
  (plataforma, modalidade, componente, valor_cents, confiabilidade, natureza, rotulo, fonte, verificado_em, observacao, ordem)
values
  ('shopee', 'padrao', 'logistica_pedido', 0, 'premissa', 'benchmark', 'Envio',
   'ESTRUTURA_SHOPEE, 11/09/2026', '2026-09-12',
   'O estudo não registra custo de envio cobrado do vendedor: o frete é pago pelo comprador ou por cupom da Shopee. Embalagem e postagem continuam por conta do vendedor e não entram aqui.', 3);

-- ---------------------------------------------------------------------
-- AMAZON (plano Profissional, logística FBA)
-- ---------------------------------------------------------------------
insert into public.lv_tarifas_simulacao
  (plataforma, modalidade, componente, percentual_bps, minimo_cents, confiabilidade, natureza, rotulo, fonte, fonte_url, verificado_em, observacao, ordem)
values
  ('amazon', 'fba', 'comissao', 1000, 100, 'verificado', 'benchmark', 'Tarifa de indicação (10%, mín. R$ 1)',
   'Amazon — tabela oficial de preços para vender, categoria Alimentos e Bebidas',
   'https://venda.amazon.com.br/precos', '2026-09-12',
   'Calculada sobre o total pago pelo cliente. No FBA com frete grátis, o total é o preço.', 1);

insert into public.lv_tarifas_simulacao
  (plataforma, modalidade, componente, valor_cents, preco_min_cents, preco_max_cents, peso_sobre, peso_min_g, peso_max_g,
   confiabilidade, natureza, rotulo, fonte, fonte_url, verificado_em, vigencia_inicio, observacao, ordem)
select 'amazon', 'fba', 'logistica_pedido', f.valor, f.pmin, f.pmax, 'envio', v.gmin, v.gmax,
       case when v.gmin = 1000 then 'conflitante' else 'verificado' end,
       'benchmark', 'Tarifa de logística FBA',
       case when v.gmin = 1000
            then 'Amazon — PDF oficial de tarifas (faixa 1–2 kg), por conflito com a página oficial'
            else 'Amazon — página oficial do FBA' end,
       case when v.gmin = 1000
            then 'https://m.media-amazon.com/images/G/32/fee/PDFv4.pdf'
            else 'https://venda.amazon.com.br/cresca/fba' end,
       '2026-09-12', '2025-08-01',
       case when v.gmin = 1000
            then 'A página oficial publica R$ 5,65 / 5,85 / 6,05 / 12,95 / 14,95 nesta faixa, fora da curva. O PDF oficial, com a mesma vigência, traz R$ 14,00 / 16,35 / 18,75 / 21,10 / 22,90. Usamos o valor conservador do PDF, como o estudo de referência. Pendente de confirmação no Seller Central.'
            else 'Por pedido montado como kit, como no estudo. Se as unidades forem vendidas como itens separados, a tarifa FBA é cobrada por unidade. Página e PDF oficiais têm a mesma vigência e valores diferentes; pendente de confirmação no Seller Central.' end,
       2
  from (values
    (0, 100, array[1005, 1205, 1405, 1505, 1555]),
    (100, 200, array[1045, 1245, 1445, 1545, 1605]),
    (200, 300, array[1095, 1295, 1495, 1595, 1655]),
    (300, 400, array[1145, 1345, 1545, 1695, 1715]),
    (400, 500, array[1195, 1395, 1595, 1705, 1785]),
    (500, 750, array[1205, 1405, 1605, 1845, 1855]),
    (750, 1000, array[1245, 1445, 1645, 1905, 1925]),
    (1000, 1500, array[1400, 1635, 1875, 2110, 2290]),
    (1500, 2000, array[1305, 1505, 1705, 1995, 2135]),
    (2000, 3000, array[1405, 1605, 1805, 2005, 2235]),
    (3000, 4000, array[1505, 1705, 1905, 2195, 2335]),
    (4000, 5000, array[1605, 1805, 2005, 2295, 2435]),
    (5000, 6000, array[2405, 2705, 2905, 3005, 3035]),
    (6000, 7000, array[2505, 2805, 3005, 3105, 3335]),
    (7000, 8000, array[2605, 2905, 3105, 3205, 3535]),
    (8000, 9000, array[2705, 3005, 3205, 3305, 3735]),
    (9000, 10000, array[3505, 4005, 4605, 5105, 5135])
  ) as v(gmin, gmax, valores)
  cross join lateral unnest(array[0, 3000, 5000, 7900, 10000], array[2999, 4999, 7899, 9999, 11999], v.valores) as f(pmin, pmax, valor);

insert into public.lv_tarifas_simulacao
  (plataforma, modalidade, componente, valor_micros, valor_cents, peso_sobre, peso_min_g, peso_max_g,
   confiabilidade, natureza, rotulo, fonte, fonte_url, verificado_em, observacao, ordem)
values
  ('amazon', 'fba', 'armazenagem_unidade', 85680, null, 'unidade', 450, 550, 'calculado', 'benchmark',
   'Armazenagem (1 mês)', 'AMAZON_BRASIL_RAIO_X, seção 6.1 — cálculo sobre tarifa oficial', 'https://venda.amazon.com.br/cresca/fba', '2026-09-12',
   '1.142,4 cm³ do pacote de 500 g (ASIN B08S1NXKS1) × R$ 75,00/m³/mês, com 1 mês parado. Outras gramaturas: dimensões não estudadas.', 3),
  ('amazon', 'fba', 'mensalidade', null, 1900, null, null, null, 'verificado', 'benchmark',
   'Plano Profissional', 'Amazon — tabela oficial de preços para vender', 'https://venda.amazon.com.br/precos', '2026-09-12',
   'R$ 19,00/mês quando há ofertas ativas. A isenção de 12 meses para vendedor novo não entra na simulação.', 4);

-- ---------------------------------------------------------------------
-- MAGALU (marketplace 3P)
-- ---------------------------------------------------------------------
insert into public.lv_tarifas_simulacao
  (plataforma, modalidade, componente, percentual_bps, valor_cents, preco_min_cents, preco_max_cents,
   confiabilidade, natureza, rotulo, fonte, fonte_url, verificado_em, observacao, ordem)
values
  ('magalu', 'padrao', 'comissao', 1800, null, null, null, 'premissa', 'benchmark', 'Comissão (18%)',
   'Universo Magalu — comissão padrão oficial', 'https://universo.magalu.com/blog/artigo/vendaagora', '2026-09-12',
   'A comissão específica de café não é publicada. O estudo recomenda modelar pelo padrão oficial de 18%. Promoção de novo vendedor (9,9%) e programa de aceleração (13%/11%) não entram.', 1),
  ('magalu', 'padrao', 'tarifa_fixa_pedido', null, 500, null, null, 'fonte_secundaria', 'benchmark', 'Tarifa fixa por pedido',
   'Existência: Universo Magalu (oficial). Valor: E-Commerce Brasil, 27/01/2025 (secundária)', 'https://universo.magalu.com/', '2026-09-12',
   'A Magalu confirma que existe custo fixo por pedido, mas não publica o valor de 2026.', 2),
  ('magalu', 'padrao', 'logistica_pedido', null, 0, null, 9899, 'verificado', 'benchmark', 'Frete',
   'Observação ao vivo na Magalu, 12/09/2026 (MAGALU_RAIO_X_COMPLETO, seção 2.5)', 'https://especiais.magazineluiza.com.br/regulamentos/', '2026-09-12',
   'Abaixo de R$ 99 o comprador paga o frete (R$ 9,76 observado para 500 g). O vendedor não paga frete nessa faixa.', 3),
  ('magalu', 'padrao', 'logistica_pedido', null, null, 9900, null, 'nao_publico', 'benchmark', 'Coparticipação no frete grátis',
   'MAGALU_RAIO_X_COMPLETO, seção 2.5', 'https://magaluentregas.com.br/', '2026-09-12',
   'A partir de R$ 99 o frete é grátis ao comprador e o vendedor coparticipa. A tabela em reais só existe no Portal do Seller.', 3),
  ('magalu', 'padrao', 'frete_gratis_limiar', null, 9900, null, null, 'verificado', 'benchmark', 'Frete grátis ao comprador a partir de',
   'Regulamentos oficiais Magalu, confirmado ao vivo em 12/09/2026', 'https://especiais.magazineluiza.com.br/regulamentos/', '2026-09-12',
   'Informação para o comprador: não é custo do vendedor.', 9);

-- ---------------------------------------------------------------------
-- COFFEE LiVRE — HIPÓTESES EM ESTUDO
-- ---------------------------------------------------------------------
insert into public.lv_tarifas_simulacao
  (plataforma, modalidade, componente, percentual_bps, confiabilidade, natureza, rotulo, fonte, verificado_em, observacao, ordem)
values
  ('coffeelivre', 'zero', 'comissao', 1200, 'em_estudo', 'hipotese_livre', 'Comissão (12%)', 'Estrutura de trabalho dos planos, 13/09/2026', '2026-09-13', 'Hipótese comercial. Não é tarifa contratual.', 1),
  ('coffeelivre', 'livre', 'comissao', 1000, 'em_estudo', 'hipotese_livre', 'Comissão (10%)', 'Estrutura de trabalho dos planos, 13/09/2026', '2026-09-13', 'Hipótese comercial. Não é tarifa contratual.', 1),
  ('coffeelivre', 'plus', 'comissao', 800, 'em_estudo', 'hipotese_livre', 'Comissão (8%)', 'Estrutura de trabalho dos planos, 13/09/2026', '2026-09-13', 'Hipótese comercial. Não é tarifa contratual.', 1),
  ('coffeelivre', 'oficial', 'comissao', null, 'em_estudo', 'hipotese_livre', 'Comissão', 'Estrutura de trabalho dos planos, 13/09/2026', '2026-09-13', 'Ainda não definida.', 1);

-- Tarifa operacional por pacote, pela gramatura. Onde a direção de estudo
-- não deu número, a linha existe com valor NULO: a tela mostra "em estudo".
insert into public.lv_tarifas_simulacao
  (plataforma, modalidade, componente, valor_cents, peso_sobre, peso_min_g, peso_max_g,
   confiabilidade, natureza, rotulo, fonte, verificado_em, observacao, ordem)
select 'coffeelivre', t.plano, 'tarifa_unidade', t.valor, 'unidade', g.gmin, g.gmax,
       'em_estudo', 'hipotese_livre', 'Tarifa operacional por pacote',
       'Estrutura de trabalho dos planos, 13/09/2026', '2026-09-13',
       case when t.valor is null then 'Valor para esta gramatura ainda não definido.' else 'Hipótese comercial. Não é tarifa contratual.' end,
       2
  from (values (200, 250, '250 g'), (450, 500, '500 g'), (950, 1000, '1 kg')) as g(gmin, gmax, nome)
  cross join lateral (values
    ('zero',    case g.nome when '250 g' then 50 when '500 g' then 95 else 100 end),
    ('livre',   case g.nome when '500 g' then 85 end),
    ('plus',    case g.nome when '500 g' then 75 end),
    ('oficial', null::integer)
  ) as t(plano, valor);

insert into public.lv_tarifas_simulacao
  (plataforma, componente, cenario, percentual_bps, valor_cents, confiabilidade, natureza, rotulo, fonte, fonte_url, verificado_em, observacao, ordem)
values
  ('coffeelivre', 'pagamento', 'cartao', 498, null, 'fonte_secundaria', 'hipotese_livre', 'Pagamento: cartão à vista (Mercado Pago)',
   'RAIO-X Operacional, seção 7.1 (fonte secundária)', 'https://sellsync.ai/pt/blog/taxa-mercado-pago-2026-guia-completo/', '2026-09-11',
   'No split do Mercado Pago a taxa de processamento é descontada do vendedor. Nos concorrentes ela já está dentro da comissão.', 3),
  ('coffeelivre', 'pagamento', 'pix', 99, null, 'fonte_secundaria', 'hipotese_livre', 'Pagamento: Pix (Mercado Pago)',
   'RAIO-X Operacional, seção 7.1 (fonte secundária)', 'https://sellsync.ai/pt/blog/taxa-mercado-pago-2026-guia-completo/', '2026-09-11',
   'No split do Mercado Pago a taxa de processamento é descontada do vendedor. Nos concorrentes ela já está dentro da comissão.', 3),
  ('coffeelivre', 'frete', null, null, 0, 'nao_se_aplica', 'hipotese_livre', 'Frete',
   'Unidade 6.5', null, '2026-09-13',
   'Frete calculado separadamente e pago pelo comprador. O custo real do Coffee LiVRE ainda não está definido e não entra na conta.', 4);

end $$;
