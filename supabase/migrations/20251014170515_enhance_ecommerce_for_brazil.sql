/*
  # Melhorias para E-commerce - Brasil
  
  ## Modificações e Adições
  
  ### 1. Tabela `products` - Adicionar campos
  - `promotional_price` - Preço promocional
  - Campo `weight_grams` já existe ✓
  
  ### 2. Tabela `orders` - Adicionar campos
  - Campos de endereço já existem ✓
  - `tracking_code` - Para rastreamento de envio
  - Melhorar status do pedido
  
  ### 3. Nova Tabela: `admin_settings`
  - Configurações gerais da loja
  - Dados da empresa (para etiqueta de remetente)
  
  ### 4. Melhorias em RLS
  - Garantir que admins possam acessar tudo
  - Clientes só veem seus próprios dados
  
  ### 5. Dados Iniciais
  - Configurar transportadoras padrão (PAC, SEDEX)
  - Dados da empresa Café Saporino
*/

-- =====================================================
-- MELHORAR TABELA: products
-- =====================================================

-- Adicionar promotional_price se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'promotional_price'
  ) THEN
    ALTER TABLE products ADD COLUMN promotional_price numeric(10,2) CHECK (promotional_price >= 0);
  END IF;
END $$;

-- Garantir que weight_grams existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'weight_grams'
  ) THEN
    ALTER TABLE products ADD COLUMN weight_grams integer DEFAULT 500 CHECK (weight_grams > 0);
  END IF;
END $$;

-- =====================================================
-- MELHORAR TABELA: orders
-- =====================================================

-- Adicionar tracking_code se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tracking_code'
  ) THEN
    ALTER TABLE orders ADD COLUMN tracking_code text;
  END IF;
END $$;

-- Adicionar shipped_at se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipped_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipped_at timestamptz;
  END IF;
END $$;

-- Adicionar delivered_at se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivered_at timestamptz;
  END IF;
END $$;

-- Adicionar carrier_name se não existir (nome da transportadora)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'carrier_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN carrier_name text;
  END IF;
END $$;

-- =====================================================
-- NOVA TABELA: admin_settings
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL DEFAULT 'Café Saporino',
  store_cnpj text,
  store_email text,
  store_phone text,
  -- Endereço do remetente (para etiquetas)
  sender_name text NOT NULL DEFAULT 'Café Saporino',
  sender_street text,
  sender_number text,
  sender_complement text,
  sender_neighborhood text,
  sender_city text,
  sender_state text,
  sender_cep text,
  -- Configurações de pagamento
  mercado_pago_access_token text,
  mercado_pago_public_key text,
  -- Configurações gerais
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- MELHORAR TABELA: shipping_carriers
-- =====================================================

-- Garantir que delivery_time_days existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_carriers' AND column_name = 'delivery_time_days'
  ) THEN
    ALTER TABLE shipping_carriers ADD COLUMN delivery_time_days integer DEFAULT 7 CHECK (delivery_time_days > 0);
  END IF;
END $$;

-- =====================================================
-- SEGURANÇA: RLS para admin_settings
-- =====================================================
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Admins podem ver e editar configurações
CREATE POLICY "Admins can view settings"
  ON admin_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update settings"
  ON admin_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert settings"
  ON admin_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- =====================================================
-- DADOS INICIAIS: Configurações da Loja
-- =====================================================
INSERT INTO admin_settings (
  store_name,
  sender_name,
  sender_city,
  sender_state
)
VALUES (
  'Café Saporino',
  'Café Saporino',
  'São Paulo',
  'SP'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- MELHORAR RLS: shipping_carriers
-- =====================================================

-- Garantir que shipping_carriers tem RLS
ALTER TABLE shipping_carriers ENABLE ROW LEVEL SECURITY;

-- Drop políticas antigas se existirem
DROP POLICY IF EXISTS "Anyone can view active carriers" ON shipping_carriers;
DROP POLICY IF EXISTS "Admins can manage carriers" ON shipping_carriers;

-- Todos podem ver transportadoras ativas
CREATE POLICY "Anyone can view active carriers"
  ON shipping_carriers FOR SELECT
  TO public
  USING (is_active = true);

-- Admins podem gerenciar todas
CREATE POLICY "Admins can manage all carriers"
  ON shipping_carriers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- =====================================================
-- GARANTIR shipping_carriers tem dados
-- =====================================================
INSERT INTO shipping_carriers (name, code, delivery_time_days, fixed_price, is_active)
VALUES 
  ('Correios PAC', 'correios-pac', 10, 15.00, true),
  ('Correios SEDEX', 'correios-sedex', 5, 25.00, true)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- TRIGGER: Atualizar updated_at em admin_settings
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_settings_updated_at ON admin_settings;
CREATE TRIGGER admin_settings_updated_at
  BEFORE UPDATE ON admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();