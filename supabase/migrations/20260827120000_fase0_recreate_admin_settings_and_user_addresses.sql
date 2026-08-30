/*
  Fase 0 / P0 — Recriar 2 tabelas fantasma que quebram fluxos B2C ativos.

  Contexto: a auditoria confirmou (via information_schema) que `admin_settings`
  e `user_addresses` são referenciadas pelo código mas NÃO existem no banco real
  (schema drift — as migrations originais nunca foram aplicadas).
    - admin_settings: sem ela, create-payment e mercadopago-webhook quebram
      (checkout B2C). O código já foi tornado resiliente (cai no secret de env),
      mas a tabela é necessária para a UI de Configurações da Loja.
    - user_addresses: sem ela, o checkout de assinatura quebra ao gravar o endereço.

  Esta migration é MÍNIMA e IDEMPOTENTE (só as 2 tabelas + RLS + seed).
  Copiada das definições originais (20251014170515 / 20251011181222), SEM os
  efeitos colaterais amplos daquelas migrations (ex.: alterar policies de orders).
  Dependência verificada: user_profiles (com is_admin) já existe no banco real.

  NÃO aplicar em produção sem revisão. Ver REPCO_ECOSYSTEM_IMPLEMENTATION_STATUS.md.
*/

-- =====================================================
-- admin_settings
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL DEFAULT 'Café Saporino',
  store_cnpj text,
  store_email text,
  store_phone text,
  sender_name text NOT NULL DEFAULT 'Café Saporino',
  sender_street text,
  sender_number text,
  sender_complement text,
  sender_neighborhood text,
  sender_city text,
  sender_state text,
  sender_cep text,
  mercado_pago_access_token text,
  mercado_pago_public_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view settings" ON admin_settings;
CREATE POLICY "Admins can view settings"
  ON admin_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = true));

DROP POLICY IF EXISTS "Admins can update settings" ON admin_settings;
CREATE POLICY "Admins can update settings"
  ON admin_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = true));

DROP POLICY IF EXISTS "Admins can insert settings" ON admin_settings;
CREATE POLICY "Admins can insert settings"
  ON admin_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.is_admin = true));

-- Linha inicial única (guardada para ser idempotente).
INSERT INTO admin_settings (store_name, sender_name, sender_city, sender_state)
SELECT 'Café Saporino', 'Café Saporino', 'São Paulo', 'SP'
WHERE NOT EXISTS (SELECT 1 FROM admin_settings);

-- =====================================================
-- user_addresses  (user_profiles já existe no banco real)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  country text DEFAULT 'Brasil',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own addresses" ON user_addresses;
CREATE POLICY "Users can view own addresses"
  ON user_addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own addresses" ON user_addresses;
CREATE POLICY "Users can insert own addresses"
  ON user_addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own addresses" ON user_addresses;
CREATE POLICY "Users can update own addresses"
  ON user_addresses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own addresses" ON user_addresses;
CREATE POLICY "Users can delete own addresses"
  ON user_addresses FOR DELETE TO authenticated USING (auth.uid() = user_id);
