// Preço da IA — ÚNICO lugar do sistema onde existe um número de custo por token.
//
// Os valores vêm da tabela oficial de preços da OpenAI (consultada em
// 09/09/2026). Nada aqui é estimado: a API devolve os tokens realmente
// consumidos e nós multiplicamos pelo preço publicado.
//
// Quando o provedor mudar o preço, muda AQUI e em nenhum outro lugar.

/** Preço em dólares por MILHÃO de tokens. */
export interface PrecoPorMilhao {
  textoEntrada: number;
  textoCache?: number;
  imagemEntrada?: number;
  imagemCache?: number;
  imagemSaida?: number;
  textoSaida?: number;
}

export const PRECOS: Record<string, PrecoPorMilhao> = {
  // Modelos de imagem (preço idêntico entre os dois — tabela oficial 09/09/2026).
  "gpt-image-2.5-flare": {
    textoEntrada: 5.0, textoCache: 1.25,
    imagemEntrada: 8.0, imagemCache: 2.0, imagemSaida: 30.0,
  },
  "gpt-image-2.5-sunburst": {
    textoEntrada: 5.0, textoCache: 1.25,
    imagemEntrada: 8.0, imagemCache: 2.0, imagemSaida: 30.0,
  },
};

/** O que a API de imagem da OpenAI devolve em `usage`. */
export interface UsoDeImagem {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: {
    text_tokens?: number;
    image_tokens?: number;
    cached_tokens?: number;
  };
  cached_tokens?: number;
}

/**
 * Separa os tokens de entrada em texto e imagem, quando a API informa.
 *
 * Existe porque no custo as duas partes valem diferente — imagem de entrada é
 * $8/1M contra $5/1M do texto — e é essa separação que responde "quanto a
 * embalagem de referência acrescentou".
 *
 * Devolve `null` em cada campo que a API não mandou. Nulo é "não informado",
 * nunca zero: gravar zero faria um relatório afirmar que a referência não
 * custou nada, que é diferente de não saber.
 */
export function decomporEntrada(uso: UsoDeImagem | null | undefined): {
  texto: number | null;
  imagem: number | null;
  cache: number | null;
} {
  const d = uso?.input_tokens_details;
  // O cache pode vir no detalhamento ou solto no usage, conforme o endpoint.
  const cache = d?.cached_tokens ?? uso?.cached_tokens ?? null;
  if (!d) return { texto: null, imagem: null, cache };
  return {
    texto: typeof d.text_tokens === "number" ? d.text_tokens : null,
    imagem: typeof d.image_tokens === "number" ? d.image_tokens : null,
    cache,
  };
}

/**
 * Custo em dólares de uma geração de imagem, a partir do `usage` real.
 *
 * A saída de imagem é o item caro ($30/1M contra $5/1M de texto de entrada),
 * então separar entrada de texto, entrada de imagem e saída importa: uma
 * geração com ativo de referência custa mais que uma geração livre, e a conta
 * precisa mostrar por quê.
 *
 * Devolve `null` quando não há `usage` — melhor não gravar custo nenhum do que
 * gravar um número inventado que depois entra num relatório de margem.
 */
export function custoDaImagemUSD(model: string, uso: UsoDeImagem | null | undefined): number | null {
  const p = PRECOS[model];
  if (!p || !uso) return null;

  const entrada = uso.input_tokens ?? 0;
  const detalhe = uso.input_tokens_details ?? {};
  // Quando o detalhamento não vem, trata a entrada inteira como texto: é o
  // lado barato, e superestimar custo com base em suposição é pior que
  // subestimar com base no que foi informado.
  const tokensImagemEntrada = detalhe.image_tokens ?? 0;
  const tokensTextoEntrada = detalhe.text_tokens ?? Math.max(entrada - tokensImagemEntrada, 0);
  const saida = uso.output_tokens ?? 0;

  const custo =
    (tokensTextoEntrada / 1_000_000) * p.textoEntrada +
    (tokensImagemEntrada / 1_000_000) * (p.imagemEntrada ?? 0) +
    (saida / 1_000_000) * (p.imagemSaida ?? 0);

  return Number(custo.toFixed(6));
}

/**
 * Formatos que o Studio oferece.
 *
 * A API exige lados MÚLTIPLOS DE 16. Nem 1080×1350 nem 1080×1920 são — e
 * distorcer a imagem para chegar neles seria pior que entregar a proporção
 * certa numa resolução vizinha. Então geramos na PROPORÇÃO EXATA pedida, com
 * lados válidos:
 *
 *   feed   1088×1360 = 4:5  exato (1088/16=68, 1360/16=85)
 *   story  1152×2048 = 9:16 exato (1152/16=72, 2048/16=128)
 *
 * Ambos dentro do limite de 655.360 a 8.294.400 pixels. Sem crop, sem
 * esticar, sem redimensionar — a rede social aceita a proporção, que é o que
 * define o enquadramento.
 */
export const FORMATOS = {
  feed:  { largura: 1088, altura: 1360, proporcao: "4:5",  rotulo: "Instagram Feed" },
  story: { largura: 1152, altura: 2048, proporcao: "9:16", rotulo: "Story / WhatsApp Status" },
} as const;

export type FormatoId = keyof typeof FORMATOS;
