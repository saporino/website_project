// Diretor Criativo IA — a camada que faz o cliente não precisar escrever prompt.
//
// A pessoa diz "quero divulgar meu café gourmet". Isso vira um briefing
// estruturado e um prompt profissional. O prompt técnico nunca aparece na
// tela: fica gravado para auditoria, custo e comparação.
//
// A regra do arquivo inteiro: SE UMA REGRA PODE SER GARANTIDA POR SOFTWARE,
// ELA NÃO VAI PARA O PROMPT. O formato é escolhido pelo sistema; o ativo é
// conferido antes; o preço só entra se estiver aprovado. Frase em prompt é
// pedido; código é garantia.

export const MODELO_DIRETOR = "claude-sonnet-5";
export const DIRETOR_VERSION = "diretor-v1";

/** Tipos de conteúdo que o cliente escolhe por atalho. */
export const TIPOS = {
  bom_dia:       { rotulo: "Bom dia",                 objetivo: "saudação da manhã, presença de marca" },
  boa_tarde:     { rotulo: "Boa tarde",               objetivo: "saudação da tarde, presença de marca" },
  produto:       { rotulo: "Divulgar produto",        objetivo: "apresentar um produto e dar vontade de provar" },
  oferta:        { rotulo: "Oferta",                  objetivo: "comunicar uma condição comercial" },
  institucional: { rotulo: "Post institucional",      objetivo: "reforçar quem a marca é" },
  educativo:     { rotulo: "Conteúdo educativo",      objetivo: "ensinar algo útil sobre café" },
  representante: { rotulo: "Para representante",      objetivo: "material de apoio comercial" },
  livre:         { rotulo: "A partir de uma ideia",   objetivo: "o que a pessoa descrever" },
} as const;

export type TipoId = keyof typeof TIPOS;

/**
 * REGRAS DURAS — leis do sistema, não sugestão ao modelo.
 *
 * Ficam separadas do DNA da marca de propósito: o DNA muda por cliente, estas
 * não mudam nunca. São o mínimo que protege a marca de quem a IA não conhece.
 */
const REGRAS_DURAS = `NUNCA invente preço, desconto, cupom, prazo, brinde, frete grátis, edição limitada ou qualquer condição comercial que não tenha sido informada.
NUNCA invente prêmio, certificação, nota de qualidade, origem, altitude, safra ou processo.
NUNCA escreva texto legível dentro da imagem: nada de headline, preço ou selo desenhado — texto entra depois, por quem publica.
NUNCA desenhe logotipo, marca ou rótulo identificável que não venha de um ativo oficial anexado.`;

/** REGRAS DO CANAL — só as do canal pedido entram. */
const REGRAS_CANAL: Record<string, string> = {
  feed: `Instagram Feed, 4:5 vertical. Composição centrada, respiro em cima e embaixo para texto aplicado depois. Leitura clara em miniatura.`,
  story: `Story / WhatsApp Status, 9:16 vertical. O olhar cai no terço central: mantenha o essencial ali. Bordas superior e inferior livres para interface do aplicativo.`,
};

/** Regras que só ligam quando o caso pede. */
const REGRAS_CONDICIONAIS = {
  ativoOficial: `HÁ UM ATIVO OFICIAL ANEXADO. Ele é o produto real da marca. Mantenha embalagem, cores, textos e logotipo fiéis à referência. NÃO redesenhe o rótulo, NÃO reescreva palavras, NÃO altere o peso indicado, NÃO crie variação "parecida". Crie livremente cenário, luz, superfície e elementos ao redor.`,
  semAtivo: `NÃO há ativo oficial. Não desenhe pacote, rótulo ou logotipo identificável. Se a cena pedir um produto, mostre-o desfocado, cortado ou de costas.`,
  oferta: `É uma peça de OFERTA, mas o preço NÃO vai na imagem — vai na legenda, escrita por quem publica. A imagem deve criar desejo e dar espaço visual para a condição comercial ser aplicada depois.`,
};

/** O que o Diretor deve devolver. Estruturado para poder ser auditado depois. */
export const ESQUEMA_BRIEFING = `{
  "objetivo": "",
  "tipo_conteudo": "",
  "canal": "",
  "produto": "",
  "publico": "",
  "conceito": "",
  "direcao_visual": "",
  "cena": "",
  "luz": "",
  "composicao": "",
  "tom": "",
  "politica_de_texto": "",
  "ativo_protegido": "",
  "fatos_permitidos": [],
  "mudancas_proibidas": [],
  "prompt_imagem": ""
}`;

export interface ContextoDoBriefing {
  intencao: string;
  tipo: TipoId;
  canal: "feed" | "story";
  marca: string;
  dna: unknown;
  temAtivoOficial: boolean;
}

/**
 * Monta o system prompt do Diretor.
 *
 * O DNA entra inteiro porque é o que diferencia uma marca da outra — mas as
 * regras condicionais entram POR SELEÇÃO: mandar regra de oferta numa peça de
 * bom dia gasta token e confunde o modelo.
 */
export function systemDoDiretor(ctx: ContextoDoBriefing): string {
  const tipo = TIPOS[ctx.tipo] ?? TIPOS.livre;

  const condicionais = [
    ctx.temAtivoOficial ? REGRAS_CONDICIONAIS.ativoOficial : REGRAS_CONDICIONAIS.semAtivo,
    ctx.tipo === "oferta" ? REGRAS_CONDICIONAIS.oferta : "",
  ].filter(Boolean).join("\n");

  const dnaTexto = ctx.dna && Object.keys(ctx.dna as object).length
    ? JSON.stringify(ctx.dna).slice(0, 3500)
    : "(esta marca ainda não cadastrou identidade — seja conservador e institucional, sem afirmar nada específico sobre ela)";

  return `Você é DIRETOR CRIATIVO de uma agência especializada em marcas de café. Recebe pedidos em linguagem comum de donos de torrefação e cafeteria — gente que entende de café e não de publicidade — e transforma em direção criativa profissional.

Quem pede NÃO sabe descrever imagem. "Faça um bom dia" é um pedido completo: cabe a você decidir a cena, a luz e o enquadramento.

OBJETIVO DESTA PEÇA: ${tipo.objetivo}

MARCA: ${ctx.marca}
IDENTIDADE DA MARCA (obedeça; não invente nada fora disto):
${dnaTexto}

REGRAS INEGOCIÁVEIS:
${REGRAS_DURAS}

CANAL:
${REGRAS_CANAL[ctx.canal] ?? REGRAS_CANAL.feed}

${condicionais}

COMO TRABALHAR:
1. Entenda a intenção por trás do pedido, não só as palavras.
2. Escolha UM conceito visual — um só, executado bem, em vez de três ideias amontoadas.
3. Descreva cena, luz e composição como um diretor de fotografia descreveria a um fotógrafo.
4. Escreva o prompt final em INGLÊS, que é a língua em que o gerador de imagem responde melhor, com vocabulário de fotografia publicitária real: lente, luz, superfície, profundidade.
5. Fuja de estética de banco de imagens, de aparência de render 3D e de café genérico de propaganda antiga.

Responda SOMENTE um JSON com ESTA estrutura, sem markdown e sem texto em volta:
${ESQUEMA_BRIEFING}

"prompt_imagem" é o que vai para o gerador — completo, autossuficiente, em inglês.
"fatos_permitidos" lista o que pode ser afirmado sobre a marca, tirado da identidade acima.
"mudancas_proibidas" lista o que não pode ser alterado (relevante quando há ativo oficial).`;
}

/** Preço do Claude Sonnet 5, tabela oficial consultada em 10/09/2026. */
export const PRECO_DIRETOR = {
  entrada: 2.0,        // USD por 1M tokens
  saida: 10.0,
  cacheLeitura: 0.20,
};

/** Custo em dólares de uma chamada do Diretor, a partir do usage real. */
export function custoDoDiretorUSD(uso: { input_tokens?: number; output_tokens?: number } | null | undefined): number | null {
  if (!uso) return null;
  const custo =
    ((uso.input_tokens ?? 0) / 1_000_000) * PRECO_DIRETOR.entrada +
    ((uso.output_tokens ?? 0) / 1_000_000) * PRECO_DIRETOR.saida;
  return Number(custo.toFixed(6));
}
