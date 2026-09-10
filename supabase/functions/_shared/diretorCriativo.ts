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
export const DIRETOR_VERSION = "diretor-v5-visao";

// ---------------------------------------------------------------------
// O Diretor passou a ENXERGAR
// ---------------------------------------------------------------------
// Até a v4 o Diretor decidia cor, produto e identidade sem receber imagem
// nenhuma: a foto ia direto para o gerador e pulava quem escrevia o
// briefing. Pedir "leia as cores da embalagem" a um modelo que não recebe
// imagem produz o estereótipo, não a leitura — foi assim que a embalagem
// verde e dourada do Café Capital virou "marrom escuro, cor dominante da
// embalagem oficial" num prompt que afirmava tê-la lido.
//
// Agora as imagens vão junto, cada uma anunciada com o seu papel.
export const REGRA_DE_VISAO = `VOCÊ ESTÁ VENDO AS IMAGENS DESTE PEDIDO.
Elas vêm anexadas a esta conversa, cada uma anunciada com o seu papel antes de aparecer.

OLHE ANTES DE DECIDIR. Não descreva o que você espera de uma marca de café: descreva o que está na imagem.
Café NÃO é necessariamente marrom. Se a embalagem é verde, a peça é verde.
Se você afirmar uma cor, um nome ou um peso, tem de ser porque está VISÍVEL na imagem — nunca porque é o mais provável.
Se algo estiver ilegível ou você não tiver certeza, não afirme: componha sem aquilo.`;

// ---------------------------------------------------------------------
// IDIOMA DE SAÍDA — regra do produto, não preferência
// ---------------------------------------------------------------------
// Referência pode vir de qualquer país. A peça sai em português do Brasil.
// Isto não vive só numa frase do prompt: é constante, entra em três pontos
// da instrução, é gravada no briefing e tem verificação determinística
// depois (`pareceEstrangeiro`), porque instrução ao modelo é pedido e
// código é garantia.
export const LOCALE_SAIDA = "pt-BR";

export const REGRA_DE_IDIOMA = `IDIOMA — REGRA ABSOLUTA DO PRODUTO
Toda copy NOVA e visível sai em PORTUGUÊS DO BRASIL: headline, apoio, chamada, oferta, comunicado, legenda e qualquer texto que apareça na arte.

A referência pode estar em inglês, espanhol ou qualquer idioma. Isso NÃO define o idioma da peça. Da referência você extrai conceito, hierarquia e composição — nunca o texto.

NÃO traduza ao pé da letra: entenda a intenção e escreva algo natural em português brasileiro. "BREWING HAPPINESS" não vira "PREPARANDO FELICIDADE"; vira uma frase que um brasileiro diria.

NUNCA deixe headline estrangeira escapar para a peça.

PERMANECEM COMO ESTÃO, sem tradução: nome da marca, nome registrado do produto, @ do Instagram, URL, domínio, códigos, nomes próprios, e QUALQUER TEXTO IMPRESSO NA EMBALAGEM OFICIAL — se a embalagem tem palavra em inglês, ela continua em inglês; o que se cria ao redor dela é que sai em português.`;

/**
 * Verificação determinística de idioma na copy gerada.
 *
 * Existe porque a regra não pode depender só de o modelo obedecer. Não
 * bloqueia — heurística erra, e derrubar uma geração paga por falso positivo
 * seria pior que o problema. Marca para quem aprova conferir.
 *
 * A lista só tem palavras que NÃO existem em português, para não acusar
 * "café", "para" ou "com", que são comuns aos três idiomas.
 */
const PALAVRAS_ESTRANGEIRAS = [
  // inglês
  "the", "your", "with", "and", "coffee", "brewing", "happiness", "morning",
  "taste", "every", "best", "start", "day", "good", "fresh", "love", "life",
  "enjoy", "moment", "perfect", "blend", "roast", "shop", "now", "you",
  // espanhol
  "buenos", "dias", "días", "mejor", "cada", "más", "nuestro", "nuestra",
  "sabor", "disfruta", "tu", "el", "los", "las", "con",
];

export function pareceEstrangeiro(texto: unknown): boolean {
  if (typeof texto !== "string" || texto.trim().length < 3) return false;
  const palavras = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/).filter(p => p.length > 1);
  if (!palavras.length) return false;
  const suspeitas = palavras.filter(p =>
    PALAVRAS_ESTRANGEIRAS.some(e => e.normalize("NFD").replace(/[̀-ͯ]/g, "") === p));
  // Duas ou mais: uma isolada pode ser nome próprio ou marca.
  return suspeitas.length >= 2;
}

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
// Estilo da peça — o que o cliente escolhe em vez de descrever
// ---------------------------------------------------------------------
// Cada estilo empurra o modo de saída e o acabamento. É a tradução de
// "mais premium" — que qualquer dono de torrefação sabe dizer — para
// decisões que ele não teria como descrever.
export const ESTILOS = {
  fotografico: {
    rotulo: "Mais fotográfico",
    modo: "photo_first" as ModoSaida,
    direcao: "Realismo acima de tudo. Luz natural, profundidade real, imperfeição bem-vinda. Layout discreto ou ausente.",
  },
  post_pronto: {
    rotulo: "Mais post pronto",
    modo: "post_first" as ModoSaida,
    direcao: "Estrutura de social media evidente: blocos, hierarquia clara, headline com peso, respiro planejado.",
  },
  comercial: {
    rotulo: "Mais comercial",
    modo: "post_first" as ModoSaida,
    direcao: "Leitura rápida e apelo direto. Cores vivas, contraste alto, mensagem que se entende passando o dedo.",
  },
  premium: {
    rotulo: "Mais premium",
    modo: "hybrid" as ModoSaida,
    direcao: "Fundo escuro ou texturizado, luz direcional e controlada, muito espaço negativo, tipografia sóbria. Menos elementos, mais silêncio.",
  },
  moderno: {
    rotulo: "Mais moderno",
    modo: "hybrid" as ModoSaida,
    direcao: "Linguagem contemporânea de feed: geometria limpa, cor da marca em bloco, composição assimétrica com intenção.",
  },
} as const;
export type EstiloId = keyof typeof ESTILOS;

// ---------------------------------------------------------------------
// Texto na arte — decisão do cliente, executada pelo Diretor
// ---------------------------------------------------------------------
export const MODOS_DE_TEXTO = {
  automatico: "O Diretor decide se a peça pede texto. Saudação e comunicado quase sempre pedem; lifestyle quase nunca.",
  com_frase: "A peça DEVE ter uma frase curta na arte. Escreva você a headline, no tom da marca.",
  sem_texto: "A peça NÃO leva texto na arte. Reserve área de respiro para o texto ser aplicado depois por quem publica.",
} as const;
export type ModoTextoId = keyof typeof MODOS_DE_TEXTO;

// ---------------------------------------------------------------------
// Papel de cada imagem anexada — a distinção que faltava
// ---------------------------------------------------------------------
// Embalagem oficial e imagem de inspiração recebem instruções OPOSTAS. Uma
// deve ser preservada; a outra deve ser lida e abandonada. Mandar as duas
// pelo mesmo caminho era pedir para o modelo copiar a referência — que é
// exatamente o que a disciplina do Studio proíbe.
export type PapelDoAtivo = "oficial" | "inspiracao";

export const PAPEL_OFICIAL = `ATIVO OFICIAL — é o produto real da marca. Mantenha embalagem, cores, textos e logotipo fiéis à referência. NÃO redesenhe o rótulo, NÃO reescreva palavras, NÃO altere o peso, NÃO crie variação "parecida". Cenário, luz e composição são livres.`;

// ---------------------------------------------------------------------
// Paleta — a peça obedece à embalagem, não ao gosto do modelo
// ---------------------------------------------------------------------
// Sintoma que originou esta regra: embalagem verde/dourado/branco do Café
// Capital gerou headline VERMELHA. Não era erro do modelo — era omissão
// nossa: PAPEL_OFICIAL mandava preservar as cores DA EMBALAGEM e não dizia
// nada sobre a cor do RESTO da peça. Sem instrução, o gerador escolhe cor
// por conta, e escolhe diferente a cada vez.
//
// A embalagem é o único documento de marca que temos com certeza em mãos.
// Ela manda na paleta da postagem inteira.
export const REGRA_DE_PALETA = `PALETA — A EMBALAGEM MANDA NA PEÇA INTEIRA
A paleta da postagem sai do ATIVO OFICIAL, não do seu gosto e não da inspiração. Você está vendo a embalagem: olhe e nomeie a cor dominante, a secundária e o metal ou detalhe, se houver.

NOMEIE A COR QUE VOCÊ VÊ, não a que se espera de café. Marrom só entra se a embalagem for marrom.
A INSPIRAÇÃO NÃO DECIDE PALETA. Se a referência é amarela e a embalagem é verde, a peça é verde.

- A COR DOMINANTE da embalagem é a cor dominante da peça: fundo, bloco de cor, faixa.
- HEADLINE e textos usam a cor dominante, a secundária, ou um neutro (branco, off-white, preto, creme). Nada além disso.
- É PROIBIDO introduzir cor que não existe na embalagem. Embalagem verde não gera texto vermelho; embalagem vermelha não gera texto azul.
- Neutros e materiais reais do cenário (madeira, linho, cerâmica, vapor, luz do sol) são sempre permitidos — não contam como cor nova.
- Se a marca cadastrou cores na identidade, elas valem junto com as da embalagem. Em conflito, a embalagem vence: é o produto que a pessoa vai ver na prateleira.

Nomeie em "paleta_da_peca" as cores que você escolheu e de onde vieram.`;

export const PAPEL_INSPIRACAO = `REFERÊNCIA DE INSPIRAÇÃO — NÃO é da marca e NÃO deve ser copiada. Extraia dela o PRINCÍPIO: o mecanismo de composição, a relação entre produto e espaço, a sensação de luz, a lógica de hierarquia. Depois ABANDONE a execução. É proibido reproduzir o layout exato, a paleta específica, a tipografia, os objetos, o cenário ou qualquer elemento reconhecível da peça de origem. Se a adaptação puder ser confundida com a referência, ela está errada.`;

// ---------------------------------------------------------------------
// Modo da marca — perfil cadastrado ou marca livre
// ---------------------------------------------------------------------
// A peça de 10/09/2026 entrou com embalagem Café Capital e saiu com
// embalagem Saporino. O modelo não trocou nada: o prompt mandava, por
// escrito, "the official Saporino Clássico Tradicional package". A marca
// vinha do seletor de empresa do topo do admin e o anexo não tinha marca
// nenhuma — duas verdades contraditórias, e só uma delas tinha nome.
//
// MARCA LIVRE é a resposta, e não é só para teste: é como um cliente novo
// entra. Ninguém cadastra DNA de marca antes da primeira peça. Anexa a
// embalagem, escreve o nome, e a embalagem passa a ser o documento da marca.
export type ModoMarca = "perfil" | "livre";

export const MODO_MARCA_LIVRE = `MARCA LIVRE — A EMBALAGEM É O DOCUMENTO DA MARCA
Esta marca NÃO tem identidade cadastrada, e isso é proposital. Tudo o que você sabe sobre ela está em dois lugares, e em nenhum outro:

1. A EMBALAGEM ANEXADA — nome, cores, tipografia, produto e peso saem DELA. Leia a embalagem antes de compor.
2. O PEDIDO ESCRITO — é o que a pessoa quer dizer.

VOCÊ NÃO CONHECE ESTA MARCA. Não invente história, origem, região, prêmio, certificação, slogan, ano de fundação nem linha de produto.
É PROIBIDO citar, escrever ou desenhar qualquer OUTRA marca de café. Nenhuma. Nem como comparação, nem como inspiração, nem "no estilo de".
Não desenhe logotipo: o logotipo é o que já está na embalagem anexada.
Se você não consegue ler o nome na embalagem, não escreva nome nenhum na peça.`;

/**
 * Detecta contaminação de marca no prompt final.
 *
 * A trava que faltava. Nenhuma instrução impede o Diretor de escrever o nome
 * da marca errada — mas conferir o texto ANTES de pagar a imagem é barato e
 * determinístico. Devolve o nome intruso, ou null.
 */
const PALAVRAS_NEUTRAS = new Set([
  "cafe", "coffee", "brasil", "brazil", "ltda", "the", "com", "premium",
  "gourmet", "torrefacao", "classico", "tradicional", "expresso", "especial",
]);

function tokensDeMarca(nome: string): string[] {
  return nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 3 && !PALAVRAS_NEUTRAS.has(t));
}

export function marcaEstranhaNoPrompt(
  prompt: string,
  marcaAtual: string,
  nomesConhecidos: string[],
): string | null {
  const texto = prompt.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const meus = new Set(tokensDeMarca(marcaAtual));
  for (const nome of nomesConhecidos) {
    for (const t of tokensDeMarca(nome)) {
      // Um token que também é meu não acusa: "Café Capital" e "Capital Ltda"
      // podem coexistir sem que uma seja intrusa da outra.
      if (meus.has(t)) continue;
      if (new RegExp(`\\b${t}\\b`).test(texto)) return nome;
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// Assinatura — o @ é garantido por código, não pedido ao modelo
// ---------------------------------------------------------------------
// O cliente digitava "cafecapital" e a peça saía sem arroba; digitava
// "@cafecapital" e saía com. Isso não é escolha dele: assinatura de
// Instagram tem arroba. Regra que software garante não vai para o prompt.
export function normalizarHandle(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const limpo = bruto.trim().replace(/\s+/g, "").replace(/^@+/, "").slice(0, 40);
  return limpo ? `@${limpo}` : null;
}

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
// Classificação da intenção — o cliente escreve, o sistema entende
// ---------------------------------------------------------------------
// Escolher "Bom dia" numa parede de onze botões é trabalho de quem monta o
// pedido, não de quem faz café. Quem escreve "faça um bom dia com este café"
// já disse o tipo. Determinístico de propósito: classificar por palavra-chave
// é instantâneo, é de graça e é auditável — e o que ele não souber cai em
// "livre", onde o Diretor lê a frase inteira e decide.
const PISTAS: [TipoId, RegExp][] = [
  ["bom_dia",        /\bbom\s*dia\b|\bbomdia\b|\bmanh[aã]\b/],
  ["boa_tarde",      /\bboa\s*tarde\b|\bfim\s+da\s+tarde\b/],
  ["oferta",         /\boferta\b|\bpromo\w*|\bdesconto\b|\bcondi[cç][aã]o\b|\bpre[cç]o\b|\bliquida\w*|\bcombo\b|\bleve\s+\d/],
  ["comunicado",     /\bcomunicad\w*|\baviso\b|\binformamos\b|\bfechad\w*|\bferiado\b|\bhor[aá]rio\b/],
  ["institucional",  /\binstitucional\b|\bquem\s+somos\b|\bnossa\s+hist[oó]ria\b|\bnossos?\s+valores\b|\bsobre\s+a\s+(marca|empresa)\b/],
  ["educativo",      /\beducativ\w*|\bensin\w*|\bdica\b|\bcomo\s+(fazer|preparar)\b|\bcuriosidade\b|\breceita\b/],
  ["representante",  /\brepresentant\w*|\bvendedor\w*|\bfor[cç]a\s+de\s+vendas\b|\bmaterial\s+de\s+apoio\b/],
  ["ponto_de_venda", /\bpadari\w*|\bponto\s+de\s+venda\b|\bpdv\b|\bbalc[aã]o\b|\bmercad\w*|\bcafeteri\w*|\bgondol\w*/],
  ["produto",        /\bdivulg\w*|\blan[cç]\w*|\bapresent\w*|\bmostrar\s+(o|meu|este|esse)\b|\bnovo\s+produto\b/],
  ["lifestyle",      /\blifestyle\b|\bmomento\b|\bclima\b|\baconcheg\w*|\brotina\b/],
];

/**
 * Descobre o tipo de conteúdo a partir do que a pessoa escreveu.
 *
 * `preferido` é o que ela escolheu na tela, quando escolheu. Escolha explícita
 * sempre vence: adivinhar por cima de uma decisão do cliente seria pior que
 * não adivinhar.
 */
export function classificarIntencao(texto: unknown, preferido?: string | null): TipoId {
  if (preferido && preferido !== "livre" && preferido in TIPOS) return preferido as TipoId;
  if (typeof texto !== "string") return "livre";
  const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [tipo, pista] of PISTAS) {
    if (pista.test(t)) return tipo;
  }
  return "livre";
}

/**
 * Modo de saída quando ninguém escolheu estilo.
 *
 * Com embalagem real E referência de post, híbrido é a resposta certa: a
 * embalagem precisa ser fotografada de verdade e a referência pede estrutura
 * de post. Só photo_first puro escapa — lifestyle não vira cartaz.
 */
export function modoPreferido(
  tipo: TipoId,
  temOficial: boolean,
  temInspiracao: boolean,
): ModoSaida {
  const padrao = TIPOS[tipo]?.modo ?? "hybrid";
  if (temOficial && temInspiracao && padrao !== "photo_first") return "hybrid";
  return padrao;
}

// ---------------------------------------------------------------------
// Regras duras — leis, não sugestão
// ---------------------------------------------------------------------
const REGRAS_DURAS = `NUNCA invente preço, desconto, cupom, prazo, brinde, frete grátis ou qualquer condição comercial que não tenha sido informada.
NUNCA invente prêmio, certificação, nota de qualidade, origem, altitude, safra ou processo.
NUNCA desenhe logotipo, marca ou rótulo identificável que não venha de um ativo oficial anexado.`;

// Texto na arte deixou de ser proibido — mas ganhou disciplina própria, porque
// gerador de imagem erra letra, e erra mais em português.
const REGRAS_DE_TEXTO = `TEXTO NA ARTE — pouco texto, bem hierarquizado. Uma peça pode ter até três níveis:

1. HEADLINE — a frase que carrega a mensagem. Curta, idealmente até ~5 palavras. É o que se lê primeiro.
2. APOIO (opcional) — uma linha que completa a ideia, um pouco mais longa que a headline. Só quando acrescenta.
3. ASSINATURA (opcional) — o @ do Instagram ou o nome da marca, discreto, num canto.

Isso NÃO é limite de cinco palavras para a peça inteira: é hierarquia. Uma peça com headline curta, uma linha de apoio e a assinatura está certa. Uma peça com um parágrafo está errada.

DISCIPLINA DE TEXTO:
- Português do Brasil, palavras comuns, sem trocadilho e sem palavra rara.
- Nada de preço, porcentagem, data, telefone ou endereço na imagem — isso vai na legenda, escrito por quem publica.
- O texto entra COMPONDO, com respiro; não é legenda colada em cima da foto.
- Se a peça pede muita informação, ela não pede texto na arte: pede espaço vazio para o texto ser aplicado depois.
- Gerador de imagem erra letra, e erra mais em português: quanto mais curta a frase, menor o risco. Prefira o essencial.`

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
  "output_language": "pt-BR",
  "content_intent": "",
  "creative_output_mode": "photo_first | post_first | hybrid",
  "post_goal": "",
  "on_art_text": true,
  "headline": "",
  "support_text": "",
  "layout_family": "",
  "text_zone_strategy": "",
  "paleta_da_peca": "",
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
  /** Escolhas guiadas: o cliente aponta, não descreve. */
  estilo?: EstiloId;
  modoTexto?: ModoTextoId;
  /** Papel de cada anexo, na ordem enviada. */
  papeis?: PapelDoAtivo[];
  /** @ da marca, para virar assinatura discreta na peça. */
  handle?: string | null;
  /** "livre" = sem DNA cadastrado; a embalagem anexada é o documento da marca. */
  modoMarca?: ModoMarca;
  /** Frases já usadas — nesta leva e em qualquer cliente. Nenhuma se repete. */
  headlinesProibidas?: string[];
}

export function systemDoDiretor(ctx: ContextoDoBriefing): string {
  const tipo = TIPOS[ctx.tipo] ?? TIPOS.livre;
  const estilo = ctx.estilo ? ESTILOS[ctx.estilo] : null;
  const papeisDeclarados = ctx.papeis ?? [];
  const oficialPresente = papeisDeclarados.includes("oficial") || (!papeisDeclarados.length && ctx.temAtivoOficial);
  const inspiracaoPresente = papeisDeclarados.includes("inspiracao");
  // O estilo escolhido MANDA no modo de saída: quem apontou "mais premium"
  // fez isso para não precisar explicar. Sem escolha — que é o caso do
  // cliente final, onde o campo nem existe — o modo vem da intenção e dos
  // anexos: embalagem real mais referência de post pede híbrido.
  const modoAlvo = estilo?.modo ?? modoPreferido(ctx.tipo, oficialPresente, inspiracaoPresente);

  const condicionais = [
    ctx.temAtivoOficial ? REGRAS_CONDICIONAIS.ativoOficial : REGRAS_CONDICIONAIS.semAtivo,
    ctx.tipo === "oferta" ? REGRAS_CONDICIONAIS.oferta : "",
  ].filter(Boolean).join("\n");

  // Em marca livre o DNA não é omitido por acidente: ele é proibido. Foi
  // exatamente um DNA de outra marca que virou embalagem errada na peça.
  const modoMarca: ModoMarca = ctx.modoMarca ?? "perfil";
  const dnaTexto = modoMarca === "livre"
    ? MODO_MARCA_LIVRE
    : ctx.dna && Object.keys(ctx.dna as object).length
      ? JSON.stringify(ctx.dna).slice(0, 3500)
      : "(esta marca ainda não cadastrou identidade — seja conservador e institucional, sem afirmar nada específico sobre ela)";

  const antiRepeticao = ctx.fingerprintsRecentes?.length
    ? `\n\nAS ÚLTIMAS PEÇAS DESTA MARCA USARAM:\n${ctx.fingerprintsRecentes.map(f => `- ${f}`).join("\n")}\nEscolha estrutura DIFERENTE. Variar o cenário não basta: mude a família de layout, a zona de texto ou o papel do produto.`
    : "";

  // Papel de cada anexo. Oficial e inspiração recebem instruções OPOSTAS:
  // uma se preserva, a outra se lê e se abandona.
  const temOficial = oficialPresente;
  const temInspiracao = inspiracaoPresente;
  const papeisTexto = [
    temOficial ? `

IMAGEM 1 — ${PAPEL_OFICIAL}` : "",
    temInspiracao ? `

IMAGEM DE REFERÊNCIA — ${PAPEL_INSPIRACAO}` : "",
  ].filter(Boolean).join("");

  // Unicidade: nenhuma frase se repete, nem dentro da leva, nem entre
  // clientes. Duas torrefações não podem receber a mesma peça.
  const proibidas = (ctx.headlinesProibidas ?? []).filter(h => typeof h === "string" && h.trim()).slice(0, 40);
  const unicidade = proibidas.length
    ? `

FRASES JÁ USADAS — NENHUMA DELAS PODE APARECER, nem igual, nem parecida, nem com as palavras trocadas de ordem:
${proibidas.map(h => `- "${h}"`).join("\n")}
Escreva uma headline que não seja variação de nenhuma dessas. Se a sua primeira ideia estiver na lista, descarte e escreva outra.`
    : "";

  // Com embalagem em mãos, ela manda na paleta. Sem embalagem, a identidade
  // cadastrada é a única fonte de cor — e o resto é neutro.
  const paletaTexto = temOficial
    ? `

${REGRA_DE_PALETA}`
    : `

PALETA: use apenas as cores da identidade da marca acima e neutros (branco, off-white, preto, creme) mais os materiais reais do cenário. Não introduza cor de marca que não esteja cadastrada.`;

  // O @ vem normalizado; o ícone de rede social é proibido porque o gerador
  // desenha logotipo de terceiro malfeito e não sabe compor ícone + texto
  // como uma unidade — foi o que produziu o vão entre a câmera e o nome.
  const handle = normalizarHandle(ctx.handle);
  const assinatura = handle
    ? `

ASSINATURA: a peça pode trazer "${handle}" de forma discreta, num canto respirado. Escreva exatamente assim, com a arroba, sem traduzir e sem alterar. APENAS O TEXTO: não desenhe o ícone do Instagram nem logotipo de rede social nenhum. A assinatura usa um neutro ou uma cor da embalagem, em corpo pequeno.`
    : "";

  const textoPedido = ctx.modoTexto && ctx.modoTexto !== "automatico"
    ? `

DECISÃO DE TEXTO (o cliente escolheu): ${MODOS_DE_TEXTO[ctx.modoTexto]}`
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

Para esta peça o modo é **${modoAlvo}**${estilo ? ` — o cliente escolheu "${estilo.rotulo}"` : ` (padrão deste tipo de conteúdo)`}. Só mude se o pedido tornar isso claramente errado, e diga por quê em "post_goal".${estilo ? `

ACABAMENTO PEDIDO: ${estilo.direcao}` : ""}

FAMÍLIAS DE LAYOUT disponíveis (escolha UMA e nomeie em "layout_family"):
${Object.entries(LAYOUTS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

ZONAS DE TEXTO (escolha UMA em "text_zone_strategy"):
${Object.entries(ZONAS_DE_TEXTO).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

OBJETIVO DESTA PEÇA: ${tipo.objetivo}

MARCA: ${ctx.marca}
É PROIBIDO escrever, citar ou desenhar qualquer marca de café que não seja "${ctx.marca}". Nenhuma outra, em nenhum lugar da peça e em nenhum lugar do final_prompt.
IDENTIDADE (obedeça; não invente nada fora disto):
${dnaTexto}

${REGRA_DE_VISAO}

${REGRA_DE_IDIOMA}

REGRAS INEGOCIÁVEIS:
${REGRAS_DURAS}

${REGRAS_DE_TEXTO}

CANAL:
${REGRAS_CANAL[ctx.canal] ?? REGRAS_CANAL.feed}

${condicionais}${papeisTexto}${paletaTexto}${multiRef}${assinatura}${textoPedido}${antiRepeticao}${unicidade}

COMO TRABALHAR:
1. Entenda a intenção por trás do pedido, não só as palavras. Quem escreve "bom dia" quer algo publicável, não um ensaio fotográfico.
2. Decida se a peça precisa de texto na arte. Saudação e comunicado quase sempre precisam; lifestyle quase nunca.
3. Se precisar, escreva você a headline — curta, em português, no tom da marca. Quem pediu não vai escrever.
4. Escolha UMA família de layout e UMA zona de texto, e componha para elas.
5. Defina a paleta a partir da embalagem e registre em "paleta_da_peca". O "final_prompt" DEVE dizer, com nome de cor, qual é a cor do fundo e qual é a cor de cada texto — sem isso o gerador escolhe sozinho e erra.
6. Escreva "final_prompt" em INGLÊS, que é a língua em que o gerador responde melhor. Descreva a ESTRUTURA da peça — onde está o produto, onde está o texto, o que ocupa cada área — e não só o que aparece na cena.
7. Em "creative_fingerprint", resuma a estrutura em poucas palavras (ex.: "dividido / texto lateral / produto à direita / fundo escuro"). É o que impede a próxima peça de repetir esta.

Responda SOMENTE um JSON com ESTA estrutura, sem markdown e sem texto em volta:
${ESQUEMA_BRIEFING}

"output_language" é sempre "pt-BR".

Se "on_art_text" for true, "final_prompt" DEVE especificar o texto exato a aparecer e onde, entre aspas, E DEVE conter a frase literal: ALL VISIBLE TEXT MUST BE IN BRAZILIAN PORTUGUESE, EXACTLY AS QUOTED.
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
