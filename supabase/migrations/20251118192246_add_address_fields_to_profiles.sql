/*
  # Adicionar Campos de Endereço no Perfil do Usuário

  1. Novos Campos
    - Endereço de Cobrança (billing_*)
    - Endereço de Entrega (shipping_*)
    
  2. Notas
    - Todos os campos são opcionais
    - Facilita o gerenciamento de endereços diretamente no perfil
*/

DO $$
BEGIN
  -- Billing Address Fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'billing_address') THEN
    ALTER TABLE user_profiles ADD COLUMN billing_address text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'billing_number') THEN
    ALTER TABLE user_profiles ADD COLUMN billing_number text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'billing_complement') THEN
    ALTER TABLE user_profiles ADD COLUMN billing_complement text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'billing_neighborhood') THEN
    ALTER TABLE user_profiles ADD COLUMN billing_neighborhood text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'billing_city') THEN
    ALTER TABLE user_profiles ADD COLUMN billing_city text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'billing_state') THEN
    ALTER TABLE user_profiles ADD COLUMN billing_state text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'billing_cep') THEN
    ALTER TABLE user_profiles ADD COLUMN billing_cep text;
  END IF;

  -- Shipping Address Fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'shipping_address') THEN
    ALTER TABLE user_profiles ADD COLUMN shipping_address text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'shipping_number') THEN
    ALTER TABLE user_profiles ADD COLUMN shipping_number text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'shipping_complement') THEN
    ALTER TABLE user_profiles ADD COLUMN shipping_complement text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'shipping_neighborhood') THEN
    ALTER TABLE user_profiles ADD COLUMN shipping_neighborhood text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'shipping_city') THEN
    ALTER TABLE user_profiles ADD COLUMN shipping_city text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'shipping_state') THEN
    ALTER TABLE user_profiles ADD COLUMN shipping_state text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'shipping_cep') THEN
    ALTER TABLE user_profiles ADD COLUMN shipping_cep text;
  END IF;
END $$;
