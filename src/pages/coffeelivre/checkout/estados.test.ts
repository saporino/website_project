import { describe, expect, it } from 'vitest';
import {
  derivarStatusDoPedido, proximoPassoDoVendedor, transicaoDoPagamentoValida,
  transicaoDoPedidoValida, transicaoDoSubpedidoValida,
} from './estados';

describe('transições', () => {
  it('pedido segue o caminho normal', () => {
    expect(transicaoDoPedidoValida('aguardando_pagamento', 'pago')).toBe(true);
    expect(transicaoDoPedidoValida('pago', 'em_processamento')).toBe(true);
    expect(transicaoDoPedidoValida('enviado', 'entregue')).toBe(true);
  });
  it('transições absurdas são recusadas', () => {
    expect(transicaoDoPedidoValida('entregue', 'aguardando_pagamento')).toBe(false);
    expect(transicaoDoPedidoValida('cancelado', 'pago')).toBe(false);
    expect(transicaoDoPedidoValida('aguardando_pagamento', 'enviado')).toBe(false);
    expect(transicaoDoSubpedidoValida('entregue', 'separacao')).toBe(false);
    expect(transicaoDoSubpedidoValida('confirmado', 'enviado')).toBe(false);
    expect(transicaoDoSubpedidoValida('enviado', 'cancelado')).toBe(false);
    expect(transicaoDoPagamentoValida('reembolsado', 'aprovado')).toBe(false);
  });
  it('vendedor avança um passo por vez e não cancela', () => {
    expect(proximoPassoDoVendedor('confirmado')).toBe('separacao');
    expect(proximoPassoDoVendedor('separacao')).toBe('pronto_para_envio');
    expect(proximoPassoDoVendedor('pronto_para_envio')).toBe('enviado');
    expect(proximoPassoDoVendedor('enviado')).toBe('entregue');
    expect(proximoPassoDoVendedor('entregue')).toBeNull();
    expect(proximoPassoDoVendedor('aguardando_pagamento')).toBeNull();
    expect(proximoPassoDoVendedor('cancelado')).toBeNull();
  });
});

describe('derivarStatusDoPedido', () => {
  it('multiloja: um enviado e outro em separação é parcialmente enviado', () => {
    expect(derivarStatusDoPedido('em_processamento', ['enviado', 'separacao'])).toBe('parcialmente_enviado');
  });
  it('todos entregues é entregue; cancelado não conta', () => {
    expect(derivarStatusDoPedido('enviado', ['entregue', 'entregue'])).toBe('entregue');
    expect(derivarStatusDoPedido('enviado', ['entregue', 'cancelado'])).toBe('entregue');
  });
  it('nenhum andou: mantém; todos cancelados: cancelado', () => {
    expect(derivarStatusDoPedido('pago', ['confirmado', 'confirmado'])).toBe('pago');
    expect(derivarStatusDoPedido('pago', ['cancelado'])).toBe('cancelado');
  });
  it('separação em qualquer um: em processamento', () => {
    expect(derivarStatusDoPedido('pago', ['confirmado', 'separacao'])).toBe('em_processamento');
  });
});
