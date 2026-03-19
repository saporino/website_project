import { supabase } from './supabase';

export interface CarrierQuote {
  id: string;
  name: string;
  code: string;
  logo_url?: string;
  price: number;
  delivery_time_days: number;
  api_type: string;
  is_api_configured: boolean;
}

export interface ShippingAddress {
  recipient_name: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  is_gift: boolean;
}

/**
 * Fetch shipping carrier quotes for a given CEP and cart weight.
 * Current mode: uses manual fallback (fixed_price + price_per_kg * weight).
 * Future: when api_type !== 'manual' and credentials are set, calls carrier API.
 */
export async function getCarrierQuotes(cep: string, weightKg: number = 0.5): Promise<CarrierQuote[]> {
  try {
    const { data: carriers, error } = await supabase
      .from('shipping_carriers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    if (!carriers || carriers.length === 0) return [];

    const quotes: CarrierQuote[] = carriers.map((carrier: any) => {
      // Check if this carrier has API credentials configured
      const isApiConfigured = !!(carrier.api_key && carrier.api_endpoint && carrier.api_type !== 'manual');

      // Determine price:
      // - If API is configured in the future, we'd call the carrier's API here
      // - For now: use manual fixed_price + price_per_kg * weight (or 0 if not set)
      let price = 0;
      if (carrier.api_type === 'manual' || !isApiConfigured) {
        price = (carrier.fixed_price || 0) + (carrier.price_per_kg || 0) * weightKg;
      }

      return {
        id: carrier.id,
        name: carrier.name,
        code: carrier.code,
        logo_url: carrier.logo_url,
        price,
        delivery_time_days: carrier.delivery_time_days || 5,
        api_type: carrier.api_type || 'manual',
        is_api_configured: isApiConfigured,
      };
    });

    return quotes;
  } catch (error) {
    console.error('Error fetching carrier quotes:', error);
    return [];
  }
}

/**
 * Lookup address via ViaCEP API (free Brazilian CEP lookup service)
 */
export interface CEPAddress {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  error?: string;
}

export async function lookupCEP(cep: string): Promise<CEPAddress | null> {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.erro) return null;

    return {
      cep: data.cep,
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf,
    };
  } catch {
    return null;
  }
}

/**
 * Format CEP with mask: 00000-000
 */
export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length >= 6) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
}

/**
 * Calculate total cart weight in kg
 * Assumes each product unit weighs approximately 0.5kg (500g)
 */
export function calculateCartWeight(items: { quantity: number }[], gramsPerUnit: number = 500): number {
  const totalGrams = items.reduce((sum, item) => sum + item.quantity * gramsPerUnit, 0);
  return totalGrams / 1000;
}
