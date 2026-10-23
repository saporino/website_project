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

/* ──────────────────────────────────────────────────────────────────────────
 * PREÇO POR CANAL — o que o checkout faz quando o canal não tem preço.
 *
 * A resolução por canal mora no banco (`preco_do_canal`), e a bancada
 * `auditoria-precos-por-canal.mjs` a exercita contra o Postgres de verdade.
 * O que se prova AQUI é o elo seguinte: traduzido para `ProductInfo`, um canal
 * sem preço tem de IMPEDIR a venda — nunca cobrar um valor adivinhado.
 * ────────────────────────────────────────────────────────────────────────── */
describe('preço por canal — sem preço no canal, não vende', () => {
  it('recusa a linha quando o canal não definiu preço (price 0)', () => {
    const semPreco: ProductInfo = { id: 'c', name: 'Café sem preço na COFICO', price: 0, is_active: true };
    const r = priceCheckout([{ product_id: 'c', quantity: 1 }], products(semPreco));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('BAD_PRICE');
  });

  it('recusa o pedido inteiro se UM item está sem preço no canal', () => {
    const semPreco: ProductInfo = { id: 'c', name: 'Café sem preço', price: 0, is_active: true };
    const r = priceCheckout(
      [{ product_id: 'a', quantity: 2 }, { product_id: 'c', quantity: 1 }],
      products(A, semPreco));
    // Parcial seria pior: o cliente pagaria por um carrinho que não é o dele.
    expect(r.ok).toBe(false);
  });

  it('cobra o preço do canal quando ele existe, não o do produto', () => {
    // O café custa 35 na loja (A). Na COFICO, 29,90.
    const naCofico: ProductInfo = { ...A, price: 29.9 };
    const r = priceCheckout([{ product_id: 'a', quantity: 2 }], products(naCofico));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines[0].unit_price).toBe(29.9);
      expect(r.itemsTotal).toBe(59.8);
    }
  });
});
