-- Camada 1.1 do blueprint (RepCo inteligência de dados): dimensões de análise.
-- Migração ADITIVA e idempotente. Pré-requisito do heatmap por área e do painel de inteligência.

-- 1) Linha de produto (campo aberto/extensível; admin define por produto)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_line text;

-- 2) Geo estruturado no cliente do rep (heatmap de vendas por área).
--    lat/lng ficam para uma fase de geocodificação; v1 agrega por município/UF.
ALTER TABLE public.representative_clients
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- 3) De-para inicial das linhas (produtos reais; testes ficam NULL)
UPDATE public.products SET product_line = 'Tropeiro Paulista Extra Forte' WHERE name = 'Tropeiro Paulista Extra Forte';
UPDATE public.products SET product_line = 'Tropeiro Paulista Tradicional' WHERE name = 'Tropeiro Paulista Tradicional';
UPDATE public.products SET product_line = 'Saporino Clássico'            WHERE name = 'Café Saporino Tradicional';

-- 4) Backfill geo do cliente de teste CAFE SAPORINO (dados oficiais da Receita)
UPDATE public.representative_clients
   SET cep = '06454-000', municipio = 'Barueri', uf = 'SP',
       bairro = 'Alphaville Centro Industrial e Empresarial'
 WHERE razao_social = 'CAFE SAPORINO LTDA';
