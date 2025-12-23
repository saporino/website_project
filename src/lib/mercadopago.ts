export const MERCADO_PAGO_PUBLIC_KEY = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY;

export interface MercadoPagoPreferenceItem {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
}

export interface MercadoPagoPreference {
  items: MercadoPagoPreferenceItem[];
  back_urls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
  auto_return?: 'approved' | 'all';
  payer?: {
    name?: string;
    email?: string;
    phone?: {
      number?: string;
    };
  };
  external_reference?: string;
}

export const createPreference = async (preference: MercadoPagoPreference) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(preference),
    });

    if (!response.ok) {
      throw new Error('Failed to create preference');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating preference:', error);
    throw error;
  }
};
