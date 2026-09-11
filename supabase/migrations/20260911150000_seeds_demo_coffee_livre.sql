-- =====================================================================
-- Coffee LiVRE — dados de demonstração (11/09/2026) — Unidade 2
--
-- Cinco vendedores fictícios que representam perfis DIFERENTES do setor,
-- porque um marketplace com cinco torrefações parecidas não demonstra
-- marketplace nenhum: demonstra loja com cinco prateleiras.
--
-- TODOS marcados com is_demo = true, na origem. Nunca apresente estes
-- vendedores a investidor como parceiro real.
--
-- O QUE SAIU, por decisão registrada na auditoria:
--   • "Loja Saporino" como protagonista — a Saporino pode ser vendedora
--     um dia, mas não é a cara da plataforma.
--   • "Café Fazendinha" — marca do grupo, mesmo motivo.
--   • "Nespresso" em nome de produto — marca de terceiro, risco legal
--     mesmo em maquete. As cápsulas ficam, a marca alheia não.
--
-- Idempotente: roda de novo sem duplicar, porque tudo casa por slug ou
-- por chave.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CATEGORIAS
-- ---------------------------------------------------------------------
-- Dois ramos de propósito. O de baixo prova a tese: o Coffee LiVRE é do
-- ECOSSISTEMA do café, e moedor não tem variedade nem pontuação.
insert into public.lv_categories (slug, nome, icone, ordem) values
  ('cafes',        'Cafés',                   'grao',    1),
  ('equipamentos', 'Equipamentos e acessórios','maquina', 2)
on conflict (slug) do nothing;

insert into public.lv_categories (parent_id, slug, nome, icone, ordem)
select c.id, v.slug, v.nome, v.icone, v.ordem
  from (values
    ('cafe-em-graos',      'Café em grãos',        'grao',   1),
    ('cafe-torrado-moido', 'Café torrado e moído', 'moido',  2),
    ('cafes-especiais',    'Cafés especiais',      'esp',    3),
    ('capsulas',           'Cápsulas',             'caps',   4),
    ('drip-coffee',        'Drip coffee',          'drip',   5)
  ) as v(slug, nome, icone, ordem)
 cross join public.lv_categories c
 where c.slug = 'cafes'
on conflict (slug) do nothing;

insert into public.lv_categories (parent_id, slug, nome, icone, ordem)
select c.id, v.slug, v.nome, v.icone, v.ordem
  from (values
    ('cafeteiras',       'Cafeteiras',        'maquina', 1),
    ('moedores',         'Moedores',          'maquina', 2),
    ('filtros-coadores', 'Filtros e coadores','metodo',  3),
    ('acessorios',       'Acessórios',        'metodo',  4)
  ) as v(slug, nome, icone, ordem)
 cross join public.lv_categories c
 where c.slug = 'equipamentos'
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- ATRIBUTOS
-- ---------------------------------------------------------------------
-- `no_passport` marca o que entra no Coffee Passport QUANDO houver valor.
insert into public.lv_attributes (chave, rotulo, tipo, unidade, opcoes, no_passport, filtravel, ordem) values
  ('origem',      'Origem',            'texto',      null, '[]', true,  true,  1),
  ('regiao',      'Região',            'texto',      null, '[]', true,  true,  2),
  ('fazenda',     'Fazenda',           'texto',      null, '[]', true,  false, 3),
  ('produtor',    'Produtor',          'texto',      null, '[]', true,  false, 4),
  ('especie',     'Espécie',           'opcao',      null, '["Arábica","Conilon","Robusta","Blend"]', true, true, 5),
  ('variedade',   'Variedade',         'texto',      null, '[]', true,  false, 6),
  ('processo',    'Processo',          'opcao',      null, '["Natural","Cereja descascado","Lavado","Fermentado","Honey"]', true, true, 7),
  ('safra',       'Safra',             'texto',      null, '[]', true,  false, 8),
  ('lote',        'Lote',              'texto',      null, '[]', true,  false, 9),
  ('torra',       'Torra',             'opcao',      null, '["Clara","Média","Média-escura","Escura"]', true, true, 10),
  ('moagem',      'Moagem',            'opcao',      null, '["Em grãos","Fina","Média","Grossa"]', true, true, 11),
  ('pontuacao',   'Pontuação SCA',     'numero',     'pts','[]', true,  true,  12),
  ('notas',       'Notas sensoriais',  'texto',      null, '[]', true,  false, 13),
  ('certificacoes','Certificações',    'multiopcao', null, '["Orgânico","Rainforest","Fair Trade","UTZ","Denominação de origem"]', true, true, 14),
  ('data_torra',  'Data de torra',     'data',       null, '[]', true,  false, 15),
  ('peso',        'Peso',              'numero',     'g',  '[]', true,  true,  16),
  -- Equipamentos: nada de café aqui, e é esse o ponto.
  ('material',    'Material',          'texto',      null, '[]', false, true,  20),
  ('capacidade',  'Capacidade',        'texto',      null, '[]', false, true,  21),
  ('voltagem',    'Voltagem',          'opcao',      null, '["110V","220V","Bivolt"]', false, true, 22),
  ('garantia',    'Garantia',          'numero',     'meses','[]', false, false, 23)
on conflict (chave) do nothing;

-- Quais atributos valem em quais categorias.
insert into public.lv_category_attributes (category_id, attribute_id, ordem)
select c.id, a.id, a.ordem
  from public.lv_categories c
  join public.lv_attributes a on a.chave in (
    'origem','regiao','fazenda','produtor','especie','variedade','processo',
    'safra','lote','torra','moagem','pontuacao','notas','certificacoes','data_torra','peso')
 where c.slug in ('cafe-em-graos','cafe-torrado-moido','cafes-especiais','capsulas','drip-coffee')
on conflict do nothing;

insert into public.lv_category_attributes (category_id, attribute_id, ordem)
select c.id, a.id, a.ordem
  from public.lv_categories c
  join public.lv_attributes a on a.chave in ('material','capacidade','voltagem','garantia')
 where c.slug in ('cafeteiras','moedores','filtros-coadores','acessorios')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- VENDEDORES E LOJAS
-- ---------------------------------------------------------------------
-- Cinco perfis diferentes: fazenda, torrefação pequena, marca regional,
-- torrefação de especiais e equipamentos.
insert into public.lv_sellers (nome_fantasia, razao_social, tipo, cidade, uf, status, is_demo)
select v.nome, v.razao, v.tipo, v.cidade, v.uf, 'aprovado', true
  from (values
    ('Fazenda Alto Horizonte', 'Alto Horizonte Agropecuária Ltda',  'fazenda',      'Carmo de Minas',  'MG'),
    ('Torrefação Serra Clara', 'Serra Clara Torrefação Ltda',       'torrefacao',   'Três Pontas',     'MG'),
    ('Grão Norte Cafés',       'Grão Norte Comércio de Cafés Ltda', 'marca',        'Ji-Paraná',       'RO'),
    ('Torra Viva',             'Torra Viva Cafés Especiais Ltda',   'torrefacao',   'São Paulo',       'SP'),
    ('Oficina do Café',        'Oficina do Café Equipamentos Ltda', 'distribuidor', 'Curitiba',        'PR')
  ) as v(nome, razao, tipo, cidade, uf)
 where not exists (select 1 from public.lv_sellers s where s.nome_fantasia = v.nome);

insert into public.lv_stores (seller_id, slug, nome, chamada, historia, especialidade, cidade, uf, cor, iniciais, destaque, ordem, is_demo)
select s.id, v.slug, v.nome, v.chamada, v.historia, v.especialidade, s.cidade, s.uf, v.cor, v.iniciais, v.destaque, v.ordem, true
  from (values
    ('fazenda-alto-horizonte', 'Fazenda Alto Horizonte',
     'Do pé ao pacote, na Mantiqueira de Minas',
     'Três gerações cultivando café a 1.200 metros de altitude na Mantiqueira de Minas. Desde 2019 a família passou a torrar e vender direto, sem intermediário, os microlotes que antes iam inteiros para exportação.',
     'Microlotes e cafés de altitude', '#2F4B3A', 'AH', true, 1),
    ('torrefacao-serra-clara', 'Torrefação Serra Clara',
     'Torra fresca toda semana, no Sul de Minas',
     'Torrefação familiar em Três Pontas que trabalha com produtores vizinhos e torra em pequenos volumes. Cada saca é rastreada até o sítio de origem.',
     'Especiais do Sul de Minas', '#6E4A2A', 'SC', true, 2),
    ('grao-norte-cafes', 'Grão Norte Cafés',
     'Robustas amazônicos, o café que o Brasil esqueceu',
     'Marca regional de Rondônia dedicada aos robustas amazônicos, uma espécie que ganhou qualidade nos últimos anos e ainda é pouco conhecida fora do Norte.',
     'Robustas amazônicos e cápsulas', '#264D4A', 'GN', false, 3),
    ('torra-viva', 'Torra Viva',
     'Café especial sem complicação',
     'Torrefação de São Paulo focada em tornar café especial acessível no dia a dia, com métodos práticos e perfis de torra pensados para quem tem pressa de manhã.',
     'Especiais para o dia a dia', '#A2472A', 'TV', false, 4),
    ('oficina-do-cafe', 'Oficina do Café',
     'O equipamento certo para o seu método',
     'Distribuidora de Curitiba especializada em equipamentos e acessórios de preparo, de coadores a moedores, com assistência técnica própria.',
     'Equipamentos e acessórios', '#35506B', 'OC', false, 5)
  ) as v(slug, nome, chamada, historia, especialidade, cor, iniciais, destaque, ordem)
  join public.lv_sellers s on s.nome_fantasia = v.nome
 where not exists (select 1 from public.lv_stores st where st.slug = v.slug);

-- ---------------------------------------------------------------------
-- PRODUTOS
-- ---------------------------------------------------------------------
-- Onze itens em perfis diferentes de preenchimento. De propósito: dois
-- deles são equipamento e NÃO têm um único atributo de café, e um é café
-- comercial com pouquíssimo dado. É o que prova que o Passport mostra o
-- que existe em vez de inventar o que falta.
insert into public.lv_products (store_id, seller_id, category_id, slug, titulo, marca, descricao, preco, preco_de, peso_g, status, destaque, ordem, is_demo)
select st.id, st.seller_id, cat.id, v.slug, v.titulo, v.marca, v.descricao, v.preco, v.preco_de, v.peso, 'publicado', v.destaque, v.ordem, true
  from (values
    ('alto-horizonte-bourbon-amarelo-250g', 'fazenda-alto-horizonte', 'cafes-especiais',
     'Microlote Bourbon Amarelo 250g — Mantiqueira de Minas', 'Alto Horizonte',
     'Microlote de Bourbon Amarelo colhido a 1.200 metros e processado por fermentação natural. Produzido e torrado na própria fazenda.',
     79.90, null, 250, true, 1),
    ('alto-horizonte-catuai-vermelho-250g', 'fazenda-alto-horizonte', 'cafes-especiais',
     'Catuaí Vermelho Cereja Descascado 250g', 'Alto Horizonte',
     'Lote de Catuaí Vermelho com processamento cereja descascado, corpo médio e doçura de caramelo.',
     62.90, 74.90, 250, false, 2),
    ('serra-clara-especial-graos-250g', 'torrefacao-serra-clara', 'cafe-em-graos',
     'Café Especial em Grãos 250g — Sul de Minas', 'Serra Clara',
     'Grãos selecionados de produtores vizinhos, torra média para métodos filtrados.',
     52.90, 69.90, 250, true, 3),
    ('serra-clara-gourmet-graos-1kg', 'torrefacao-serra-clara', 'cafe-em-graos',
     'Café Gourmet em Grãos 1kg — Cerrado Mineiro', 'Serra Clara',
     'Volume para cafeteria e escritório, com a mesma torra do pacote de 250 g.',
     98.90, 129.90, 1000, false, 4),
    ('serra-clara-tradicional-moido-500g', 'torrefacao-serra-clara', 'cafe-torrado-moido',
     'Café Tradicional Torrado e Moído 500g', 'Serra Clara',
     'Torra média, moagem para coador de papel. O café de todo dia.',
     24.90, 32.90, 500, false, 5),
    ('grao-norte-robusta-amazonico-250g', 'grao-norte-cafes', 'cafe-em-graos',
     'Robusta Amazônico em Grãos 250g — Rondônia', 'Grão Norte',
     'Robusta de qualidade das matas de Rondônia, corpo alto e doçura de castanha.',
     46.90, 54.90, 250, true, 6),
    ('grao-norte-capsulas-intensidade-9', 'grao-norte-cafes', 'capsulas',
     'Cápsulas Intensidade 9 — caixa com 10', 'Grão Norte',
     'Cápsulas compatíveis com as máquinas domésticas mais comuns. Blend de arábica e robusta amazônico.',
     19.90, 24.90, 55, false, 7),
    ('torra-viva-drip-frutado-10-saches', 'torra-viva', 'drip-coffee',
     'Drip Coffee Frutado — caixa com 10 sachês', 'Torra Viva',
     'Café especial em sachê individual: abre, pendura na xícara e coa. Feito para viagem e escritório.',
     36.90, 45.00, 100, true, 8),
    ('torra-viva-descafeinado-moido-250g', 'torra-viva', 'cafe-torrado-moido',
     'Café Descafeinado Torrado e Moído 250g', 'Torra Viva',
     'Descafeinado por processo a água, sem perder corpo. Moagem média.',
     29.90, 34.90, 250, false, 9),
    ('oficina-coador-vidro-tamanho-2', 'oficina-do-cafe', 'filtros-coadores',
     'Coador de vidro com suporte de madeira — tamanho 2', 'Oficina do Café',
     'Coador em vidro borossilicato com base de madeira maciça. Para filtro de papel tamanho 2.',
     119.00, 149.00, 620, false, 10),
    ('oficina-moedor-manual-aco', 'oficina-do-cafe', 'moedores',
     'Moedor manual com mós cônicas de aço', 'Oficina do Café',
     'Mós cônicas de aço inoxidável e regulagem em 30 pontos, do espresso ao coado.',
     289.00, null, 480, false, 11)
  ) as v(slug, loja, categoria, titulo, marca, descricao, preco, preco_de, peso, destaque, ordem)
  join public.lv_stores st on st.slug = v.loja
  join public.lv_categories cat on cat.slug = v.categoria
 where not exists (select 1 from public.lv_products p where p.slug = v.slug);

-- ---------------------------------------------------------------------
-- ATRIBUTOS DOS PRODUTOS
-- ---------------------------------------------------------------------
-- Preenchimento DESIGUAL de propósito. O microlote tem passaporte
-- completo; o tradicional tem três campos; o equipamento não tem nenhum
-- campo de café. É assim que a tela prova que não inventa.
insert into public.lv_product_attributes (product_id, attribute_id, valor)
select p.id, a.id, v.valor
  from (values
    -- Microlote: passaporte completo
    ('alto-horizonte-bourbon-amarelo-250g', 'origem',       'Brasil'),
    ('alto-horizonte-bourbon-amarelo-250g', 'regiao',       'Mantiqueira de Minas'),
    ('alto-horizonte-bourbon-amarelo-250g', 'fazenda',      'Fazenda Alto Horizonte'),
    ('alto-horizonte-bourbon-amarelo-250g', 'produtor',     'Família Meireles'),
    ('alto-horizonte-bourbon-amarelo-250g', 'especie',      'Arábica'),
    ('alto-horizonte-bourbon-amarelo-250g', 'variedade',    'Bourbon Amarelo'),
    ('alto-horizonte-bourbon-amarelo-250g', 'processo',     'Fermentado'),
    ('alto-horizonte-bourbon-amarelo-250g', 'safra',        '2026'),
    ('alto-horizonte-bourbon-amarelo-250g', 'lote',         'AH-026'),
    ('alto-horizonte-bourbon-amarelo-250g', 'torra',        'Média'),
    ('alto-horizonte-bourbon-amarelo-250g', 'moagem',       'Em grãos'),
    ('alto-horizonte-bourbon-amarelo-250g', 'pontuacao',    '88'),
    ('alto-horizonte-bourbon-amarelo-250g', 'notas',        'Damasco, mel e chocolate ao leite'),
    ('alto-horizonte-bourbon-amarelo-250g', 'peso',         '250'),
    -- Origem identificada, sem pontuação
    ('alto-horizonte-catuai-vermelho-250g', 'origem',       'Brasil'),
    ('alto-horizonte-catuai-vermelho-250g', 'regiao',       'Mantiqueira de Minas'),
    ('alto-horizonte-catuai-vermelho-250g', 'fazenda',      'Fazenda Alto Horizonte'),
    ('alto-horizonte-catuai-vermelho-250g', 'especie',      'Arábica'),
    ('alto-horizonte-catuai-vermelho-250g', 'variedade',    'Catuaí Vermelho'),
    ('alto-horizonte-catuai-vermelho-250g', 'processo',     'Cereja descascado'),
    ('alto-horizonte-catuai-vermelho-250g', 'torra',        'Média'),
    ('alto-horizonte-catuai-vermelho-250g', 'moagem',       'Em grãos'),
    ('alto-horizonte-catuai-vermelho-250g', 'notas',        'Caramelo e nozes'),
    ('alto-horizonte-catuai-vermelho-250g', 'peso',         '250'),
    -- Especial de torrefação
    ('serra-clara-especial-graos-250g', 'origem',    'Brasil'),
    ('serra-clara-especial-graos-250g', 'regiao',    'Sul de Minas'),
    ('serra-clara-especial-graos-250g', 'especie',   'Arábica'),
    ('serra-clara-especial-graos-250g', 'variedade', 'Catuaí Amarelo'),
    ('serra-clara-especial-graos-250g', 'processo',  'Natural'),
    ('serra-clara-especial-graos-250g', 'torra',     'Média'),
    ('serra-clara-especial-graos-250g', 'moagem',    'Em grãos'),
    ('serra-clara-especial-graos-250g', 'pontuacao', '86'),
    ('serra-clara-especial-graos-250g', 'notas',     'Chocolate, castanha e doçura de rapadura'),
    ('serra-clara-especial-graos-250g', 'peso',      '250'),
    ('serra-clara-gourmet-graos-1kg', 'origem',  'Brasil'),
    ('serra-clara-gourmet-graos-1kg', 'regiao',  'Cerrado Mineiro'),
    ('serra-clara-gourmet-graos-1kg', 'especie', 'Arábica'),
    ('serra-clara-gourmet-graos-1kg', 'torra',   'Média'),
    ('serra-clara-gourmet-graos-1kg', 'moagem',  'Em grãos'),
    ('serra-clara-gourmet-graos-1kg', 'pontuacao','83'),
    ('serra-clara-gourmet-graos-1kg', 'peso',    '1000'),
    -- Comercial: pouquíssimo dado, e está certo assim
    ('serra-clara-tradicional-moido-500g', 'especie', 'Blend'),
    ('serra-clara-tradicional-moido-500g', 'torra',   'Média'),
    ('serra-clara-tradicional-moido-500g', 'moagem',  'Média'),
    ('serra-clara-tradicional-moido-500g', 'peso',    '500'),
    -- Robusta amazônico
    ('grao-norte-robusta-amazonico-250g', 'origem',    'Brasil'),
    ('grao-norte-robusta-amazonico-250g', 'regiao',    'Matas de Rondônia'),
    ('grao-norte-robusta-amazonico-250g', 'especie',   'Robusta'),
    ('grao-norte-robusta-amazonico-250g', 'processo',  'Natural'),
    ('grao-norte-robusta-amazonico-250g', 'torra',     'Média-escura'),
    ('grao-norte-robusta-amazonico-250g', 'moagem',    'Em grãos'),
    ('grao-norte-robusta-amazonico-250g', 'pontuacao', '85'),
    ('grao-norte-robusta-amazonico-250g', 'notas',     'Castanha, cacau e corpo alto'),
    ('grao-norte-robusta-amazonico-250g', 'peso',      '250'),
    ('grao-norte-capsulas-intensidade-9', 'especie', 'Blend'),
    ('grao-norte-capsulas-intensidade-9', 'torra',   'Escura'),
    ('grao-norte-capsulas-intensidade-9', 'peso',    '55'),
    -- Drip
    ('torra-viva-drip-frutado-10-saches', 'origem',    'Brasil'),
    ('torra-viva-drip-frutado-10-saches', 'regiao',    'Alta Mogiana'),
    ('torra-viva-drip-frutado-10-saches', 'especie',   'Arábica'),
    ('torra-viva-drip-frutado-10-saches', 'processo',  'Natural'),
    ('torra-viva-drip-frutado-10-saches', 'torra',     'Clara'),
    ('torra-viva-drip-frutado-10-saches', 'moagem',    'Média'),
    ('torra-viva-drip-frutado-10-saches', 'pontuacao', '84'),
    ('torra-viva-drip-frutado-10-saches', 'notas',     'Frutas amarelas e acidez cítrica'),
    ('torra-viva-drip-frutado-10-saches', 'peso',      '100'),
    ('torra-viva-descafeinado-moido-250g', 'especie', 'Arábica'),
    ('torra-viva-descafeinado-moido-250g', 'torra',   'Média'),
    ('torra-viva-descafeinado-moido-250g', 'moagem',  'Média'),
    ('torra-viva-descafeinado-moido-250g', 'peso',    '250'),
    -- Equipamento: NENHUM atributo de café
    ('oficina-coador-vidro-tamanho-2', 'material',   'Vidro borossilicato e madeira'),
    ('oficina-coador-vidro-tamanho-2', 'capacidade', 'Até 500 ml'),
    ('oficina-coador-vidro-tamanho-2', 'garantia',   '12'),
    ('oficina-moedor-manual-aco', 'material',   'Aço inoxidável e alumínio'),
    ('oficina-moedor-manual-aco', 'capacidade', '30 g por moagem'),
    ('oficina-moedor-manual-aco', 'garantia',   '24')
  ) as v(produto, chave, valor)
  join public.lv_products p   on p.slug = v.produto
  join public.lv_attributes a on a.chave = v.chave
on conflict (product_id, attribute_id) do nothing;

-- ---------------------------------------------------------------------
-- Certificação em um só, para a tela ter o caso do campo multiopção
-- ---------------------------------------------------------------------
insert into public.lv_product_attributes (product_id, attribute_id, valor)
select p.id, a.id, 'Orgânico'
  from public.lv_products p, public.lv_attributes a
 where p.slug = 'serra-clara-especial-graos-250g' and a.chave = 'certificacoes'
on conflict (product_id, attribute_id) do nothing;
