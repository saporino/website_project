-- Migration: Create Orders and Order Items Tables
-- Description: Creates tables to store customer orders and their items for Mercado Pago integration
-- Created: 2025-12-09

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_number TEXT UNIQUE NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_process', 'cancelled', 'refunded')),
  payment_method TEXT CHECK (payment_method IN ('credit_card', 'debit_card', 'pix', 'boleto', 'other')),
  
  -- Mercado Pago Integration Fields
  mercadopago_preference_id TEXT,
  mercadopago_payment_id TEXT,
  mercadopago_collection_id TEXT,
  mercadopago_collection_status TEXT,
  external_reference TEXT,
  
  -- Customer Information
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  
  -- Shipping Information
  shipping_address TEXT,
  shipping_postal_code TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_number TEXT,
  shipping_neighborhood TEXT,
  shipping_complement TEXT,
  
  -- Order Type
  order_type TEXT DEFAULT 'single' CHECK (order_type IN ('single', 'subscription')),
  
  -- Subscription Fields (if applicable)
  subscription_frequency TEXT CHECK (subscription_frequency IN ('monthly', 'biweekly', 'weekly', NULL)),
  subscription_shipping_date INTEGER CHECK (subscription_shipping_date IN (1, 15, NULL)),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Product Information (stored to preserve order history)
  product_name TEXT NOT NULL,
  product_description TEXT,
  grind_type TEXT CHECK (grind_type IN ('beans', 'coado', 'espresso', NULL)),
  
  -- Pricing
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_mercadopago_preference_id ON orders(mercadopago_preference_id);
CREATE INDEX IF NOT EXISTS idx_orders_mercadopago_payment_id ON orders(mercadopago_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Create function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate order number: ORD-YYYYMMDD-XXXXX (5 random digits)
    new_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
    
    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = new_number) INTO exists_check;
    
    -- If it doesn't exist, return it
    IF NOT exists_check THEN
      RETURN new_number;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders table

-- Policy: Users can view their own orders
CREATE POLICY "Users can view their own orders"
  ON orders
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own orders
CREATE POLICY "Users can insert their own orders"
  ON orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own orders
CREATE POLICY "Users can update their own orders"
  ON orders
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Policy: Admins can update all orders
CREATE POLICY "Admins can update all orders"
  ON orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Policy: Admins can delete orders
CREATE POLICY "Admins can delete orders"
  ON orders
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- RLS Policies for order_items table

-- Policy: Users can view items from their own orders
CREATE POLICY "Users can view items from their own orders"
  ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Policy: Users can insert items for their own orders
CREATE POLICY "Users can insert items for their own orders"
  ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Policy: Admins can view all order items
CREATE POLICY "Admins can view all order items"
  ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Policy: Admins can update all order items
CREATE POLICY "Admins can update all order items"
  ON order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Policy: Admins can delete order items
CREATE POLICY "Admins can delete order items"
  ON order_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Add comments for documentation
COMMENT ON TABLE orders IS 'Stores customer orders with Mercado Pago payment integration';
COMMENT ON TABLE order_items IS 'Stores individual items for each order';
COMMENT ON COLUMN orders.order_number IS 'Unique order number in format ORD-YYYYMMDD-XXXXX';
COMMENT ON COLUMN orders.status IS 'Order status: pending, approved, rejected, in_process, cancelled, refunded';
COMMENT ON COLUMN orders.mercadopago_preference_id IS 'Mercado Pago preference ID for payment';
COMMENT ON COLUMN orders.mercadopago_payment_id IS 'Mercado Pago payment ID after successful payment';
COMMENT ON COLUMN orders.order_type IS 'Type of order: single purchase or subscription';
