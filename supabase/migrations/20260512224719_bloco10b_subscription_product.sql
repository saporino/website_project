ALTER TABLE products ADD COLUMN IF NOT EXISTS subscription_enabled boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subscription_months integer DEFAULT 6;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subscription_discount_pct integer DEFAULT 20;