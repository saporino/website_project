-- ============================================================
-- Script de Dados Iniciais - Café Saporino
-- ============================================================
-- Execute este script no SQL Editor do Supabase APÓS aplicar
-- todas as migrations.
-- ============================================================

-- 1. Inserir Produtos de Café
-- ============================================================
INSERT INTO products (
  name, 
  description, 
  price, 
  image_url, 
  weight_grams, 
  roast_type, 
  flavor_notes, 
  in_stock
)
VALUES
  (
    'Café Especial Arábica',
    'Café 100% arábica de origem única, cultivado em altitude. Notas marcantes de chocolate e caramelo, com finalização suave e adocicada.',
    45.90,
    '/cafe-logo-saporino copy.png',
    250,
    'medium',
    '["chocolate", "caramelo", "nozes"]'::jsonb,
    true
  ),
  (
    'Café Premium Gourmet',
    'Blend exclusivo de grãos especialmente selecionados, com torra artesanal e perfil complexo. Ideal para apreciadores exigentes.',
    52.90,
    '/cafe-logo-saporino copy.png',
    250,
    'dark',
    '["cacau", "frutas vermelhas", "especiarias"]'::jsonb,
    true
  ),
  (
    'Café Origins Especial',
    'Café de altitude com acidez equilibrada e corpo leve. Perfeito para métodos de extração filtrada.',
    39.90,
    '/cafe-logo-saporino copy.png',
    250,
    'light',
    '["cítrico", "floral", "mel"]'::jsonb,
    true
  ),
  (
    'Café Intenso Expresso',
    'Blend especial para espresso, com corpo intenso e crema persistente. Torra escura que realça notas achocolatadas.',
    48.90,
    '/cafe-logo-saporino copy.png',
    250,
    'dark',
    '["chocolate amargo", "avelã", "caramelo queimado"]'::jsonb,
    true
  ),
  (
    'Café Tradicional do Dia',
    'Nosso café do dia, perfeito para o consumo diário. Equilíbrio entre corpo e acidez, com torra média.',
    35.90,
    '/cafe-logo-saporino copy.png',
    500,
    'medium',
    '["nozes", "chocolate ao leite", "caramelo"]'::jsonb,
    true
  )
ON CONFLICT DO NOTHING;

-- 2. Verificar se as transportadoras foram criadas
-- ============================================================
-- Este comando mostra as transportadoras cadastradas
SELECT name, code, fixed_price, delivery_time_days, is_active 
FROM shipping_carriers;

-- 3. Verificar se a configuração da loja foi criada
-- ============================================================
SELECT store_name, sender_city, sender_state 
FROM admin_settings 
LIMIT 1;

-- 4. Instruções para criar usuário admin
-- ============================================================
-- IMPORTANTE: Execute os passos abaixo APÓS criar um usuário
-- no Supabase Authentication:
--
-- Passo 1: Vá em Authentication → Users → Add User
-- Passo 2: Crie o usuário e copie o User UID
-- Passo 3: Execute o comando abaixo substituindo 'USER_UID':
--
-- UPDATE user_profiles
-- SET is_admin = true
-- WHERE id = 'COLE_AQUI_O_USER_UID';

-- 5. Verificar produtos inseridos
-- ============================================================
SELECT id, name, price, roast_type, in_stock 
FROM products 
ORDER BY price ASC;
