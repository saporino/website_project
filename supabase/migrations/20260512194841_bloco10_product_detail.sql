ALTER TABLE products ADD COLUMN IF NOT EXISTS promotional_price numeric(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percentage integer DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS roast_type text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS flavor_notes text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS full_details text;