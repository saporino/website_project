import { describe, it, expect } from 'vitest';
import { mapMpStatus, decideOrderUpdate, buildManifest, manifestVariants, mapPaymentMethod, mapOrderStage } from './mpWebhook.ts';

describe('mapMpStatus', () => {
  it('mapeia os status do Mercado Pago', () => {
    expect(mapMpStatus('approved')).toBe('approved');
    expect(mapMpStatus('rejected')).toBe('rejected');
    expect(mapMpStatus('cancelled')).toBe('rejected');
    expect(mapMpStatus('in_process')).toBe('in_process');
    expect(mapMpStatus('in_mediation')).toBe('in_process');
    expect(mapMpStatus('refunded')).toBe('refunded');
    expect(mapMpStatus('charged_back')).toBe('refunded');
    expect(mapMpStatus('qualquer_outro')).toBe('pending');
  });
});

describe('decideOrderUpdate — idempotência / no-regression', () => {
  it('pending → approved: aplica e marca paid_at', () => {
    const d = decideOrderUpdate({ status: 'pending', paid_at: null }, 'approved');
    expect(d).toEqual({ apply: true, setPaidAt: true, reason: 'ok' });
  });

  it('approved → pending (webhook atrasado): NÃO rebaixa', () => {
    const d = decideOrderUpdate({ status: 'approved', paid_at: '2026-08-27T10:00:00Z' }, 'pending');
    expect(d.apply).toBe(false);
    expect(d.reason).toBe('no-regression');
  });

  it('approved → in_process: NÃO rebaixa', () => {
    expect(decideOrderUpdate({ status: 'approved', paid_at: 'x' }, 'in_process').apply).toBe(false);
  });

  it('approved → approved (duplicado): aplica mas NÃO reescreve paid_at', () => {
    const d = decideOrderUpdate({ status: 'approved', paid_at: '2026-08-27T10:00:00Z' }, 'approved');
    expect(d.apply).toBe(true);
    expect(d.setPaidAt).toBe(false);
  });

  it('approved → refunded: aplica (estado pós-aprovação legítimo)', () => {
    expect(decideOrderUpdate({ status: 'approved', paid_at: 'x' }, 'refunded').apply).toBe(true);
  });
});

describe('buildManifest', () => {
  it('monta o manifest no formato do MP', () => {
    expect(buildManifest('123', 'req-9', '1700000000'))
      .toBe('id:123;request-id:req-9;ts:1700000000');
  });
});

describe('manifestVariants', () => {
  it('aceita as duas grafias do manifest do Mercado Pago', () => {
    const v = manifestVariants('123', 'req-9', '1700000000');
    expect(v).toEqual([
      'id:123;request-id:req-9;ts:1700000000',
      'id:123;request-id:req-9;ts:1700000000;',
    ]);
  });
});

describe('mapPaymentMethod', () => {
  it('traduz a familia do Mercado Pago para o vocabulario do banco', () => {
    expect(mapPaymentMethod('credit_card', 'master')).toBe('credit_card');
    expect(mapPaymentMethod('credit_card', 'visa')).toBe('credit_card');
    expect(mapPaymentMethod('debit_card', 'debelo')).toBe('debit_card');
    expect(mapPaymentMethod('prepaid_card', 'elo')).toBe('debit_card');
    expect(mapPaymentMethod('ticket', 'bolbradesco')).toBe('boleto');
    expect(mapPaymentMethod('bank_transfer', 'pix')).toBe('pix');
    expect(mapPaymentMethod('account_money', 'account_money')).toBe('other');
    expect(mapPaymentMethod(null, null)).toBe('other');
  });
});

describe('mapOrderStage', () => {
  it('leva o pedido pago para a etapa que o painel mostra como Pago', () => {
    expect(mapOrderStage('approved')).toBe('payment_approved');
    expect(mapOrderStage('refunded')).toBe('cancelled');
    expect(mapOrderStage('pending')).toBe('payment_pending');
    expect(mapOrderStage('rejected')).toBe('payment_pending');
    expect(mapOrderStage('in_process')).toBe('payment_pending');
  });
});
