// Coffee LiVRE — guarda de ambiente do Mercado Pago.
//
// O AMBIENTE vem do banco (ambiente_do_banco → lv_pagamentos_config): staging = "teste",
// produção = "producao". A Edge Function precisa DECLARAR o mesmo ambiente em
// LV_MP_AMBIENTE; se divergir, nada roda.
//
// Os segredos são lidos SÓ do prefixo do ambiente (LV_MP_TESTE_* ou LV_MP_PRODUCAO_*).
// Não há fallback: faltou segredo do ambiente certo = integração bloqueada.
//
// Documentação oficial (14/09/2026): o access token de teste também começa com
// APP_USR, então o prefixo do token NÃO distingue ambientes. A distinção é feita
// pelo nome do segredo, pela marca do banco e pelo `live_mode` que o Mercado Pago
// devolve em cada pagamento e credencial.

export type Ambiente = 'teste' | 'producao';
export type Provedor = 'mock' | 'mercadopago' | 'desativado';

export interface SegredosMp {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  webhookSecret?: string;
  webhookUrl?: string;
  publicKey?: string;
}

export class BloqueioDeAmbiente extends Error {
  constructor(msg: string, readonly codigo: string) { super(msg); }
}

export function prefixoDoAmbiente(a: Ambiente): string {
  return a === 'teste' ? 'LV_MP_TESTE_' : 'LV_MP_PRODUCAO_';
}

/** Lê só os segredos do ambiente pedido. `env` é injetado para ser testável. */
export function lerSegredos(ambiente: Ambiente, env: (nome: string) => string | undefined): SegredosMp {
  const p = prefixoDoAmbiente(ambiente);
  return {
    clientId: env(p + 'CLIENT_ID'),
    clientSecret: env(p + 'CLIENT_SECRET'),
    redirectUri: env(p + 'REDIRECT_URI'),
    webhookSecret: env(p + 'WEBHOOK_SECRET'),
    webhookUrl: env(p + 'WEBHOOK_URL'),
    publicKey: env(p + 'PUBLIC_KEY'),
  };
}

/** A função declara um ambiente; o banco diz qual é. Precisam bater. */
export function conferirAmbiente(doBanco: Ambiente, declarado: string | undefined): Ambiente {
  if (declarado !== 'teste' && declarado !== 'producao') {
    throw new BloqueioDeAmbiente('LV_MP_AMBIENTE não configurado nesta função.', 'AMBIENTE_NAO_DECLARADO');
  }
  if (declarado !== doBanco) {
    throw new BloqueioDeAmbiente(`Função declarada como ${declarado}, banco é ${doBanco}.`, 'AMBIENTE_DIVERGENTE');
  }
  return doBanco;
}

export function conferirProvedor(provedor: Provedor, ambiente: Ambiente): void {
  if (provedor === 'desativado') {
    throw new BloqueioDeAmbiente('Pagamento online desativado neste ambiente.', 'PAGAMENTO_DESATIVADO');
  }
  if (provedor === 'mock' && ambiente !== 'teste') {
    throw new BloqueioDeAmbiente('Provedor mock não existe em produção.', 'MOCK_EM_PRODUCAO');
  }
}

/** live_mode devolvido pelo Mercado Pago precisa bater com o ambiente. */
export function conferirLiveMode(ambiente: Ambiente, liveMode: boolean | null | undefined): void {
  if (liveMode == null) return;
  if (ambiente === 'teste' && liveMode) throw new BloqueioDeAmbiente('Pagamento REAL recebido no ambiente de teste.', 'LIVE_MODE_EM_TESTE');
  if (ambiente === 'producao' && !liveMode) throw new BloqueioDeAmbiente('Pagamento de teste recebido em produção.', 'TESTE_EM_PRODUCAO');
}

/** O que falta para o Mercado Pago real funcionar neste ambiente (sem revelar valores). */
export function faltandoParaMercadoPago(s: SegredosMp): string[] {
  const falta: string[] = [];
  if (!s.clientId) falta.push('CLIENT_ID');
  if (!s.clientSecret) falta.push('CLIENT_SECRET');
  if (!s.redirectUri) falta.push('REDIRECT_URI');
  if (!s.webhookSecret) falta.push('WEBHOOK_SECRET');
  if (!s.webhookUrl) falta.push('WEBHOOK_URL');
  if (!s.publicKey) falta.push('PUBLIC_KEY');
  return falta;
}
