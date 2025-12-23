/*
  # Sistema de Formatos de Etiquetas de Envio

  1. Nova Tabela: label_formats
    - Formatos de etiquetas para diferentes transportadoras
    - Tamanhos em mm (largura x altura)
    - Templates customizados
    
  2. Transportadoras Padrão
    - Correios (100x150mm)
    - Jadlog (100x150mm)
    - Total Express (100x150mm)
    - Azul Cargo (100x150mm)
    - Loggi (100x150mm)
    - Amazon (100x50mm - produto)
    - Mercado Livre (100x150mm)
    - Shopee (100x100mm)
    
  3. Segurança
    - RLS habilitado
    - Apenas admins podem gerenciar
*/

CREATE TABLE IF NOT EXISTS label_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  width_mm integer NOT NULL DEFAULT 100,
  height_mm integer NOT NULL DEFAULT 150,
  format_type text NOT NULL CHECK (format_type IN ('correios', 'transportadora', 'marketplace')),
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  barcode_type text DEFAULT 'CODE128',
  has_logo boolean DEFAULT true,
  custom_css text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE label_formats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active label formats"
  ON label_formats FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage label formats"
  ON label_formats FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

INSERT INTO label_formats (name, code, width_mm, height_mm, format_type, is_default) VALUES
  ('Correios - Sedex/PAC', 'correios', 100, 150, 'correios', true),
  ('Jadlog', 'jadlog', 100, 150, 'transportadora', false),
  ('Total Express', 'total_express', 100, 150, 'transportadora', false),
  ('Azul Cargo', 'azul_cargo', 100, 150, 'transportadora', false),
  ('Loggi', 'loggi', 100, 150, 'transportadora', false),
  ('Amazon - Produto', 'amazon_produto', 100, 50, 'marketplace', false),
  ('Amazon - Envio', 'amazon_envio', 100, 150, 'marketplace', false),
  ('Mercado Livre', 'mercado_livre', 100, 150, 'marketplace', false),
  ('Shopee', 'shopee', 100, 100, 'marketplace', false)
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_label_formats_code ON label_formats(code);
CREATE INDEX IF NOT EXISTS idx_label_formats_type ON label_formats(format_type);
CREATE INDEX IF NOT EXISTS idx_label_formats_active ON label_formats(is_active);
