import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { podeTransicionar, statusLocal } from './status.ts';
import { aplicarBps, calcularCobranca, taxaRealDoProcessador } from './taxas.ts';
import { assinar, assinaturaValida, manifestos } from './assinatura.ts';
import {
  BloqueioDeAmbiente, conferirAmbiente, conferirLiveMode, conferirProvedor, faltandoParaMercadoPago, lerSegredos,
} from './ambiente.ts';
import { ROTA_CALLBACK, corpoDaTroca, gerarAleatorio, normalizarTokens, redirectUriValida, sha256Base64Url, urlDeAutorizacao } from './oauth.ts';
import { corpoDoPagamentoMp, normalizarPagamentoMp, provedorMock, type ArmazemMock, type PagamentoRemoto } from './provedor.ts';

describe('status da cobrança', () => {
  it('mapeia os status oficiais', () => {
    expect(statusLocal('pending')).toBe('aguardando_pagamento');
    expect(statusLocal('in_process')).toBe('em_analise');
    expect(statusLocal('approved')).toBe('aprovado');
    expect(statusLocal('approved', 'partially_refunded')).toBe('parcialmente_reembolsado');
    expect(statusLocal('cancelled', 'expired')).toBe('expirado');
    expect(statusLocal('charged_back')).toBe('contestado');
    expect(statusLocal('qualquer')).toBeNull();
  });
  it('webhook fora de ordem não rebaixa', () => {
    expect(podeTransicionar('aprovado', 'aguardando_pagamento')).toBe(false);
    expect(podeTransicionar('aguardando_pagamento', 'aprovado')).toBe(true);
    expect(podeTransicionar('aprovado', 'aprovado')).toBe(false);
    expect(podeTransicionar('expirado', 'aprovado')).toBe(true);        // pagamento tardio é registrado
    expect(podeTransicionar('reembolsado', 'aprovado')).toBe(false);
    expect(podeTransicionar('contestado', 'aprovado')).toBe(true);
  });
});

describe('taxas da cobrança', () => {
  it('application_fee = comissão + tarifa + frete; taxa estimada sobre o valor total', () => {
    const v = calcularCobranca({ produtosCents: 4780, freteCents: 1770, comissaoCents: 574, tarifaCents: 100, freteNaApplicationFee: true, processorFeeBps: 99 });
    expect(v.valorCents).toBe(6550);
    expect(v.applicationFeeCents).toBe(574 + 100 + 1770);
    expect(v.processorFeeEstimadaCents).toBe(Math.floor((6550 * 99 + 5000) / 10000));
    expect(v.liquidoSellerEstimadoCents).toBe(6550 - v.processorFeeEstimadaCents! - v.applicationFeeCents);
  });
  it('taxa desconhecida fica nula, nunca zero', () => {
    const v = calcularCobranca({ produtosCents: 1000, freteCents: 0, comissaoCents: 120, tarifaCents: 0, freteNaApplicationFee: true, processorFeeBps: null });
    expect(v.processorFeeEstimadaCents).toBeNull();
    expect(v.liquidoSellerEstimadoCents).toBeNull();
    expect(aplicarBps(1000, null)).toBeNull();
  });
  it('taxa real sai do net_received informado', () => {
    expect(taxaRealDoProcessador(6550, 3999, 2444)).toBe(107);
    expect(taxaRealDoProcessador(6550, null, 2444)).toBeNull();
  });
});

describe('assinatura do webhook', () => {
  it('confere com o HMAC-SHA256 calculado de forma independente', async () => {
    const segredo = 'segredo-de-teste';
    const [m] = manifestos('123456', 'req-1', '1700000000000');
    expect(m).toBe('id:123456;request-id:req-1;ts:1700000000000;');
    const v1 = createHmac('sha256', segredo).update(m).digest('hex');
    expect(await assinaturaValida({ xSignature: `ts=1700000000000,v1=${v1}`, requestId: 'req-1', dataId: '123456', segredo })).toBe(true);
  });
  it('recusa assinatura errada, ausente, sem segredo, ou de outro data.id', async () => {
    const x = await assinar('s', '999', 'r', '1');
    expect(await assinaturaValida({ xSignature: x, requestId: 'r', dataId: '998', segredo: 's' })).toBe(false);
    expect(await assinaturaValida({ xSignature: null, requestId: 'r', dataId: '999', segredo: 's' })).toBe(false);
    expect(await assinaturaValida({ xSignature: x, requestId: 'r', dataId: '999', segredo: '' })).toBe(false);
    expect(await assinaturaValida({ xSignature: x, requestId: 'r', dataId: '999', segredo: 'outro' })).toBe(false);
  });
  it('data.id alfanumérico vai em minúsculas no manifest', () => {
    expect(manifestos('ABC9', 'r', '1')[0]).toBe('id:abc9;request-id:r;ts:1;');
  });
});

describe('guarda de ambiente', () => {
  const env = (n: string) => ({ LV_MP_TESTE_CLIENT_ID: 't-id', LV_MP_PRODUCAO_CLIENT_ID: 'p-id' } as Record<string, string>)[n];
  it('lê só os segredos do próprio ambiente, sem fallback', () => {
    expect(lerSegredos('teste', env).clientId).toBe('t-id');
    expect(lerSegredos('producao', env).clientId).toBe('p-id');
    expect(lerSegredos('teste', n => (n.startsWith('LV_MP_PRODUCAO_') ? 'x' : undefined)).clientId).toBeUndefined();
    expect(faltandoParaMercadoPago(lerSegredos('teste', env))).toContain('CLIENT_SECRET');
  });
  it('função e banco precisam declarar o mesmo ambiente', () => {
    expect(() => conferirAmbiente('producao', 'teste')).toThrow(BloqueioDeAmbiente);
    expect(() => conferirAmbiente('teste', undefined)).toThrow(BloqueioDeAmbiente);
    expect(conferirAmbiente('teste', 'teste')).toBe('teste');
  });
  it('produção rejeita mock e pagamento de teste; teste rejeita pagamento real', () => {
    expect(() => conferirProvedor('mock', 'producao')).toThrow(/mock/);
    expect(() => conferirProvedor('desativado', 'producao')).toThrow(/desativado/);
    expect(() => conferirProvedor('mock', 'teste')).not.toThrow();
    expect(() => conferirLiveMode('producao', false)).toThrow();
    expect(() => conferirLiveMode('teste', true)).toThrow();
    expect(() => conferirLiveMode('teste', false)).not.toThrow();
  });
});

describe('OAuth do vendedor', () => {
  it('monta a URL oficial com PKCE S256 e state', async () => {
    const challenge = await sha256Base64Url('verificador');
    const u = new URL(urlDeAutorizacao({ clientId: '123', redirectUri: 'https://x.test/cb', state: 'st', codeChallenge: challenge }));
    expect(u.origin + u.pathname).toBe('https://auth.mercadopago.com.br/authorization');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ client_id: '123', response_type: 'code', platform_id: 'mp', state: 'st', code_challenge_method: 'S256' });
    expect(corpoDaTroca({ clientId: '1', clientSecret: 's', code: 'c', redirectUri: 'r', verifier: 'v', teste: true }))
      .toMatchObject({ grant_type: 'authorization_code', code_verifier: 'v', test_token: 'true' });
  });
  it('deriva o code_challenge como manda o RFC 7636 (exemplo oficial)', async () => {
    // Vetor do RFC 7636, apêndice B: verifier conhecido → challenge S256 conhecido.
    expect(await sha256Base64Url('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'))
      .toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
  it('gera verifier aleatório dentro do tamanho permitido (43 a 128) e nunca repetido', () => {
    const v = Array.from({ length: 50 }, () => gerarAleatorio(48));
    for (const x of v) {
      expect(x.length).toBeGreaterThanOrEqual(43);
      expect(x.length).toBeLessThanOrEqual(128);
      expect(x).toMatch(/^[A-Za-z0-9\-_]+$/);
    }
    expect(new Set(v).size).toBe(50);
  });
  it('sem verifier não manda code_verifier, e fora do teste não manda test_token', () => {
    const c = corpoDaTroca({ clientId: '1', clientSecret: 's', code: 'c', redirectUri: 'r', verifier: null, teste: false });
    expect(c.code_verifier).toBeUndefined();
    expect(c.test_token).toBeUndefined();
  });
  it('aceita só a Redirect URL canônica da aplicação', () => {
    expect(ROTA_CALLBACK).toBe('/coffeelivre/vendedor/mp/callback');
    expect(redirectUriValida(`https://coficobrasil.com.br${ROTA_CALLBACK}`)).toBe(true);
    expect(redirectUriValida(`http://localhost:5173${ROTA_CALLBACK}`)).toBe(true);
    expect(redirectUriValida('https://coficobrasil.com.br/coffeelivre/vendedor/financeiro')).toBe(false);
    expect(redirectUriValida(`http://coficobrasil.com.br${ROTA_CALLBACK}`)).toBe(false);
    expect(redirectUriValida(`https://coficobrasil.com.br${ROTA_CALLBACK}?x=1`)).toBe(false);
    expect(redirectUriValida(undefined)).toBe(false);
    expect(redirectUriValida('nem-url')).toBe(false);
  });
  it('normaliza tokens e calcula a expiração', () => {
    const t = normalizarTokens({ access_token: 'APP_USR-a', refresh_token: 'TG-r', user_id: 42, public_key: 'APP_USR-pk', expires_in: 15552000, scope: 'offline_access read write', live_mode: false }, 0);
    expect(t).toMatchObject({ mpUserId: '42', escopos: ['offline_access', 'read', 'write'], liveMode: false });
    expect(t.expiraEm).toBe(new Date(15552000 * 1000).toISOString());
    expect(() => normalizarTokens({})).toThrow();
  });
});

describe('provedor Mercado Pago (formato)', () => {
  it('corpo do Pix com application_fee e expiração', () => {
    const c = corpoDoPagamentoMp({
      idempotencyKey: 'k', externalReference: 'lv:1', valorCents: 6550, applicationFeeCents: 2444, descricao: 'Pedido', metodo: 'pix',
      pagador: { email: 'a@b.test', nome: 'Ana Souza' }, expiraEm: '2026-09-15T10:00:00.000-03:00', notificationUrl: 'https://x.test/wh', accessTokenDoVendedor: 't',
    });
    expect(c).toMatchObject({ transaction_amount: 65.5, application_fee: 24.44, payment_method_id: 'pix', external_reference: 'lv:1' });
  });
  it('normaliza a resposta e deriva a taxa real', () => {
    const r = normalizarPagamentoMp({
      id: 777, status: 'approved', status_detail: 'accredited', collector_id: 9, live_mode: false,
      transaction_amount: 65.5, transaction_details: { total_paid_amount: 65.5, net_received_amount: 39.99 },
      fee_details: [{ type: 'application_fee', amount: 24.44 }],
    });
    expect(r).toMatchObject({ id: '777', transaction_amount_cents: 6550, application_fee_cents: 2444, net_received_cents: 3999, processor_fee_cents: 107 });
  });
});

describe('provedor mock', () => {
  function armazem(): ArmazemMock & { dados: Map<string, PagamentoRemoto>; reembolsos: Map<string, string> } {
    const dados = new Map<string, PagamentoRemoto>();
    const reembolsos = new Map<string, string>();
    return {
      dados, reembolsos,
      ler: async id => dados.get(id) ?? null,
      gravar: async p => { dados.set(p.id, p); },
      reembolsoPorChave: async (_id, chave) => (reembolsos.has(chave) ? { refundId: reembolsos.get(chave)!, status: 'approved' } : null),
      registrarReembolso: async (id, chave, refundId, valor) => {
        reembolsos.set(chave, refundId);
        const p = dados.get(id)!;
        const total = p.refunded_cents + valor;
        dados.set(id, { ...p, refunded_cents: total, status: total >= (p.transaction_amount_cents ?? 0) ? 'refunded' : 'approved', status_detail: total >= (p.transaction_amount_cents ?? 0) ? 'refunded' : 'partially_refunded' });
      },
    };
  }
  const base = { externalReference: 'lv:x', valorCents: 1000, applicationFeeCents: 200, descricao: 'd', pagador: { email: 'e@e.test', nome: 'E' }, expiraEm: null, notificationUrl: null, accessTokenDoVendedor: 'mock' };
  it('criação idempotente pela chave', async () => {
    const a = armazem();
    const p = provedorMock(a, () => 99);
    const x = await p.criar({ ...base, idempotencyKey: 'k1', metodo: 'pix' });
    const y = await p.criar({ ...base, idempotencyKey: 'k1', metodo: 'pix' });
    expect(x.id).toBe(y.id);
    expect(a.dados.size).toBe(1);
    expect(x.status).toBe('pending');
    expect(x.pix?.qr_code).toMatch(/^TESTE-SEM-VALOR/);
  });
  it('cartão de teste decide o resultado; taxa real difere da estimada', async () => {
    const p = provedorMock(armazem(), () => 498);
    const ok = await p.criar({ ...base, idempotencyKey: 'c1', metodo: 'cartao', cartao: { token: 'mock_aprovar', paymentMethodId: 'visa', installments: 1 } });
    const nao = await p.criar({ ...base, idempotencyKey: 'c2', metodo: 'cartao', cartao: { token: 'mock_recusar', paymentMethodId: 'visa', installments: 1 } });
    expect(ok.status).toBe('approved');
    expect(ok.processor_fee_cents).toBe(Math.floor((1000 * 498 + 5000) / 10000) + 3);
    expect(nao.status).toBe('rejected');
  });
  it('reembolso com a mesma chave não duplica', async () => {
    const a = armazem();
    const p = provedorMock(a, () => 99);
    const pag = await p.criar({ ...base, idempotencyKey: 'r1', metodo: 'cartao', cartao: { token: 'mock_aprovar', paymentMethodId: 'visa', installments: 1 } });
    const r1 = await p.reembolsar(pag.id, null, 'chave-ref', 'mock');
    const r2 = await p.reembolsar(pag.id, null, 'chave-ref', 'mock');
    expect(r1.refundId).toBe(r2.refundId);
    expect(a.dados.get(pag.id)?.refunded_cents).toBe(1000);
    expect(a.dados.get(pag.id)?.status).toBe('refunded');
  });
});
