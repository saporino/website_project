/**
 * Régua de preço de café — classificação e metodologia.
 *
 * ================== O DEFEITO QUE ISTO CONSERTA ==================
 *
 * A primeira versão do comparador devolveu mediana de **R$ 96/kg** para café
 * 500 g, quando o Pilão que todo mundo conhece sai a **R$ 27,80/kg** e a
 * Melitta a **R$ 37,80/kg**. Número bonito e inútil — pior, perigoso, porque
 * decisão de preço tomada em cima dele levaria a vender caro demais.
 *
 * Duas causas, ambas minhas:
 *
 * 1. **Cápsula entrou junto com pacote.** Cápsula tem peso declarado, então
 *    passou pelo filtro de peso e entrou na mesma mediana. Café em cápsula
 *    custa 4 a 6 vezes o café em pó por quilo: bastam algumas para deslocar
 *    tudo.
 *
 * 2. **38 revendedores do MESMO produto contaram como 38 produtos.** A ficha
 *    do Pilão Tradicional 500 g tem 38 ofertas, de R$ 13,90 a R$ 78,99 — o
 *    mesmo pacote, 5,7× de diferença. A mediana disso é o preço do revendedor
 *    do meio, que não é o preço do produto nem o que o comprador vê primeiro.
 *
 * ================== O QUE A API DÁ, E O QUE NÃO DÁ ==================
 *
 * - `buy_box_winner` vem **nulo**, inclusive nas fichas campeãs de venda.
 *   Verificado em Pilão, Melitta e União. Então não dá para usar o vencedor
 *   oficial, e a alternativa precisa ser declarada em vez de escondida.
 * - A etiqueta `kvs_primary` está em **todas** as ofertas — não marca
 *   vencedor, apesar do nome sugerir.
 * - `/products/{id}/items` devolve as ofertas **em ordem**. Eu havia escrito
 *   que a primeira "é a que o Mercado Livre apresenta" e que seria "o mais
 *   próximo de buy box que existe". **Não tenho documentação que sustente
 *   isso.** É a primeira oferta retornada pela API, e só. Pode coincidir com
 *   o que o comprador vê primeiro, mas afirmar isso seria inventar.
 * - **Não há `sold_quantity` na oferta.** Por isso NÃO se pondera por vendas
 *   em lugar nenhum deste arquivo: seria inventar volume.
 */

/**
 * ⚠️ REGRA DE OURO, dita por ele em 20/10/2026 depois de eu errar três vezes:
 *
 *   "não podemos tirar ninguém da pesquisa, temos que coletar tudo (...)
 *    nem uma marca pode passar despercebida, mesmo se tiver 1 pacote de café"
 *   "não quero saber se é pequena ou grande, quero ver tudo e todos"
 *
 * **NADA É EXCLUÍDO.** O grupo organiza por formato de embalagem; o rótulo
 * descreve o segmento. Os dois servem para LER o relatório, nunca para sumir
 * com um concorrente. Tudo que foi coletado é publicado.
 *
 * O que eu fazia errado antes, e não faço mais:
 *  - exigir a palavra "tradicional" no título (jogou fora Pilão Intenso e
 *    3 Corações Fort, dois concorrentes diretos);
 *  - mandar para "ambíguo" quem não declarava a linha (jogou fora Cajubá,
 *    Conilon, Sabor da Fazenda, Odebrecht);
 *  - destacar uma mediana que corta quem tem poucas ofertas, o que remove
 *    sistematicamente marca pequena — e nós somos pequenos.
 */
export type Grupo =
  | 'p500'         // pó, pacote de ~500 g — a prateleira onde nós estamos
  | 'p250'         // pó, pacote de ~250 g
  | 'p1kg'         // pó, pacote de ~1 kg
  | 'kit'          // mais de uma unidade
  | 'fardo'        // 4,5 kg ou mais
  | 'outro_peso'   // pó, peso fora dos grupos acima
  | 'grao'         // café em grão
  | 'capsula'      // cápsula
  | 'soluvel'      // solúvel
  | 'outra_bebida' // cappuccino, achocolatado, bebida pronta
  | 'acessorio'    // xícara, filtro, moedor
  | 'sem_peso';    // é café, mas sem peso declarado — listado, sem R$/kg

export interface Produto {
  ficha: string;
  titulo?: string | null;
  marca?: string | null;
  tipo?: string | null;        // INSTANT_COFFEE_TYPE / SALE_FORMAT
  linha?: string | null;       // LINE
  torra?: string | null;       // TOASTED_LEVEL
  kgUnidade?: number | null;   // peso de UMA unidade
  unidades?: number | null;    // UNITS_PER_PACK
}

export interface Oferta {
  preco: number;
  condicao?: string | null;        // 'new' | 'used'
  minCompra?: number | null;       // min_purchase_unit
  lojaOficial?: number | null;
  freteGratis?: boolean | null;
  promocoes?: unknown[] | null;    // deal_ids
  precoAntes?: number | null;      // original_price
  vendedor?: number | string | null;
}

export interface Classificacao {
  grupo: Grupo;
  segmento: Segmento;
  especie: Especie;
  intensidade: Intensidade;
  torra: Torra;
  moagem: Moagem;
  motivo: string;
}

// ---------------------------------------------------------------------
// 1. Classificação — SEIS dimensões, nenhuma delas um filtro de entrada
// ---------------------------------------------------------------------
//
// ⚠️ NENHUMA destas palavras é requisito para o anúncio entrar na coleta.
// Elas DESCREVEM o que foi encontrado. Quando não há evidência no texto, o
// valor é 'nao_declarado' — que é uma resposta, não uma porta fechada.
//
// Foi exatamente o contrário disso que me fez perder Pilão Intenso, 3
// Corações Fort, Cajubá, Conilon e Sabor da Fazenda.

/** Formato DIFERENTE de pó em pacote. Vai para grupo próprio, nunca some. */
const CAPSULA = [/c[áa]psulas?\b/i, /dolce\s*gusto/i, /nespresso/i, /\bpods?\b/i];
const SOLUVEL = [/sol[úu]vel/i, /instant[âa]neo/i, /liofilizado/i, /\bextrato\b/i];
const GRAO = [
  /\bem\s*gr[ãa]os?\b/i, /\bgr[ãa]os?\s*(torrado|inteiro|cru|verde)/i,
  /\bgr[ãa]o\s*inteiro\b/i, /\bbeans?\b/i, /\bcru\b/i, /\bverde\b/i,
];
const ACESSORIO = [
  /x[íi]cara|caneca|filtro\b|coador|prensa\s*francesa|moedor|cafeteira/i,
  /porta.?c[áa]psula|dosador|balan[çc]a|jarra|bule|garrafa\s*t[ée]rmica/i,
];
const OUTRA_BEBIDA = [/cappuccino/i, /achocolatado/i, /bebida\s*pronta/i, /\bch[áa]\b/i];

// ---- segmento comercial ----
// Premium e especial ficam SEPARADOS de gourmet: são prateleiras diferentes,
// e juntá-las escondia informação.
export type Segmento = 'tradicional' | 'gourmet' | 'premium' | 'especial' | 'nao_declarado';

const ESPECIAL = [
  /\bespecia(l|is)\b/i, /\bspecialty\b/i, /\bsca\b/i, /\bscaa\b/i,
  /\b8[0-9](,\d)?\s*pontos?\b/i, /single\s*origin/i, /microlote/i, /micro\s*lote/i,
  /\bterroir\b/i, /denomina[çc][ãa]o\s*de\s*origem/i, /\bcoe\b/i,
];
const PREMIUM  = [/\bpremium\b/i, /\bsuperior\b/i, /\bextra\s*premium\b/i, /\bseleto\b/i, /\bsele[çc][ãa]o\b/i];
const GOURMET  = [/\bgourmet\b/i, /\bespresso\b/i, /\bexpresso\s*superior\b/i];
const TRADICIONAL = [
  /\btradicional\b/i, /\bcl[áa]ssico\b/i, /\bdo\s*dia\s*a\s*dia\b/i,
  /\bpopular\b/i, /\bfamilia\b/i, /\bfam[íi]lia\b/i, /\bcaseiro\b/i,
];

// ---- espécie: COMPOSIÇÃO do grão, não segmento ----
// ⚠️ Estes termos estavam, errados, dentro de TRADICIONAL. "100% arábica"
// não é tradicional nem gourmet — é informação sobre a espécie, e nada diz
// sobre a faixa de preço pretendida.
export type Especie = 'arabica' | 'conilon_robusta' | 'blend' | 'nao_declarada';

const ARABICA = [/\bar[áa]bica\b/i, /\barabica\b/i, /\bcoffea\s*arabica\b/i];
const CONILON = [/\bconilon\b/i, /\bconillon\b/i, /\brobusta\b/i, /\bcanephora\b/i, /\bcanefora\b/i];
const BLEND   = [/\bblend\b/i, /\bmistura\b/i, /predominantemente/i, /\bcomposto\b/i];

// ---- intensidade ----
export type Intensidade = 'extraforte' | 'forte' | 'intenso' | 'suave' | 'nao_declarada';
const EXTRAFORTE = [/\bextra\s*forte\b/i, /\bextraforte\b/i, /\bextra-forte\b/i];
const FORTE      = [/\bforte\b/i, /\bfort\b/i, /\bencorpado\b/i];
const INTENSO    = [/\bintenso\b/i, /\bintensidade\s*(alta|m[áa]xima)\b/i];
const SUAVE      = [/\bsuave\b/i, /\bleve\b/i, /\bdelicado\b/i, /\bmild\b/i];

// ---- torra ----
export type Torra = 'clara' | 'media' | 'escura' | 'nao_declarada';
const TORRA_CLARA  = [/torra\s*clara/i, /\blight\s*roast\b/i, /torra\s*m[ée]dia[- ]clara/i];
const TORRA_ESCURA = [/torra\s*escura/i, /\bdark\s*roast\b/i, /torra\s*m[ée]dia[- ]escura/i, /torra\s*forte/i];
const TORRA_MEDIA  = [/torra\s*m[ée]dia/i, /\bmedium\s*roast\b/i];

// ---- moagem ----
export type Moagem = 'fina' | 'media' | 'grossa' | 'nao_declarada';
const MOAGEM_FINA   = [/moagem\s*fina/i, /mo[íi]do\s*fino/i, /\bfina\b.*moagem/i, /\bp[óo]\s*fino\b/i];
const MOAGEM_GROSSA = [/moagem\s*gro(ssa|sso)/i, /mo[íi]do\s*gro(sso|ssa)/i, /\bprensa\s*francesa\b/i];
const MOAGEM_MEDIA  = [/moagem\s*m[ée]dia/i, /mo[íi]do\s*m[ée]dio/i];

/** Um texto só, para as regras não dependerem de qual campo veio preenchido. */
function textoDe(p: Produto): string {
  return [p.titulo, p.marca, p.tipo, p.linha, p.torra].filter(Boolean).join(' ');
}

const bate = (res: RegExp[], t: string) => res.some(re => re.test(t));

export function segmentoDe(p: Produto): Segmento {
  const t = textoDe(p);
  // Ordem do mais específico para o mais genérico: "café especial gourmet"
  // é especial, não gourmet.
  if (bate(ESPECIAL, t)) return 'especial';
  if (bate(PREMIUM, t)) return 'premium';
  if (bate(GOURMET, t)) return 'gourmet';
  if (bate(TRADICIONAL, t)) return 'tradicional';
  return 'nao_declarado';
}

export function especieDe(p: Produto): Especie {
  const t = textoDe(p);
  if (bate(BLEND, t)) return 'blend';
  const a = bate(ARABICA, t), c = bate(CONILON, t);
  if (a && c) return 'blend';          // diz os dois: é mistura
  if (a) return 'arabica';
  if (c) return 'conilon_robusta';
  return 'nao_declarada';
}

export function intensidadeDe(p: Produto): Intensidade {
  const t = textoDe(p);
  if (bate(EXTRAFORTE, t)) return 'extraforte';   // antes de FORTE, que casaria junto
  if (bate(INTENSO, t)) return 'intenso';
  if (bate(FORTE, t)) return 'forte';
  if (bate(SUAVE, t)) return 'suave';
  return 'nao_declarada';
}

export function torraDe(p: Produto): Torra {
  const t = textoDe(p);
  if (bate(TORRA_ESCURA, t)) return 'escura';     // "média-escura" é escura
  if (bate(TORRA_CLARA, t)) return 'clara';
  if (bate(TORRA_MEDIA, t)) return 'media';
  return 'nao_declarada';
}

export function moagemDe(p: Produto): Moagem {
  const t = textoDe(p);
  if (bate(MOAGEM_FINA, t)) return 'fina';
  if (bate(MOAGEM_GROSSA, t)) return 'grossa';
  if (bate(MOAGEM_MEDIA, t)) return 'media';
  return 'nao_declarada';
}

export function classificar(p: Produto): Classificacao {
  const t = textoDe(p);
  const dims = {
    segmento: segmentoDe(p),
    especie: especieDe(p),
    intensidade: intensidadeDe(p),
    torra: torraDe(p),
    moagem: moagemDe(p),
  };

  // Formato diferente de pó: grupo próprio, SEMPRE listado.
  if (bate(CAPSULA, t))     return { grupo: 'capsula',   ...dims, motivo: 'cápsula' };
  if (bate(SOLUVEL, t))     return { grupo: 'soluvel',   ...dims, motivo: 'solúvel' };
  if (bate(GRAO, t))        return { grupo: 'grao',      ...dims, motivo: 'café em grão' };
  if (bate(ACESSORIO, t))   return { grupo: 'acessorio', ...dims, motivo: 'acessório' };
  if (bate(OUTRA_BEBIDA, t))return { grupo: 'outra_bebida', ...dims, motivo: 'outra bebida' };

  const unidades = p.unidades ?? 1;
  const kg = p.kgUnidade ?? null;

  // Sem peso NÃO é motivo para sumir: entra na lista, sem R$/kg.
  if (!kg || kg <= 0) return { grupo: 'sem_peso', ...dims, motivo: 'peso não declarado — listado sem R$/kg' };

  const total = kg * unidades;
  if (total >= 4.5)  return { grupo: 'fardo', ...dims, motivo: `fardo de ${total.toFixed(1)} kg` };
  if (unidades > 1)  return { grupo: 'kit', ...dims, motivo: `kit de ${unidades} unidades` };
  if (kg >= 0.9 && kg <= 1.1)  return { grupo: 'p1kg', ...dims, motivo: 'pó, 1 kg' };
  if (kg >= 0.45 && kg <= 0.55) return { grupo: 'p500', ...dims, motivo: 'pó, 500 g' };
  if (kg >= 0.2 && kg < 0.45)  return { grupo: 'p250', ...dims, motivo: 'pó, ~250 g' };

  return { grupo: 'outro_peso', ...dims, motivo: `pó, ${(kg * 1000).toFixed(0)} g` };
}

// ---------------------------------------------------------------------
// 2. Peso total efetivamente vendido
// ---------------------------------------------------------------------
/**
 * Kit de 4×500 g é 2 kg, não 500 g. E `min_purchase_unit` maior que 1
 * significa que o comprador é obrigado a levar N — o que ele paga, e o que
 * leva, é N vezes.
 */
export function pesoTotalKg(p: Produto, o?: Oferta): number | null {
  const kg = p.kgUnidade ?? null;
  if (!kg || kg <= 0) return null;
  const unidades = Math.max(1, p.unidades ?? 1);
  const minimo = Math.max(1, o?.minCompra ?? 1);
  const total = kg * unidades * minimo;
  return total > 0 && total <= 60 ? total : null;
}

// ---------------------------------------------------------------------
// 3. A oferta representativa de um produto
// ---------------------------------------------------------------------
export interface Representativa {
  oferta: Oferta;
  origem: 'buy_box' | 'primeira_da_api';
  descartadas: number;
  motivosDescarte: string[];
}

/**
 * UMA oferta por produto. Era aqui que 38 revendedores viravam 38 pontos.
 *
 * Ordem de preferência:
 *  1. buy box, quando a API entregar (hoje nunca entrega — mantido para o dia
 *     em que entregar, em vez de a regra ter de ser reescrita);
 *  2. a PRIMEIRA oferta devolvida por `/products/{id}/items` — sem alegar que
 *     ela seja vencedora, buy box ou a que o consumidor vê. É simplesmente a
 *     primeira, e o campo `origem` diz isso com todas as letras.
 *
 * O menor preço é reportado SEPARADAMENTE, nunca no lugar do representativo:
 * no Pilão o mínimo é R$ 13,90 e a primeira é R$ 25,99. Tratar o mínimo como
 * "preço de mercado" assumiria disponibilidade e condições iguais, e a API
 * não diz isso. As duas medidas convivem, e a distância entre elas é um
 * número por si só — num produto com 38 revendedores, ela mede a dispersão
 * daquela ficha.
 */
export function ofertaRepresentativa(ofertas: Oferta[], buyBox?: Oferta | null): Representativa | null {
  const motivos: string[] = [];
  const validas = ofertas.filter(o => {
    if (!o || typeof o.preco !== 'number' || !(o.preco > 0)) { motivos.push('sem preço'); return false; }
    if (o.condicao && o.condicao !== 'new') { motivos.push('não é novo'); return false; }
    return true;
  });
  if (!validas.length) return null;

  if (buyBox && typeof buyBox.preco === 'number' && buyBox.preco > 0) {
    return { oferta: buyBox, origem: 'buy_box', descartadas: ofertas.length - validas.length, motivosDescarte: motivos };
  }
  return {
    oferta: validas[0],
    origem: 'primeira_da_api',
    descartadas: ofertas.length - validas.length,
    motivosDescarte: motivos,
  };
}

// ---------------------------------------------------------------------
// 4. Indicadores
// ---------------------------------------------------------------------
export interface Comparavel {
  ficha: string;
  titulo?: string | null;
  marca?: string | null;
  grupo: Grupo;
  segmento: Segmento;
  especie: Especie;
  intensidade: Intensidade;
  torra: Torra;
  moagem: Moagem;
  motivo: string;
  precoRepresentativo: number | null;
  reaisPorKg: number | null;
  pesoKg: number | null;
  origemPreco: Representativa['origem'] | null;
  ofertasNaFicha: number;

  /** Menor oferta VÁLIDA (nova, com preço). Medida própria, nunca substitui a
   *  representativa — e nunca é apresentada como "preço de mercado". */
  menorOfertaValida: number | null;
  menorReaisPorKg: number | null;

  /** Quanto a primeira oferta está acima da menor, em %. Num produto com
   *  dezenas de revendedores isto mede a dispersão da ficha: 87% no Pilão. */
  dispersaoPct: number | null;

  /** Quanta evidência de mercado existe neste produto.
   *  Uma ficha com UMA oferta é o preço que um vendedor pede, sem ninguém
   *  concorrendo — foi o caso de Italle (R$ 53,99) e Torino (R$ 76) no 500 g.
   *  Nenhum dos dois está mal classificado: os dois são tradicional 500 g.
   *  O que falta neles é concorrência, e isso é outra coisa. */
  evidencia: 'alta' | 'media' | 'baixa';

  temPromocao: boolean;
}

export function avaliar(p: Produto, ofertas: Oferta[], buyBox?: Oferta | null): Comparavel {
  const c = classificar(p);
  const rep = ofertaRepresentativa(ofertas, buyBox);
  const peso = rep ? pesoTotalKg(p, rep.oferta) : pesoTotalKg(p);
  const preco = rep?.oferta.preco ?? null;
  // Só ofertas VÁLIDAS entram no menor: uma usada a R$ 9,90 não é o piso do
  // mercado de produto novo.
  const validos = ofertas
    .filter(o => o && (!o.condicao || o.condicao === 'new'))
    .map(o => o?.preco)
    .filter((x): x is number => typeof x === 'number' && x > 0);
  const menor = validos.length ? Math.min(...validos) : null;
  return {
    ficha: p.ficha,
    titulo: p.titulo ?? null,
    marca: p.marca ?? null,
    grupo: c.grupo,
    segmento: c.segmento,
    especie: c.especie,
    intensidade: c.intensidade,
    torra: c.torra,
    moagem: c.moagem,
    motivo: c.motivo,
    precoRepresentativo: preco,
    pesoKg: peso,
    reaisPorKg: preco != null && peso ? preco / peso : null,
    origemPreco: rep?.origem ?? null,
    ofertasNaFicha: ofertas.length,
    menorOfertaValida: menor,
    menorReaisPorKg: menor != null && peso ? menor / peso : null,
    dispersaoPct: menor != null && preco != null && menor > 0
      ? ((preco - menor) / menor) * 100 : null,
    // Quantas ofertas disputam a mesma ficha. É o único sinal de concorrência
    // que a API dá — não há volume de vendas para usar no lugar.
    evidencia: ofertas.length >= 5 ? 'alta' : ofertas.length >= 2 ? 'media' : 'baixa',
    temPromocao: !!rep?.oferta.promocoes?.length
      || (rep?.oferta.precoAntes != null && rep.oferta.precoAntes > (preco ?? 0)),
  };
}

export interface Faixa {
  n: number;
  p25: number | null;
  mediana: number | null;
  p75: number | null;
  min: number | null;
  max: number | null;
}

export interface Resumo {
  dataColeta: string;

  /** Todos os comparáveis do grupo principal. */
  principal: Faixa;

  /** APOIO, não é o número principal. Só os produtos com 2+ ofertas na ficha.
   *
   *  ⚠️ Esta medida é ENVIESADA PARA MARCA GRANDE, e por isso não encabeça
   *  nada: marca pequena tem menos revendedor, então o corte por concorrência
   *  remove sistematicamente os pequenos. Serve para uma pergunta estreita —
   *  "onde está o preço nos produtos mais disputados?" — e não para "quanto
   *  custa café de 500 g no Mercado Livre". */
  principalComConcorrencia: Faixa;

  /** A mesma régua pela MENOR oferta válida, em vez da primeira retornada.
   *  É o outro extremo da realidade competitiva: o que o comprador encontra
   *  se ordenar por preço. */
  principalPelaMenor: Faixa;

  marcas: Record<string, number>;
  porGrupo: Record<string, { n: number; mediana: number | null }>;
  porSegmento: Record<string, { n: number; mediana: number | null }>;
  porEspecie: Record<string, { n: number; mediana: number | null }>;
  porIntensidade: Record<string, { n: number; mediana: number | null }>;

  /** TODOS os produtos coletados, sem corte. É esta a lista que vale.
   *  Ordenada por R$/kg; quem não tem peso vai no fim, com R$/kg nulo. */
  todos: Comparavel[];

  totais: { coletados: number; comPrecoPorKg: number; semPeso: number };
  limitacoes: string[];
}

function pct(ordenado: number[], q: number): number | null {
  if (!ordenado.length) return null;
  return ordenado[Math.min(ordenado.length - 1, Math.floor(ordenado.length * q))];
}

/** Deduplica por ficha: a mesma ficha vinda das duas rotas conta uma vez. */
export function resumir(itens: Comparavel[], dataColeta: string): Resumo {
  const unicos = new Map<string, Comparavel>();
  for (const i of itens) if (!unicos.has(i.ficha)) unicos.set(i.ficha, i);
  const lista = [...unicos.values()];

  const faixa = (arr: number[]): Faixa => {
    const a = [...arr].sort((x, y) => x - y);
    return {
      n: a.length, p25: pct(a, 0.25), mediana: pct(a, 0.5), p75: pct(a, 0.75),
      min: a.length ? a[0] : null, max: a.length ? a[a.length - 1] : null,
    };
  };

  const medianaDe = (f: (i: Comparavel) => boolean) => {
    const arr = lista.filter(i => f(i) && i.reaisPorKg != null)
      .map(i => i.reaisPorKg as number);
    return { n: arr.length, mediana: faixa(arr).mediana };
  };

  const porGrupo: Resumo['porGrupo'] = {};
  for (const g of new Set(lista.map(i => i.grupo))) porGrupo[g] = medianaDe(i => i.grupo === g);

  const porSegmento: Resumo['porSegmento'] = {};
  for (const x of new Set(lista.map(i => i.segmento))) porSegmento[x] = medianaDe(i => i.segmento === x);
  const porEspecie: Resumo['porEspecie'] = {};
  for (const x of new Set(lista.map(i => i.especie))) porEspecie[x] = medianaDe(i => i.especie === x);
  const porIntensidade: Resumo['porIntensidade'] = {};
  for (const x of new Set(lista.map(i => i.intensidade))) porIntensidade[x] = medianaDe(i => i.intensidade === x);

  // A PRATELEIRA: 500 g de café em pó, de QUALQUER marca, de QUALQUER linha.
  // Tradicional, extraforte, intenso, gourmet, conilon, arábica, sem rótulo —
  // todos disputam o mesmo comprador, e nenhum é retirado da conta.
  const p500 = lista.filter(i => i.grupo === 'p500' && i.reaisPorKg != null);
  const comConcorrencia = p500.filter(i => i.evidencia !== 'baixa');

  const marcas: Record<string, number> = {};
  for (const i of lista) {
    const m = (i.marca ?? '(sem marca)').trim();
    marcas[m] = (marcas[m] ?? 0) + 1;
  }

  const todos = [...lista].sort((a, b) => {
    if (a.reaisPorKg == null) return 1;
    if (b.reaisPorKg == null) return -1;
    return a.reaisPorKg - b.reaisPorKg;
  });

  return {
    dataColeta,
    principal: faixa(p500.map(i => i.reaisPorKg as number)),
    principalComConcorrencia: faixa(comConcorrencia.map(i => i.reaisPorKg as number)),
    principalPelaMenor: faixa(
      p500.map(i => i.menorReaisPorKg).filter((x): x is number => x != null)),
    marcas,
    porGrupo,
    porSegmento,
    porEspecie,
    porIntensidade,
    todos,
    totais: {
      coletados: lista.length,
      comPrecoPorKg: lista.filter(i => i.reaisPorKg != null).length,
      semPeso: lista.filter(i => i.grupo === 'sem_peso').length,
    },
    limitacoes: [
      'A API não entrega buy_box_winner (vem nulo até nas fichas campeãs). O preço representativo é a PRIMEIRA oferta devolvida pela API — sem alegar que seja vencedora, buy box ou a que o consumidor vê primeiro. Não há documentação que sustente outro significado.',
      'A oferta não traz quantidade vendida: nenhum indicador é ponderado por volume.',
      'A API não informa disponibilidade de estoque na oferta: o menor preço é reportado como informação, nunca usado como preço de mercado.',
      'O atributo de tipo veio pouco confiável na coleta real, então a classificação depende bastante do título. Por isso ela ORGANIZA e nunca EXCLUI: um título ruim muda o grupo do produto, jamais o apaga da lista.',
      'Frete não entra no R$/kg: é preço anunciado, não custo entregue.',
      'A mediana NÃO é o preço médio pago pelos consumidores: sem volume de vendas, ela descreve a oferta, não a demanda.',
      'Produto com UMA oferta na ficha entra na régua normalmente, marcado como evidência baixa: é o preço que um vendedor pede, sem concorrência medida. Nenhum produto é removido por ser pequeno, caro ou pouco disputado.',
      'A régua "só com concorrência" é ENVIESADA PARA MARCA GRANDE (marca pequena tem menos revendedor) e por isso é apoio, nunca o número principal.',
      'NENHUM produto coletado é removido do relatório. Cápsula, solúvel e grão vão para o grupo próprio; produto sem peso aparece sem R$/kg. Tudo que foi encontrado é publicado.',
    ],
  };
}
