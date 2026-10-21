/**
 * Hashtags de café — núcleo da marca + rotação.
 *
 * ================== O PROBLEMA MEDIDO ==================
 *
 * Nas 22 publicações agendadas em 21/10/2026:
 *
 *     #CaféForte        19 de 22
 *     #RitualDoCafé     19 de 22
 *     #CaféTropeiro     16 de 22
 *     "tradição"        16 de 22
 *     "força"           14 de 22
 *
 * Dezenove posts seguidos com o mesmo par de tags não é só repetitivo: o
 * Instagram trata conjunto idêntico como spam e entrega menos. O gerador de
 * legenda começa cada chamada do zero, e quem começa do zero sempre vai ao
 * lugar mais óbvio.
 *
 * O gerador de IMAGEM já não repete frase, porque recebe as headlines
 * anteriores e é proibido de repeti-las. Aqui é a mesma disciplina, só que
 * resolvida sem chamar IA: rotação é conta, não criatividade.
 *
 * ================== DE ONDE VEM A LISTA ==================
 *
 * Pesquisa de 21/10/2026 em ferramentas de análise de hashtag (Display
 * Purposes, TagsFinder, Best Hashtags). São tags públicas e genéricas de
 * café em português, com volume conhecido. **Nenhuma é de marca de
 * concorrente** — ver `MARCAS_DE_TERCEIROS`, que é trava, não sugestão.
 *
 * Os volumes mudam e as listas envelhecem. Por isso `atualizadoEm` fica
 * visível: no dia em que estiver velho, quem olhar sabe.
 */

export const atualizadoEm = '2026-10-21';

/** Amplas. Muito volume, muita concorrência — entra UMA por post. */
const AMPLAS = ['#cafe', '#coffee', '#cafeteria', '#coffeelover', '#coffeetime'];

/** Do segmento. Volume alto, concorrência média — entram DUAS. */
const SEGMENTO = [
  '#cafezinho', '#cafedatarde', '#cafedamanha', '#amocafe', '#cafes',
  '#cafeespecial', '#cafesespeciais', '#cafegourmet', '#cafecoado',
  '#cafetorradoemoido', '#cafebrasileiro', '#cafedeverdade',
];

/** De nicho. Menos volume, mais chance de ser visto — entram DUAS. */
const NICHO = [
  '#pausacafe', '#horadocafe', '#bomcafe', '#euamocafe', '#momentocafe',
  '#ritualdocafe', '#cafedaroca', '#cafeforte', '#torramedia',
  '#cafecomafeto', '#cheirodecafe', '#primeirocafe',
];

/** Lugar. Ancora o post em quem está perto — entra UMA, quando houver. */
const LUGAR = ['#saopaulo', '#interiordesp', '#brasil', '#spfood'];

/**
 * ⚠️ TRAVA, não lista de sugestão.
 *
 * Usar a tag de um concorrente entrega o nosso post para o público DELE,
 * debaixo da marca DELE. É de graça para eles e constrangedor para nós.
 * Vale também para marcas que distribuímos: a tag é da marca, não nossa.
 */
const MARCAS_DE_TERCEIROS = [
  'pilao', 'pilão', 'melitta', '3coracoes', '3corações', 'trescoracoes',
  'nescafe', 'nescafé', 'nespresso', 'dolcegusto', 'starbucks',
  'uniao', 'união', 'caboclo', 'santaclara', 'damasco', 'mococa',
  'orfeu', 'baggio', 'octavio', 'suplicy', 'kimura', 'delta',
];

/** Uma tag é de terceiro quando o nome da marca aparece nela. */
export function ehDeTerceiro(tag: string): boolean {
  const limpa = tag.toLowerCase().replace(/[^a-zà-ú0-9]/g, '');
  return MARCAS_DE_TERCEIROS.some(m => limpa.includes(m.replace(/[^a-zà-ú0-9]/g, '')));
}

/** Embaralhamento determinístico: a mesma semente dá sempre a mesma ordem.
 *  Previsível é bom aqui — permite testar, e permite repetir uma escolha. */
function girar<T>(lista: T[], semente: number): T[] {
  const copia = [...lista];
  let s = semente >>> 0;
  for (let i = copia.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function semente(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface OpcoesTags {
  /** A tag da marca. Única fixa — é a nossa casa. */
  daMarca?: string | null;
  /** Tags já usadas nos posts recentes. Entram como "evite", não como proibição
   *  absoluta: com acervo pequeno, proibir de vez esvaziaria a lista. */
  recentes?: string[];
  /** Quantas no total. Sete é o meio do caminho entre ser achado e virar
   *  bloco de spam. */
  quantas?: number;
}

/**
 * Monta o conjunto de hashtags de um post.
 *
 * A composição segue o que a pesquisa indica para quem é pequeno: **uma
 * ampla, duas do segmento, duas de nicho, uma de lugar** — e a da marca.
 * Bloco grande de tag genérica não ajuda quem tem poucos seguidores; ser
 * achado em busca específica ajuda.
 *
 * @param chave algo estável da peça (id, título) — garante que a MESMA peça
 *              receba sempre as mesmas tags, e peças diferentes recebam
 *              conjuntos diferentes.
 */
export function montarHashtags(chave: string, o: OpcoesTags = {}): string[] {
  const quantas = Math.max(3, Math.min(12, o.quantas ?? 7));
  const recentes = new Set((o.recentes ?? []).map(t => t.toLowerCase()));
  const s = semente(chave);

  const escolher = (lista: string[], n: number, desvio: number) => {
    const giradas = girar(lista, s + desvio);
    // Primeiro as que NÃO saíram recentemente; as repetidas ficam de reserva,
    // para o caso de a lista acabar.
    const novas = giradas.filter(t => !recentes.has(t.toLowerCase()));
    return [...novas, ...giradas.filter(t => recentes.has(t.toLowerCase()))].slice(0, n);
  };

  const fora: string[] = [];
  if (o.daMarca && !ehDeTerceiro(o.daMarca)) fora.push(normalizar(o.daMarca));

  const resto = [
    ...escolher(AMPLAS, 1, 11),
    ...escolher(SEGMENTO, 2, 22),
    ...escolher(NICHO, 2, 33),
    ...escolher(LUGAR, 1, 44),
  ];

  const vistas = new Set(fora.map(t => t.toLowerCase()));
  for (const t of resto) {
    if (fora.length >= quantas) break;
    const n = normalizar(t);
    if (ehDeTerceiro(n) || vistas.has(n.toLowerCase())) continue;
    vistas.add(n.toLowerCase());
    fora.push(n);
  }
  return fora;
}

/** `#CaféForte` e `# cafeforte` viram a mesma coisa escrita de um jeito só. */
export function normalizar(tag: string): string {
  const t = String(tag).trim().replace(/^#+/, '').replace(/\s+/g, '');
  return t ? '#' + t : '';
}

/**
 * Troca o bloco de hashtags de uma legenda já escrita, preservando o texto.
 *
 * Usado para consertar as 22 que já estavam agendadas: o corpo do texto é
 * dela e continua sendo; o que estava repetitivo era o bloco de tags.
 */
export function trocarHashtags(legenda: string, tags: string[]): string {
  const semTags = String(legenda)
    .split('\n')
    .map(l => l.replace(/#[^\s#]+/g, '').replace(/\s{2,}/g, ' ').trimEnd())
    .filter((l, i, arr) => l.trim() !== '' || (i > 0 && i < arr.length - 1))
    .join('\n')
    .trim();
  return tags.length ? `${semTags}\n\n${tags.join(' ')}` : semTags;
}
