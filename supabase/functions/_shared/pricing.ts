// Fase 0 / P0 — validação e cálculo de preço SERVER-SIDE (lógica pura, testável).
// O frontend NUNCA é fonte de verdade do preço. Para pedidos 'single', o servidor
// recalcula tudo a partir de products.price. Assinatura tem desconto legítimo por
// tier e é tratada à parte (não recalculada aqui).

export interface CartLineInput { product_id: string; quantity: number; }
export interface ProductInfo { id: string; name: string; price: number; is_active: boolean; }
export interface PricedLine { product_id: string; name: string; quantity: number; unit_price: number; subtotal: number; }
export type PricingResult =
  | { ok: true; lines: PricedLine[]; itemsTotal: number }
  | { ok: false; code: string; error: string };

export const MAX_QTY_PER_LINE = 1000;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Recalcula o pedido a partir dos preços OFICIAIS do banco (productsById).
 * Ignora qualquer preço enviado pelo cliente. Rejeita adulteração/estrutura inválida.
 */
export function priceCheckout(
  items: CartLineInput[],
  productsById: Map<string, ProductInfo>,
  opts?: { maxQty?: number },
): PricingResult {
  const maxQty = opts?.maxQty ?? MAX_QTY_PER_LINE;

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, code: 'EMPTY_CART', error: 'Pedido vazio' };
  }

  const lines: PricedLine[] = [];
  let itemsTotal = 0;

  for (const it of items) {
    if (!it || typeof it.product_id !== 'string' || !it.product_id) {
      return { ok: false, code: 'BAD_ITEM', error: 'Item inválido' };
    }
    const q = it.quantity;
    if (!Number.isInteger(q) || q <= 0) {
      return { ok: false, code: 'BAD_QTY', error: `Quantidade inválida (${it.product_id})` };
    }
    if (q > maxQty) {
      return { ok: false, code: 'QTY_TOO_LARGE', error: `Quantidade acima do máximo permitido (${maxQty})` };
    }
    const p = productsById.get(it.product_id);
    if (!p) {
      return { ok: false, code: 'PRODUCT_NOT_FOUND', error: `Produto inexistente: ${it.product_id}` };
    }
    if (!p.is_active) {
      return { ok: false, code: 'PRODUCT_INACTIVE', error: `Produto inativo: ${p.name}` };
    }
    if (typeof p.price !== 'number' || !(p.price > 0)) {
      return { ok: false, code: 'BAD_PRICE', error: `Preço oficial inválido: ${p.name}` };
    }
    const unit = round2(p.price);
    const subtotal = round2(unit * q);
    lines.push({ product_id: p.id, name: p.name, quantity: q, unit_price: unit, subtotal });
    itemsTotal = round2(itemsTotal + subtotal);
  }

  if (!(itemsTotal > 0)) {
    return { ok: false, code: 'NON_POSITIVE_TOTAL', error: 'Total inválido' };
  }

  return { ok: true, lines, itemsTotal };
}
