-- Studio — uma ABA POR MARCA, cada uma com seus guardrails e sua conta (Instagram/TikTok).
--
-- Antes: tudo era por EMPRESA (UNIQUE company_id+platform = uma conta por empresa). As submarcas
-- da Saporino (Tropeiro Paulista, Café Serrão, Café do Amor) têm Instagram próprio, e o Coffee
-- LiVRE também — não cabiam. Agora a chave é o PERFIL DE MARCA (studio_brand_profiles):
--   conexão  = (brand_id, platform)
--   campanha = brand_id → publica na conta DAQUELA marca (a aba escolhida é o destino)
--   vídeo    = brand_id → a análise usa os guardrails daquela marca
-- A empresa continua sendo a dona (company_id), para faturamento, armazenamento e RLS.
--
-- Regra combinada com o Vlademir (21/09/2026): conteúdo de submarca pode sair na conta dela,
-- na @coficobrasil (distribuidora, aceita todas as marcas) e, POR ESCOLHA DELE, na @cafesaporino.

-- ---------------------------------------------------------------------
-- 1. Perfil de marca: ordem da aba e ativa no Studio
-- ---------------------------------------------------------------------
alter table public.studio_brand_profiles add column if not exists ordem integer not null default 100;
alter table public.studio_brand_profiles add column if not exists ativa_no_studio boolean not null default true;

-- ---------------------------------------------------------------------
-- 2. brand_id em conexões, campanhas e vídeos (+ preenche com a marca principal da empresa)
-- ---------------------------------------------------------------------
alter table public.studio_social_connections add column if not exists brand_id uuid references public.studio_brand_profiles(id) on delete cascade;
alter table public.studio_campaigns          add column if not exists brand_id uuid references public.studio_brand_profiles(id) on delete set null;
alter table public.studio_videos             add column if not exists brand_id uuid references public.studio_brand_profiles(id) on delete set null;

create or replace function public.studio_marca_principal(p_company uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.studio_brand_profiles where company_id = p_company
   order by is_primary desc, ordem, created_at limit 1;
$$;

update public.studio_social_connections set brand_id = public.studio_marca_principal(company_id) where brand_id is null;
update public.studio_campaigns          set brand_id = public.studio_marca_principal(company_id) where brand_id is null;
update public.studio_videos             set brand_id = public.studio_marca_principal(company_id) where brand_id is null;

alter table public.studio_social_connections drop constraint if exists studio_social_connections_company_id_platform_key;
create unique index if not exists studio_social_connections_marca_rede on public.studio_social_connections (brand_id, platform);
create index if not exists studio_campaigns_marca_idx on public.studio_campaigns (brand_id);
create index if not exists studio_videos_marca_idx on public.studio_videos (brand_id);

-- ---------------------------------------------------------------------
-- 3. Marcas novas (só onde as empresas existem: produção). Guardrails V1 para revisão.
-- ---------------------------------------------------------------------
do $$
declare
  sap_company uuid; sap_org uuid; sap_brand uuid;
  cof_company uuid; cof_org uuid; cof_brand uuid;
begin
  select id into sap_company from public.companies where fantasia ilike 'CAFE SAPORINO' or name ilike 'Café Saporino Ltda' limit 1;
  select id into cof_company from public.companies where name ilike 'V. Medeiros de Santi%' limit 1;
  if sap_company is null or cof_company is null then
    raise notice 'Empresas Saporino/COFICO ausentes (staging): marcas novas não criadas.';
    return;
  end if;
  select id, organization_id into sap_brand, sap_org from public.studio_brand_profiles where company_id = sap_company order by is_primary desc limit 1;
  select id, organization_id into cof_brand, cof_org from public.studio_brand_profiles where company_id = cof_company order by is_primary desc limit 1;

  update public.studio_brand_profiles set ordem = 10 where id = sap_brand;
  update public.studio_brand_profiles set ordem = 50 where id = cof_brand;

  -- Tropeiro Paulista — fatos do cadastro de produtos (products) e do perfil do Instagram.
  if not exists (select 1 from public.studio_brand_profiles where company_id = sap_company and name = 'Café Tropeiro Paulista') then
    insert into public.studio_brand_profiles (company_id, organization_id, name, is_primary, ordem, tone, audience, product_line, dos, donts, notes, guardrails)
    values (sap_company, sap_org, 'Café Tropeiro Paulista', false, 20,
      'Força, tradição e raiz: café da roça, campo e aconchego. Voz direta e calorosa, orgulho paulista.',
      'Mercados, mercearias e atacados em SP; consumidor que gosta de café forte e tradicional.',
      'Tropeiro Paulista Tradicional 500 g (torrado e moído, 100% Arábica, torra média-escura) — unidade, kits de 2, 3 e 4 e fardo de 5 kg. Tropeiro Paulista Extra Forte: produto futuro, não usar.',
      'Tradição, roça, tropeiro, campo, aconchego e força; mostrar o pacote oficial; falar com mercado/mercearia/atacado; CTA para a conta ou para o WhatsApp comercial.',
      'Nunca preço/promoção/cupom inventados; nunca citar o Extra Forte (ainda não lançado); nunca inventar origem/região, prêmio ou benefício de saúde.',
      'Submarca da Saporino com Instagram próprio. Guardrails V1 gerados a partir do cadastro de produtos (21/09/2026) — revisar.',
      jsonb_build_object(
        'version', 1,
        'brand_identity', jsonb_build_object(
          'brand_name', 'Café Tropeiro Paulista', 'parent_brand', 'Café Saporino (submarca)', 'instagram', '@cafetropeiropaulista',
          'tagline', 'Força e tradição em cada xícara.', 'language', 'pt-BR', 'no_prices_on_instagram', true,
          'content_goal', 'Gerar desejo e reconhecimento do Tropeiro Paulista em mercados, mercearias e atacados de SP'),
        'approved_products', jsonb_build_array(jsonb_build_object('id', 'tropeiro_paulista_tradicional', 'name', 'Café Tropeiro Paulista Tradicional', 'status', 'approved', 'hero_visual', true)),
        'approved_product_claims', jsonb_build_object('tropeiro_paulista_tradicional', jsonb_build_array(
          '100% Arábica', 'Torrado e moído', '500 g', 'Torra média-escura', 'Encorpado e intenso', 'Inspirado no sabor do café da roça',
          'Notas de chocolate amargo, caramelo torrado e leve amendoado', 'Retrogosto persistente',
          'Formatos: unidade 500 g, kits de 2, 3 e 4 × 500 g e fardo de 5 kg')),
        'future_products', jsonb_build_array(jsonb_build_object('name', 'Café Tropeiro Paulista Extra Forte', 'status', 'future', 'usable_in_content', false)),
        'copy_rules', jsonb_build_object('language', 'Brazilian Portuguese', 'tone', jsonb_build_array('forte', 'tradicional', 'caloroso', 'direto'),
          'desired_feelings', jsonb_build_array('tradição', 'força', 'aconchego', 'raiz paulista'),
          'never_use_price', true, 'never_invent_promotions', true, 'never_invent_coupon', true, 'never_invent_limited_edition', true),
        'visual_rules', jsonb_build_object('brand_colors', jsonb_build_array('preto', 'dourado', 'creme'),
          'themes', jsonb_build_array('roça', 'tropeiro', 'campo', 'fogão a lenha', 'mesa de café da manhã'), 'coffee_must_look_real', true),
        'asset_rules', jsonb_build_object('logo', jsonb_build_object('official_only', true, 'never_recreate', true),
          'package', jsonb_build_object('official_only', true, 'never_recreate', true, 'if_official_asset_unavailable', 'do_not_use_package')),
        'prohibited_claims', jsonb_build_array('preço/valor no Instagram', 'promoção/cupom/desconto inventado', 'Extra Forte (ainda não lançado)',
          'origem/região específica sem confirmação', 'prêmio ou pontuação sem laudo', 'benefício de saúde'),
        'requires_manual_approval', jsonb_build_array(
          'Torra: o cadastro diz média-escura; a bio do Instagram diz "Torra média" — confirmar qual vale',
          'Citar a Saporino como marca-mãe na comunicação'),
        'publishing_rules', jsonb_build_object('instagram_price', false,
          'allowed_accounts', jsonb_build_array('@cafetropeiropaulista', '@coficobrasil', '@cafesaporino (por escolha do Vlademir)'))
      ));
  end if;

  -- Café Serrão — sem produto no cadastro ainda: nada de claim de produto até confirmar.
  if not exists (select 1 from public.studio_brand_profiles where company_id = sap_company and name = 'Café Serrão') then
    insert into public.studio_brand_profiles (company_id, organization_id, name, is_primary, ordem, tone, audience, product_line, dos, donts, notes, guardrails)
    values (sap_company, sap_org, 'Café Serrão', false, 30,
      'Café tradicional e acolhedor, com a força das serras. Voz simples e próxima.',
      'Mercados, mercearias e atacados; consumidor de café tradicional e extra forte.',
      'Café Serrão Tradicional, Extra Forte e versões em grãos (ficha técnica ainda não cadastrada).',
      'Falar de tradição, sabor e rotina do café; mostrar só a embalagem oficial; CTA para a conta ou para o WhatsApp comercial.',
      'Sem ficha técnica cadastrada: não afirmar torra, variedade (Arábica/Conilon), notas sensoriais, origem ou peso até confirmar. Nunca preço/promoção inventados.',
      'Submarca da Saporino com Instagram próprio (@cafe.serrao). Guardrails V1 mínimos (21/09/2026) — completar com a ficha técnica.',
      jsonb_build_object(
        'version', 1,
        'brand_identity', jsonb_build_object('brand_name', 'Café Serrão', 'parent_brand', 'Café Saporino (submarca)', 'instagram', '@cafe.serrao',
          'language', 'pt-BR', 'no_prices_on_instagram', true, 'content_goal', 'Apresentar o Café Serrão e criar reconhecimento de marca'),
        'approved_products', jsonb_build_array(
          jsonb_build_object('id', 'serrao_tradicional', 'name', 'Café Serrão Tradicional', 'status', 'approved_name_only'),
          jsonb_build_object('id', 'serrao_extra_forte', 'name', 'Café Serrão Extra Forte', 'status', 'approved_name_only'),
          jsonb_build_object('id', 'serrao_graos', 'name', 'Café Serrão em grãos', 'status', 'approved_name_only')),
        'approved_product_claims', jsonb_build_object(),
        'copy_rules', jsonb_build_object('language', 'Brazilian Portuguese', 'never_use_price', true, 'never_invent_promotions', true, 'never_invent_coupon', true),
        'visual_rules', jsonb_build_object('themes', jsonb_build_array('serra', 'montanha', 'nascer do sol'), 'coffee_must_look_real', true),
        'asset_rules', jsonb_build_object('logo', jsonb_build_object('official_only', true, 'never_recreate', true),
          'package', jsonb_build_object('official_only', true, 'never_recreate', true, 'if_official_asset_unavailable', 'do_not_use_package')),
        'prohibited_claims', jsonb_build_array('preço/valor no Instagram', 'promoção/cupom inventado', 'torra, variedade, peso ou notas sensoriais sem ficha técnica',
          'origem/região específica sem confirmação', 'benefício de saúde'),
        'requires_manual_approval', jsonb_build_array('Qualquer característica de produto (ficha técnica ainda não cadastrada)', 'Citar a Saporino como marca-mãe'),
        'publishing_rules', jsonb_build_object('instagram_price', false,
          'allowed_accounts', jsonb_build_array('@cafe.serrao', '@coficobrasil', '@cafesaporino (por escolha do Vlademir)'))
      ));
  end if;

  -- Café do Amor — mesma situação do Serrão.
  if not exists (select 1 from public.studio_brand_profiles where company_id = sap_company and name = 'Café do Amor') then
    insert into public.studio_brand_profiles (company_id, organization_id, name, is_primary, ordem, tone, audience, product_line, dos, donts, notes, guardrails)
    values (sap_company, sap_org, 'Café do Amor', false, 40,
      'Afeto, carinho e momentos a dois ou em família em volta do café.',
      'Mercados, mercearias e atacados; consumidor de café tradicional e extra forte.',
      'Café do Amor Tradicional, Extra Forte e versões em grãos (ficha técnica ainda não cadastrada).',
      'Falar de afeto e momentos de café; mostrar só a embalagem oficial; CTA para a conta ou para o WhatsApp comercial.',
      'Sem ficha técnica cadastrada: não afirmar torra, variedade, notas, origem ou peso até confirmar. Nunca preço/promoção inventados.',
      'Submarca da Saporino com Instagram próprio (@cafedoamorbrasil). Guardrails V1 mínimos (21/09/2026) — completar com a ficha técnica.',
      jsonb_build_object(
        'version', 1,
        'brand_identity', jsonb_build_object('brand_name', 'Café do Amor', 'parent_brand', 'Café Saporino (submarca)', 'instagram', '@cafedoamorbrasil',
          'language', 'pt-BR', 'no_prices_on_instagram', true, 'content_goal', 'Apresentar o Café do Amor e criar reconhecimento de marca'),
        'approved_products', jsonb_build_array(
          jsonb_build_object('id', 'amor_tradicional', 'name', 'Café do Amor Tradicional', 'status', 'approved_name_only'),
          jsonb_build_object('id', 'amor_extra_forte', 'name', 'Café do Amor Extra Forte', 'status', 'approved_name_only'),
          jsonb_build_object('id', 'amor_graos', 'name', 'Café do Amor em grãos', 'status', 'approved_name_only')),
        'approved_product_claims', jsonb_build_object(),
        'copy_rules', jsonb_build_object('language', 'Brazilian Portuguese', 'never_use_price', true, 'never_invent_promotions', true, 'never_invent_coupon', true),
        'asset_rules', jsonb_build_object('logo', jsonb_build_object('official_only', true, 'never_recreate', true),
          'package', jsonb_build_object('official_only', true, 'never_recreate', true, 'if_official_asset_unavailable', 'do_not_use_package')),
        'prohibited_claims', jsonb_build_array('preço/valor no Instagram', 'promoção/cupom inventado', 'características de produto sem ficha técnica', 'benefício de saúde'),
        'requires_manual_approval', jsonb_build_array('Qualquer característica de produto (ficha técnica ainda não cadastrada)', 'Citar a Saporino como marca-mãe'),
        'publishing_rules', jsonb_build_object('instagram_price', false,
          'allowed_accounts', jsonb_build_array('@cafedoamorbrasil', '@coficobrasil', '@cafesaporino (por escolha do Vlademir)'))
      ));
  end if;

  -- Coffee LiVRE — marketplace próprio da COFICO (não é marca de café).
  if not exists (select 1 from public.studio_brand_profiles where company_id = cof_company and name = 'Coffee LiVRE') then
    insert into public.studio_brand_profiles (company_id, organization_id, name, is_primary, ordem, tone, audience, product_line, dos, donts, notes, guardrails)
    values (cof_company, cof_org, 'Coffee LiVRE', false, 60,
      '"Você entende de café. O Coffee LiVRE entende de vender." Voz de parceiro de quem produz e torra café.',
      'Produtores, cooperativas, torrefações, marcas e distribuidores de café (quem vende); empresas e consumidores (quem compra).',
      'Marketplace do café da COFICO. Em fase de apresentação a convidados.',
      'Falar com quem faz café e quer vender mais; explicar o marketplace; CTA para convite/contato.',
      'Não prometer compra aberta ao público nem prazo de lançamento (fase de apresentação); não citar Mercado Livre como se fosse loja lá; nunca inventar taxa, preço ou condição comercial.',
      'Marketplace próprio da COFICO com Instagram próprio (@coffeelivre). Guardrails V1 (21/09/2026) — revisar.',
      jsonb_build_object(
        'version', 1,
        'brand_identity', jsonb_build_object('brand_name', 'Coffee LiVRE', 'owner', 'COFICO BRASIL (V. MEDEIROS DE SANTI LTDA)', 'instagram', '@coffeelivre',
          'tagline', 'Você entende de café. O Coffee LiVRE entende de vender.', 'language', 'pt-BR', 'no_prices_on_instagram', true,
          'content_goal', 'Atrair vendedores de café (produtores, torrefações, marcas) e apresentar o marketplace'),
        'approved_brand_claims', jsonb_build_array('Marketplace especializado em café', 'Operado pela COFICO Brasil'),
        'copy_rules', jsonb_build_object('language', 'Brazilian Portuguese', 'never_invent_fees', true, 'never_promise_launch_date', true, 'never_invent_promotions', true),
        'prohibited_claims', jsonb_build_array('taxas/comissões/preços não publicados', 'data de lançamento', 'loja dentro do Mercado Livre', 'compra aberta ao público (fase de apresentação)'),
        'requires_manual_approval', jsonb_build_array('Qualquer condição comercial para vendedores'),
        'publishing_rules', jsonb_build_object('allowed_accounts', jsonb_build_array('@coffeelivre', '@coficobrasil'))
      ));
  end if;

  -- Saporino: o Tropeiro Tradicional deixa de ser "futuro" (Vlademir pode escolher postar na @cafesaporino).
  update public.studio_brand_profiles
     set guardrails = jsonb_set(jsonb_set(guardrails,
           '{future_products}',
           coalesce((select jsonb_agg(f) from jsonb_array_elements(guardrails -> 'future_products') f
                      where f ->> 'name' not in ('Tropeiro Paulista Tradicional', 'Cafe Serrao')), '[]'::jsonb)),
           '{sub_brands}',
           jsonb_build_object(
             'note', 'Submarcas da Saporino com Instagram próprio. Conteúdo delas pode sair na @cafesaporino POR ESCOLHA do Vlademir; o normal é sair na conta da própria submarca e na @coficobrasil.',
             'brands', jsonb_build_array('Café Tropeiro Paulista', 'Café Serrão', 'Café do Amor'),
             'approved_in_saporino_account', jsonb_build_array('Café Tropeiro Paulista Tradicional'),
             'still_future', jsonb_build_array('Tropeiro Paulista Extra Forte')))
   where id = sap_brand;
end $$;

-- Ordem estável das abas para as marcas sem ordem definida.
update public.studio_brand_profiles set ordem = 90 where ordem = 100 and not is_primary;
