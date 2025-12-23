/*
  # Melhorias no Sistema de Clientes

  1. Novos Campos em user_profiles
    - `celular` - Campo separado para celular
    - `anniversary_email_sent` - Flag para controlar envio de email de aniversário
    - `anniversary_gift_sent` - Flag para controlar envio de brinde
    
  2. Novos Campos em user_addresses
    - `address_type` - Tipo do endereço ('billing' ou 'shipping')
    - `is_billing_address` - Se é endereço de cobrança
    - `is_shipping_address` - Se é endereço de entrega
    - `same_as_billing` - Se endereço de entrega é igual ao de cobrança
    
  3. Nova Tabela: customer_stats
    - Estatísticas de compras por cliente
    - Total gasto, produtos favoritos, etc
    
  4. Nova Tabela: anniversary_gifts
    - Controle de brindes de aniversário enviados
    
  5. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas restritivas de acesso
*/

-- Adicionar novos campos em user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'celular'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN celular text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'anniversary_email_sent'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN anniversary_email_sent boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'anniversary_gift_sent'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN anniversary_gift_sent boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_anniversary_email_date'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_anniversary_email_date timestamptz;
  END IF;
END $$;

-- Melhorar user_addresses para suportar endereços de cobrança e entrega
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_addresses' AND column_name = 'address_type'
  ) THEN
    ALTER TABLE user_addresses ADD COLUMN address_type text CHECK (address_type IN ('billing', 'shipping', 'both'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_addresses' AND column_name = 'is_billing_address'
  ) THEN
    ALTER TABLE user_addresses ADD COLUMN is_billing_address boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_addresses' AND column_name = 'is_shipping_address'
  ) THEN
    ALTER TABLE user_addresses ADD COLUMN is_shipping_address boolean DEFAULT true;
  END IF;
END $$;

-- Criar tabela de estatísticas do cliente
CREATE TABLE IF NOT EXISTS customer_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  total_orders integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  favorite_product_id uuid REFERENCES products(id),
  favorite_product_quantity integer DEFAULT 0,
  last_order_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE customer_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stats"
  ON customer_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all stats"
  ON customer_stats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Criar tabela de brindes de aniversário
CREATE TABLE IF NOT EXISTS anniversary_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  anniversary_year integer NOT NULL,
  email_sent_at timestamptz,
  gift_sent_at timestamptz,
  tracking_code text,
  product_id uuid REFERENCES products(id),
  product_name text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'email_sent', 'gift_sent', 'delivered')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE anniversary_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gifts"
  ON anniversary_gifts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all gifts"
  ON anniversary_gifts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_customer_stats_user_id ON customer_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_anniversary_gifts_user_id ON anniversary_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_anniversary_gifts_status ON anniversary_gifts(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);

-- Criar função para atualizar estatísticas do cliente
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO customer_stats (user_id, total_orders, total_spent, last_order_date)
  VALUES (
    NEW.user_id,
    1,
    NEW.total_amount,
    NEW.created_at
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_orders = customer_stats.total_orders + 1,
    total_spent = customer_stats.total_spent + NEW.total_amount,
    last_order_date = NEW.created_at,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para atualizar stats automaticamente
DROP TRIGGER IF EXISTS update_stats_on_order ON orders;
CREATE TRIGGER update_stats_on_order
  AFTER INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL AND NEW.payment_status = 'paid')
  EXECUTE FUNCTION update_customer_stats();
