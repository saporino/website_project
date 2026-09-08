// Este arquivo passou a ser só tipos e utilidades de CEP/peso. A antiga
// `getCarrierQuotes` foi removida: ninguém a chamava desde que a cotação
// passou para `cotarFrete`/`cotarSuperFrete`, e ela selecionava `api_key` da
// transportadora numa consulta feita pelo navegador.

export interface CarrierQuote {
  id: string;
  name: string;
  code: string;
  logo_url?: string | null;
  price: number;
  delivery_time_days: number;
  api_type: string;
  is_api_configured: boolean;
  /** Quanto a loja está bancando do frete. Só vem na cotação ao vivo. */
  desconto?: number;
  /** Cotação congelada, para a cobrança usar o mesmo preço mostrado. */
  cotacaoId?: string | null;
  /**
   * Composição do frete, quando a cotação sabe dizer. Só a tabela própria
   * abre os números: o agregador entrega um preço fechado.
   * Frete que aparece como um número só parece caro; separado, dá para ver
   * o que é transporte e o que é seguro obrigatório.
   */
  detalhe?: {
    zona: string | null;
    uf: string | null;
    cidade: string | null;
    /** A faixa de peso da transportadora. */
    transporte: number;
    /** Seguro (ad valorem): percentual sobre o valor da mercadoria. */
    seguro: number;
    /** GRIS: gerenciamento de risco, percentual com piso. */
    gris: number;
    /** Pedágio: por 100 kg ou fração, em toda entrega. */
    pedagio: number;
    /** TAS: só quando o envio é interestadual. Zero no resto. */
    tas: number;
  } | null;
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

/**
 * Endereço a partir do CEP, com dois provedores.
 *
 * O ViaCEP sozinho não bastava: ele responde `erro` para os CEPs GERAIS de
 * cidade (13930-000, Serra Negra, é um deles), que são CEPs perfeitamente
 * válidos e entregáveis. Quando isso acontecia, quem digitava o CEP novo
 * continuava vendo o endereço do CEP ANTERIOR na tela — e podia comprar com
 * ele. Um pedido despachado para a cidade errada é o pior desfecho possível
 * desta tela.
 *
 * A BrasilAPI cobre justamente esse caso: devolve cidade e UF mesmo sem
 * logradouro. Aí o cliente completa rua e número à mão, que é o certo — num
 * CEP geral não existe rua para preencher.
 */
export async function lookupCEP(cep: string): Promise<CEPAddress | null> {
  const cleaned = cep.replace(/\D/g, '');
  if (cleaned.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    if (response.ok) {
      const data = await response.json();
      if (!data.erro && data.localidade) {
        return {
          cep: data.cep,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade,
          state: data.uf,
        };
      }
    }
  } catch {
    // Provedor fora do ar não encerra a busca: ainda há o segundo.
  }

  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleaned}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d?.city) return null;
    return {
      cep: cleaned,
      street: d.street || '',
      neighborhood: d.neighborhood || '',
      city: d.city,
      state: d.state,
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
