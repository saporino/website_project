// Empresa vendedora/faturadora e chave pública do Mercado Pago, por domínio.
//
// Regra de negócio: quem recebe o dinheiro é a empresa que VENDE e FATURA, não a
// marca do produto. O mesmo Café Saporino fatura pela Saporino em
// cafesaporino.com.br e pela COFICO na Casa Cofico. Produto igual, recebedor
// diferente. Tropeiro Paulista e Café Serrão são marcas da Saporino, não empresas.
//
// O domínio só decide na CRIAÇÃO do pedido. Depois de criado, o pedido carrega
// `seller_company_id` e é ele que manda — o pagamento nunca volta a olhar o domínio.

import { supabase } from './supabase';

/** Prefixo da empresa (`companies.order_prefix`) para o domínio atual. */
export function sellerPrefixForHost(hostname?: string): 'CS' | 'CO' | null {
  // Em build e prerender não existe window. Sem domínio não há empresa, e sem
  // empresa o pedido não nasce.
  const bruto = hostname ?? (typeof window === 'undefined' ? '' : window.location.hostname);
  const host = bruto.toLowerCase().replace(/^www\./, '');
  if (host === 'coficobrasil.com.br') return 'CO';
  if (host === 'cafesaporino.com.br') return 'CS';
  // Desenvolvimento e preview: assume a loja da Saporino, que é a única que vende
  // hoje. Decisão explícita, não padrão escondido.
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) return 'CS';
  return null;
}

/**
 * Id da empresa faturadora para o domínio atual.
 * Devolve null quando o domínio não é reconhecido — nesse caso o pedido não deve
 * ser criado, porque gravar a empresa errada significa faturar no CNPJ errado.
 */
export async function fetchSellerCompanyId(): Promise<string | null> {
  const prefix = sellerPrefixForHost();
  if (!prefix) return null;
  const { data, error } = await supabase
    .from('companies')
    .select('id, payment_account')
    .eq('order_prefix', prefix)
    .maybeSingle();
  if (error || !data?.payment_account) return null;   // sem meio de recebimento: não vende
  return data.id;
}

/**
 * Chave pública do Mercado Pago do domínio atual.
 *
 * Importante, e documentado de propósito: no fluxo atual o Wallet é por
 * REDIRECIONAMENTO, então a chave pública NÃO decide para onde o dinheiro vai.
 * Quem decide é a preferência, criada pelo `create-payment` com a credencial da
 * empresa faturadora. A chave certa por domínio é mantida mesmo assim, porque o
 * dia em que o checkout usar campos de cartão na própria página, chave e
 * preferência de contas diferentes passam a quebrar o pagamento.
 */
export function mercadoPagoPublicKey(hostname?: string): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  const prefix = sellerPrefixForHost(hostname);
  const porEmpresa = prefix === 'CO'
    ? env.VITE_MERCADO_PAGO_PUBLIC_KEY_COFICO
    : env.VITE_MERCADO_PAGO_PUBLIC_KEY_SAPORINO;
  // Enquanto as variáveis por empresa não existirem, vale a antiga. É transitório
  // e declarado: com uma variável só, os dois domínios carregam a mesma chave.
  return porEmpresa || env.VITE_MERCADO_PAGO_PUBLIC_KEY;
}
