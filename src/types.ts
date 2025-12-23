export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  weight: string;
  weight_grams?: number;
  stock: number;
  featured: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface UserProfile {
  id: string;
  full_name: string;
  phone: string | null;
  is_admin?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAddress {
  id: string;
  user_id: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  total_amount: number;
  status: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  account_type: 'PF' | 'PJ';
  selected_coffees: string[];
  grind_type: 'beans' | 'coado' | 'espresso';
  shipping_date: 1 | 15;
  status: 'active' | 'paused' | 'cancelled';
  created_at: string;
  updated_at: string;
}
