// Coffee LiVRE — provedores do checkout (frete, pagamento, CEP).
//
// A tela conversa com INTERFACES, nunca com um fornecedor. Hoje cada interface
// tem uma implementação de demonstração explícita; nas Unidades 9 e 10 entram
// Mercado Pago e transportadoras reais sem reescrever o checkout.
//
//   FreteProvider     cotar(checkout) → opções classificadas pelo roteador
//   PagamentoProvider metodos, iniciar(pedido), e — só no staging — simular()
//   CepProvider       buscar(cep) → endereço parcial ou null (manual hoje)

import { supabase } from '../../../lib/supabase';
import { registrarFalha } from '../observabilidade';
import { classificarOpcoes, type OpcaoClassificada, type OpcaoDeFrete } from './roteadorDeFrete';
import { cepValido, somenteDigitos, type Endereco } from './validacao';

// ---------------------------------------------------------------- frete
export interface FreteProvider {
  readonly nome: string;
  readonly demonstracao: boolean;
  cotar(checkoutId: string): Promise<OpcaoClassificada[]>;
}

/** Tabela fictícia de lv_settings.frete_demo, cotada pelo banco por vendedor. */
export const freteDeDemonstracao: FreteProvider = {
  nome: 'Tabela de demonstração',
  demonstracao: true,
  async cotar(checkoutId) {
    const { data, error } = await supabase.rpc('lv_frete_cotar', { p_checkout: checkoutId });
    if (error) throw new Error(registrarFalha('frete-cotar', error, 'Não foi possível calcular a entrega.'));
    return classificarOpcoes((data as OpcaoDeFrete[]) ?? []);
  },
};

// ---------------------------------------------------------------- pagamento
export type MetodoDePagamento = 'pix' | 'cartao';

export interface MetodoOferecido {
  metodo: MetodoDePagamento;
  rotulo: string;
  descricao: string;
}

export interface PagamentoProvider {
  readonly nome: string;
  readonly demonstracao: boolean;
  metodos(): MetodoOferecido[];
  /** Futuro: cria a cobrança no provedor (preferência, QR Pix). Hoje não cobra nada. */
  iniciar(orderId: string, metodo: MetodoDePagamento): Promise<{ instrucoes: string }>;
  /** Só no staging: o banco recusa em qualquer outro ambiente. */
  simular?(orderId: string, resultado: 'aprovado' | 'recusado', chave: string): Promise<{ statusPedido: string; duplicado: boolean }>;
}

export const pagamentoSimulado: PagamentoProvider = {
  nome: 'Pagamento simulado',
  demonstracao: true,
  metodos: () => [
    { metodo: 'pix', rotulo: 'Pix', descricao: 'Aprovação na hora. Nesta demonstração, simulado.' },
    { metodo: 'cartao', rotulo: 'Cartão de crédito', descricao: 'Nesta demonstração, simulado: nenhum dado de cartão é pedido.' },
  ],
  async iniciar() {
    return { instrucoes: 'Pagamento de demonstração: nenhuma cobrança real é feita.' };
  },
  async simular(orderId, resultado, chave) {
    const { data, error } = await supabase.rpc('lv_pagamento_simular', { p_order: orderId, p_resultado: resultado, p_chave: chave });
    if (error) throw new Error(registrarFalha('pagamento-simular', error, 'Não foi possível simular o pagamento.'));
    const r = data as { status_pedido: string; duplicado: boolean };
    return { statusPedido: r.status_pedido, duplicado: r.duplicado };
  },
};

// ---------------------------------------------------------------- CEP
export interface CepProvider {
  readonly nome: string;
  buscar(cep: string): Promise<Partial<Endereco> | null>;
}

/** Sem serviço externo: confere o formato e deixa a pessoa preencher. */
export const cepManual: CepProvider = {
  nome: 'Preenchimento manual',
  async buscar(cep) {
    return cepValido(cep) ? { cep: somenteDigitos(cep) } : null;
  },
};

export const PROVEDORES = { frete: freteDeDemonstracao, pagamento: pagamentoSimulado, cep: cepManual };
