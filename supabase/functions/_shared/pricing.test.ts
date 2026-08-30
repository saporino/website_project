import { describe, it, expect } from 'vitest';
import { priceCheckout, type ProductInfo } from './pricing.ts';

function products(...ps: ProductInfo[]) {
  const m = new Map<string, ProductInfo>();
  for (const p of ps) m.set(p.id, p);
  return m;
}
const A: ProductInfo = { id: 'a', name: 'Café A 500g', price: 35, is_active: true };
const B: ProductInfo = { id: 'b', name: 'Café B 500g', price: 42.5, is_active: true };

describe('priceCheckout — servidor é a fonte de verdade do preço', () => {
  it('usa o preço oficial do banco (browser não envia preço)', () => {
    const r = priceCheckout([{ product_id: 'a', quantity: 2 }], products(A));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines[0].unit_price).toBe(35);
      expect(r.lines[0].subtotal).toBe(70);
      expect(r.itemsTotal).toBe(70);
    }
  });

  it('preço adulterado é irrelevante: a função só aceita product_id+quantity', () => {
    // Mesmo que o payload malicioso tivesse unit_price=1, ele não é parâmetro:
    const r = priceCheckout([{ product_id: 'a', quantity: 1 } as any], products(A));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.itemsTotal).toBe(35); // nunca 1
  });

  it('soma múltiplas linhas', () => {
    const r = priceCheckout([{ product_id: 'a', quantity: 1 }, { product_id: 'b', quantity: 2 }], products(A, B));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.itemsTotal).toBe(35 + 85);
  });

  it('rejeita produto inexistente', () => {
    const r = priceCheckout([{ product_id: 'x', quantity: 1 }], products(A));
    expect(r).toMatchObject({ ok: false, code: 'PRODUCT_NOT_FOUND' });
  });

  it('rejeita produto inativo', () => {
    const r = priceCheckout([{ product_id: 'a', quantity: 1 }], products({ ...A, is_active: false }));
    expect(r).toMatchObject({ ok: false, code: 'PRODUCT_INACTIVE' });
  });

  it('rejeita quantidade inválida (0, negativa, não-inteira)', () => {
    expect(priceCheckout([{ product_id: 'a', quantity: 0 }], products(A))).toMatchObject({ ok: false, code: 'BAD_QTY' });
    expect(priceCheckout([{ product_id: 'a', quantity: -3 }], products(A))).toMatchObject({ ok: false, code: 'BAD_QTY' });
    expect(priceCheckout([{ product_id: 'a', quantity: 1.5 }], products(A))).toMatchObject({ ok: false, code: 'BAD_QTY' });
  });

  it('rejeita quantidade absurda', () => {
    const r = priceCheckout([{ product_id: 'a', quantity: 999999 }], products(A));
    expect(r).toMatchObject({ ok: false, code: 'QTY_TOO_LARGE' });
  });

  it('rejeita pedido vazio', () => {
    expect(priceCheckout([], products(A))).toMatchObject({ ok: false, code: 'EMPTY_CART' });
  });

  it('rejeita preço oficial inválido (<= 0)', () => {
    const r = priceCheckout([{ product_id: 'a', quantity: 1 }], products({ ...A, price: 0 }));
    expect(r).toMatchObject({ ok: false, code: 'BAD_PRICE' });
  });
});
