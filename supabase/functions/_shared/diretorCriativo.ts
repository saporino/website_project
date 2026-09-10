// Diretor Criativo IA — de gerador de FOTO para gerador de POSTAGEM.
//
// A primeira versão deste arquivo mandava "fotografia publicitária" e proibia
// texto na imagem. Fazia sentido para o Studio interno de análise, e é
// exatamente por isso que a saída tinha cara de foto e não de post: o viés
// estava escrito aqui, não era acidente do modelo.
//
// Marca de café não precisa de foto bonita todo dia. Precisa de peça pronta
// para postar. As duas coisas se parecem e não são a mesma: uma foto de
// xícara é bonita; um "bom dia" com hierarquia visual e uma frase é ÚTIL.
//
// A regra estrutural do arquivo continua a mesma: SE UMA REGRA PODE SER
// GARANTIDA POR SOFTWARE, ELA NÃO VAI PARA O PROMPT.

export const MODELO_DIRETOR = "claude-sonnet-5";
export const DIRETOR_VERSION = "diretor-v2-post";

// ---------------------------------------------------------------------
// Modo de saída — a decisão que faltava
// ---------------------------------------------------------------------
export const MODOS = {
  photo_first: "Peça fotográfica e editorial. Realismo acima de layout. Texto mínimo ou nenhum.",
  post_first:  "Peça de social media design. Estrutura visual clara, headline em destaque, hierarquia, blocos e respiro. A imagem serve à mensagem.",
  hybrid:      "Fotografia forte COM linguagem de post: foto real como base, headline integrada à composição e área de respiro planejada.",
} as const;
export type ModoSaida = keyof typeof MODOS;

// ---------------------------------------------------------------------
// Famílias de layout — o repertório que o sistema não tinha
// ---------------------------------------------------------------------
// Sem isto, o modelo repetia a mesma composição para pedidos diferentes:
// mesa, xícara, fundo desfocado, embalagem no centro. Variar cenário não
// resolve — o que precisa variar é a ESTRUTURA.
export const LAYOUTS: Record<string, string> = {
  hero_centrado:      "Assunto centralizado e dominante, fundo limpo, headline acima ou abaixo com bastante respiro.",
  dividido:           "Composição em dois campos: de um lado o produto ou a cena, do outro um campo sólido de cor da marca para a mensagem.",
  editorial_minimo:   "Muito espaço negativo, elemento pequeno e bem posicionado, tipografia discreta. Silêncio visual.",
  cartaz:             "Peso gráfico alto, mensagem grande, produto como apoio. Leitura a metros de distância.",
  cartao_social:      "Bloco arredondado ou faixa sobre a imagem, mensagem curta dentro, aparência de card contemporâneo.",
  cartao_de_oferta:   "Destaque forte para a condição comercial, produto visível, área reservada para valor e chamada.",
  aviso_institucional:"Sóbrio e claro, hierarquia de comunicado, marca presente sem gritar.",
  bom_dia_card:       "Luz da manhã, mensagem curta e calorosa integrada à composição, leitura imediata.",
  ambiente_cafeteria: "Cena de balcão, vitrine ou salão, vida real, mensagem discreta em canto respirado.",
  balcao_padaria:     "Contexto de padaria e ponto de venda, pão e café juntos, apelo popular e direto.",
  produto_premium:    "Fundo escuro ou texturizado, luz direcional, produto valorizado, tipografia sóbria.",
  produto_popular:    "Cores vivas, energia, leitura rápida, apelo comercial sem sofisticação excessiva.",
  vertical_story:     "Composição vertical com o essencial no terço central, respiro em cima e embaixo para a interface do aplicativo.",
};

// ---------------------------------------------------------------------
// Onde o texto vive na peça
// ---------------------------------------------------------------------
export const ZONAS_DE_TEXTO: Record<string, string> = {
  topo:            "Faixa superior reservada para a mensagem, imagem abaixo.",
  base:            "Mensagem na parte inferior, imagem ocupando o alto.",
  lateral:         "Campo lateral sólido com o texto, imagem na outra metade.",
  sobreposto:      "Texto sobre a imagem, em área naturalmente vazia e de baixo contraste.",
  bloco_solido:    "Bloco de cor da marca contendo o texto, recortado sobre a composição.",
  sem_texto:       "Sem texto na arte. A mensagem vai na legenda.",
};

/** Tipos de conteúdo e o modo que cada um pede por padrão. */
export const TIPOS = {
  bom_dia:       { rotulo: "Bom dia",              objetivo: "saudação da manhã que a pessoa queira repostar", modo: "hybrid" as ModoSaida },
  boa_tarde:     { rotulo: "Boa tarde",            objetivo: "saudação da tarde, pausa para o café",           modo: "hybrid" as ModoSaida },
  produto:       { rotulo: "Divulgar produto",     objetivo: "apresentar o produto e dar vontade de provar",   modo: "hybrid" as ModoSaida },
  oferta:        { rotulo: "Oferta",               objetivo: "comunicar uma condição comercial com clareza",   modo: "post_first" as ModoSaida },
  institucional: { rotulo: "Post institucional",   objetivo: "reforçar quem a marca é",                        modo: "post_first" as ModoSaida },
  comunicado:    { rotulo: "Comunicado",           objetivo: "avisar algo de forma clara e sóbria",            modo: "post_first" as ModoSaida },
  educativo:     { rotulo: "Conteúdo educativo",   objetivo: "ensinar algo útil sobre café",                   modo: "post_first" as ModoSaida },
  representante: { rotulo: "Para representante",   objetivo: "apoio comercial para quem vende",                modo: "post_first" as ModoSaida },
  ponto_de_venda:{ rotulo: "Padaria / ponto de venda", objetivo: "mostrar o café onde ele é consumido",        modo: "hybrid" as ModoSaida },
  lifestyle:     { rotulo: "Lifestyle",            objetivo: "clima e momento, sem discurso",                  modo: "photo_first" as ModoSaida },
  livre:         { rotulo: "A partir de uma ideia",objetivo: "o que a pessoa descrever",                       modo: "hybrid" as ModoSaida },
} as const;
export type TipoId = keyof typeof TIPOS;

// ---------------------------------------------------------------------
// Regras duras — leis, não sugestão
// ---------------------------------------------------------------------
const REGRAS_DURAS = `NUNCA invente preço, desconto, cupom, prazo, brinde, frete grátis ou qualquer condição comercial que não tenha sido informada.
NUNCA invente prêmio, certificação, nota de qualidade, origem, altitude, safra ou processo.
NUNCA desenhe logotipo, marca ou rótulo identificável que não venha de um ativo oficial anexado.`;

// Texto na arte deixou de ser proibido — mas ganhou disciplina própria, porque
// gerador de imagem erra letra, e erra mais em português.
const REGRAS_DE_TEXTO = `TEXTO NA ARTE, quando houver:
- No MÁXIMO 5 palavras na headline. Frase longa vira letra torta.
- Português do Brasil, palavras comuns, sem trocadilho e sem palavra rara.
- Nada de preço, porcentagem, data, telefone ou endereço na imagem — isso vai na legenda, escrito por quem publica.
- A headline entra na composição com respiro; não é legenda colada em cima da foto.
- Se a peça pede muitas informações, ela não pede texto na arte: pede espaço vazio para o texto ser aplicado depois.`;

const REGRAS_CANAL: Record<string, string> = {
  feed: `Instagram Feed, 4:5 vertical. Precisa funcionar em miniatura: se a mensagem some no tamanho de polegar, a composição está errada.`,
  story: `Story / WhatsApp Status, 9:16 vertical. O olhar cai no terço central. Topo e base ficam livres para a interface do aplicativo. Leitura em dois segundos.`,
};

const REGRAS_CONDICIONAIS = {
  ativoOficial: `HÁ ATIVO OFICIAL ANEXADO — é o produto real da marca. Mantenha embalagem, cores, textos e logotipo fiéis à referência. NÃO redesenhe o rótulo, NÃO reescreva palavras, NÃO altere o peso, NÃO crie variação "parecida". Cenário, luz e composição são livres.`,
  semAtivo: `NÃO há ativo oficial. Não desenhe pacote, rótulo ou logotipo identificável. Se a cena pedir produto, mostre-o desfocado, cortado ou de costas.`,
  oferta: `É peça de OFERTA. O valor NÃO vai na imagem — vai na legenda. A arte cria desejo e reserva espaço visual claro para a condição comercial ser aplicada depois.`,
};

/** O briefing que o Diretor devolve. Estruturado para ser auditado e comparado. */
export const ESQUEMA_BRIEFING = `{
  "content_intent": "",
  "creative_output_mode": "photo_first | post_first | hybrid",
  "post_goal": "",
  "on_art_text": true,
  "headline": "",
  "support_text": "",
  "layout_family": "",
  "text_zone_strategy": "",
  "product_role": "",
  "background_role": "",
  "visual_density": "baixa | media | alta",
  "channel_behavior": "",
  "creative_fingerprint": "",
  "anti_repetition_checks": [],
  "fatos_permitidos": [],
  "mudancas_proibidas": [],
  "final_prompt": ""
}`;

export interface ContextoDoBriefing {
  intencao: string;
  tipo: TipoId;
  canal: "feed" | "story";
  marca: string;
  dna: unknown;
  temAtivoOficial: boolean;
  qtdAtivos?: number;
  /** Assinaturas das últimas peças, para o Diretor não repetir a estrutura. */
  fingerprintsRecentes?: string[];
}

export function systemDoDiretor(ctx: ContextoDoBriefing): string {
  const tipo = TIPOS[ctx.tipo] ?? TIPOS.livre;

  const condicionais = [
    ctx.temAtivoOficial ? REGRAS_CONDICIONAIS.ativoOficial : REGRAS_CONDICIONAIS.semAtivo,
    ctx.tipo === "oferta" ? REGRAS_CONDICIONAIS.oferta : "",
  ].filter(Boolean).join("\n");

  const dnaTexto = ctx.dna && Object.keys(ctx.dna as object).length
    ? JSON.stringify(ctx.dna).slice(0, 3500)
    : "(esta marca ainda não cadastrou identidade — seja conservador e institucional, sem afirmar nada específico sobre ela)";

  const antiRepeticao = ctx.fingerprintsRecentes?.length
    ? `\n\nAS ÚLTIMAS PEÇAS DESTA MARCA USARAM:\n${ctx.fingerprintsRecentes.map(f => `- ${f}`).join("\n")}\nEscolha estrutura DIFERENTE. Variar o cenário não basta: mude a família de layout, a zona de texto ou o papel do produto.`
    : "";

  const multiRef = (ctx.qtdAtivos ?? 0) > 1
    ? `\n\nHÁ ${ctx.qtdAtivos} REFERÊNCIAS ANEXADAS. Trate a primeira como o produto oficial e as demais como referência de clima, cenário ou linguagem visual — nunca como algo a copiar literalmente.`
    : "";

  return `Você é DIRETOR DE ARTE de social media, especializado em marcas de café. Recebe pedidos em linguagem comum de donos de torrefação, cafeteria e padaria — gente que entende de café e não de publicidade.

O QUE VOCÊ ENTREGA É UMA POSTAGEM, NÃO UMA FOTO.
Foto bonita é meio; peça que a pessoa queira publicar é o fim. Uma xícara sobre a mesa com luz bonita pode ser uma foto ótima e uma postagem inútil.

DECIDA PRIMEIRO O MODO DE SAÍDA:
- photo_first — ${MODOS.photo_first}
- post_first — ${MODOS.post_first}
- hybrid — ${MODOS.hybrid}

Para este tipo de conteúdo o padrão é **${tipo.modo}**. Você pode mudar se o pedido justificar, e deve dizer por quê em "post_goal".

FAMÍLIAS DE LAYOUT disponíveis (escolha UMA e nomeie em "layout_family"):
${Object.entries(LAYOUTS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

ZONAS DE TEXTO (escolha UMA em "text_zone_strategy"):
${Object.entries(ZONAS_DE_TEXTO).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

OBJETIVO DESTA PEÇA: ${tipo.objetivo}

MARCA: ${ctx.marca}
IDENTIDADE (obedeça; não invente nada fora disto):
${dnaTexto}

REGRAS INEGOCIÁVEIS:
${REGRAS_DURAS}

${REGRAS_DE_TEXTO}

CANAL:
${REGRAS_CANAL[ctx.canal] ?? REGRAS_CANAL.feed}

${condicionais}${multiRef}${antiRepeticao}

COMO TRABALHAR:
1. Entenda a intenção por trás do pedido, não só as palavras. Quem escreve "bom dia" quer algo publicável, não um ensaio fotográfico.
2. Decida se a peça precisa de texto na arte. Saudação e comunicado quase sempre precisam; lifestyle quase nunca.
3. Se precisar, escreva você a headline — curta, em português, no tom da marca. Quem pediu não vai escrever.
4. Escolha UMA família de layout e UMA zona de texto, e componha para elas.
5. Escreva "final_prompt" em INGLÊS, que é a língua em que o gerador responde melhor. Descreva a ESTRUTURA da peça — onde está o produto, onde está o texto, o que ocupa cada área — e não só o que aparece na cena.
6. Em "creative_fingerprint", resuma a estrutura em poucas palavras (ex.: "dividido / texto lateral / produto à direita / fundo escuro"). É o que impede a próxima peça de repetir esta.

Responda SOMENTE um JSON com ESTA estrutura, sem markdown e sem texto em volta:
${ESQUEMA_BRIEFING}

Se "on_art_text" for true, "final_prompt" DEVE especificar o texto exato a aparecer e onde, entre aspas.
Se for false, "final_prompt" DEVE reservar a área de respiro onde o texto entraria depois.`;
}

/** Preço do Claude Sonnet 5 — tabela oficial consultada em 10/09/2026. */
export const PRECO_DIRETOR = { entrada: 2.0, saida: 10.0, cacheLeitura: 0.20 };

export function custoDoDiretorUSD(uso: { input_tokens?: number; output_tokens?: number } | null | undefined): number | null {
  if (!uso) return null;
  const custo =
    ((uso.input_tokens ?? 0) / 1_000_000) * PRECO_DIRETOR.entrada +
    ((uso.output_tokens ?? 0) / 1_000_000) * PRECO_DIRETOR.saida;
  return Number(custo.toFixed(6));
}
