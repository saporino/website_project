ALTER TABLE public.representative_orders
ADD COLUMN IF NOT EXISTS client_order_number TEXT,
ADD COLUMN IF NOT EXISTS has_client_order_number BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS payment_term INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS commission_paid_proof_url TEXT,
ADD COLUMN IF NOT EXISTS service_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'repco',
ADD COLUMN IF NOT EXISTS pix_bonus_eligible BOOLEAN DEFAULT FALSE;

ALTER TABLE public.representative_commissions
ADD COLUMN IF NOT EXISTS payment_cycle_start DATE,
ADD COLUMN IF NOT EXISTS payment_cycle_end DATE,
ADD COLUMN IF NOT EXISTS scheduled_payment_date DATE,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS proof_url TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'site';
