/**
 * Traduz a recusa de uma API de IA em instrução, em português.
 *
 * Por que existe (09/10/2026): dez peças do Studio falharam de uma vez e a tela mostrou,
 * em cada uma, o JSON cru da Anthropic — um parágrafo em inglês começando com
 * `{"type":"error","error":{...}}`. O problema nem era do sistema: a conta estava sem
 * crédito. Quem lê um erro precisa saber O QUE FAZER; a forma do erro é detalhe nosso.
 *
 * Mesma lição do token vencido do Instagram: erro de serviço externo nunca vai cru para a
 * tela. Serve para Anthropic e OpenAI, que respondem com os mesmos códigos.
 */
export function explicarErroDaIA(status: number, corpo: string, servico = 'a IA'): string {
  const texto = String(corpo ?? '').toLowerCase();

  if (texto.includes('credit balance is too low') || texto.includes('insufficient_quota') || texto.includes('insufficient funds'))
    return `A conta ${servico === 'a IA' ? 'da IA' : `da ${servico}`} está sem créditos — por isso não rodou. ` +
           'Compre créditos no painel do provedor e clique em Reprocessar.';

  if (status === 401 || status === 403 || texto.includes('invalid x-api-key') || texto.includes('authentication') || texto.includes('invalid_api_key'))
    return 'A chave de acesso foi recusada (inválida ou revogada). Gere outra no painel do provedor e atualize o segredo do projeto.';

  if (status === 429 || texto.includes('rate_limit'))
    return 'Muitos pedidos ao mesmo tempo: o provedor limitou o ritmo. Espere alguns minutos e tente de novo.';

  if (status === 529 || texto.includes('overloaded'))
    return 'O provedor está sobrecarregado neste momento. Tente de novo daqui a pouco.';

  if (status >= 500)
    return `O provedor respondeu com erro (${status}). Não é problema do seu arquivo: tente de novo.`;

  // Sem tradução conhecida, devolve o começo da mensagem — melhor pouco do que nada.
  return `Falhou: ${String(corpo ?? '').slice(0, 180)}`;
}
