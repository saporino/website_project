-- A MARCA DO CAFÉ, separada da linha e da empresa.
--
-- A vitrine da COFICO agrupava por EMPRESA DONA, então saía assim:
--
--     CAFÉ SAPORINO     → Saporino Clássico + Tropeiro Paulista + kits
--     COFICO BRASIL     → um Tropeiro Paulista
--
-- Dois problemas de uma vez. Primeiro, marcas diferentes amontoadas debaixo de
-- um nome só — o Tropeiro Paulista é marca própria, não um "produto Saporino".
-- Segundo, um grupo chamado COFICO BRASIL com um Tropeiro dentro: a COFICO é a
-- distribuidora, não a marca do café.
--
-- Faltava o degrau do meio. O sistema tinha EMPRESA (quem é dona) e LINHA
-- (`product_line`: "Tropeiro Paulista Tradicional", "Tropeiro Paulista Extra
-- Forte"), e nada entre os dois. Quem compra não pensa em nenhum dos dois:
-- pensa em MARCA — Tropeiro Paulista, com Tradicional e Extra Forte dentro.
--
--     empresa   CAFE SAPORINO LTDA          quem é dona, fatura, paga imposto
--     marca     Tropeiro Paulista           o que está escrito no pacote  ← NOVO
--     linha     Tropeiro Paulista Tradicional   a variante
--
-- Campo ABERTO, como `product_line` — marca nova não exige migration.

alter table public.products
  add column if not exists brand text;

comment on column public.products.brand is
  'Marca estampada no pacote (Tropeiro Paulista, Café Saporino, Café Serrão). Diferente de company_id (empresa dona) e de product_line (a variante). É por ela que as vitrines agrupam.';

create index if not exists products_brand_idx on public.products (brand) where brand is not null;

-- ── BACKFILL CONSERVADOR ─────────────────────────────────────────────────────
-- Só preenche onde a marca é EVIDENTE pela linha já cadastrada. Nada é
-- adivinhado a partir do nome do produto: "Café Gourmet Patrocinense" poderia
-- ser marca, linha ou descrição, e chutar aqui encheria a vitrine de grupos
-- inventados. Produto sem marca definida continua NULL, e a tela trata isso
-- explicitamente em vez de fingir que sabe.
update public.products
   set brand = 'Tropeiro Paulista'
 where brand is null
   and product_line in ('Tropeiro Paulista Tradicional', 'Tropeiro Paulista Extra Forte');

update public.products
   set brand = 'Café Saporino'
 where brand is null
   and product_line = 'Saporino Clássico';

-- Canaan é café de terceiro e não vai ao ar (ordem dele). Recebe a marca para
-- ficar organizado no painel; continua fora da vitrine por `is_active` e
-- `hidden_from_store`, que é o que controla publicação.
update public.products
   set brand = 'Café Canaan'
 where brand is null
   and product_line like 'CANAAN%';
