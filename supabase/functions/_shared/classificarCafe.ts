// CLASSIFICADOR DO UNIVERSO DO CAFÉ — v2
//
// O classificador antigo (normalize.ts) respondia "que tipo de café é este?" e terminava com
// `return 'torrado_moido'`. Como ele nunca perguntava SE era café, chocolate, bolo e biscoito
// entravam na média de preço do café moído — 143 itens, medidos na auditoria de 13/10/2026.
//
// Aqui a ordem é outra: primeiro decide se pertence ao universo, depois classifica. E o que
// não dá para decidir vira AMBÍGUO para revisão humana, em vez de virar café por descuido.
//
// Módulo puro de propósito: sem Deno, sem fetch, sem banco. Roda igual na Edge Function e
// no teste (`src/lib/classificarCafe.test.ts`).

/** Sobe quando a régua muda. Fica gravado na linha classificada: sem isso não dá para saber
 *  com que versão cada número de relatório foi medido. */
export const VERSAO_CLASSIFICADOR = 2;

export type Relevancia = 'relevante' | 'ambiguo' | 'fora_escopo';

/** O que o item É. Define com quem ele pode ser comparado. */
export type Familia =
  | 'cafe'            // o café em si, para preparar
  | 'bebida_pronta'   // café com leite, cappuccino, lata pronta — outra categoria de preço
  | 'filtro'          // filtro de papel
  | 'coador'          // coador de pano ou permanente
  | 'equipamento'     // cafeteira, moedor, prensa
  | 'embalagem'       // embalagem vazia para envase
  | 'acessorio'       // caneca, xícara, colher, porta-filtro
  | 'fora';           // não pertence ao universo

/** Como o café se apresenta. Só faz sentido quando a família é `cafe`. */
export type Apresentacao = 'torrado_moido' | 'graos' | 'soluvel' | 'capsula' | 'sache' | 'verde' | null;

/** Classificação comercial declarada pelo vendedor. */
export type Classe = 'tradicional' | 'extraforte' | 'superior' | 'gourmet' | 'premium' | 'especial' | null;

export type Composicao = 'arabica' | 'robusta' | 'blend' | 'descafeinado' | 'organico' | null;

export interface Peso {
  /** Peso de UMA unidade, em gramas. */
  unitario: number | null;
  /** Quantas unidades vêm na embalagem (10 cápsulas, kit de 4 pacotes). */
  unidades: number;
  /** unitario × unidades. É este que vale para preço por quilo. */
  total: number | null;
  /** Falso quando o título é ambíguo demais para afirmar o peso. Sem isto, "10x9g" virava
   *  9 g e o preço por quilo saía dez vezes errado. */
  confiavel: boolean;
  motivo?: string;
}

export interface Classificacao {
  relevancia: Relevancia;
  familia: Familia;
  apresentacao: Apresentacao;
  classe: Classe;
  composicao: Composicao;
  /** Número do filtro (100, 102, 103): filtro 102 não compara com 103. */
  filtro_numero: number | null;
  marca: string | null;
  peso: Peso;
  preco_por_kg: number | null;
  /** Por que foi classificado assim. Aparece na revisão humana. */
  motivos: string[];
  versao: number;
}

// Aceita qualquer coisa: o `raw` do marketplace às vezes manda número, array ou objeto onde
// se espera texto. Um campo fora do tipo não pode derrubar a classificação de 6 mil linhas.
const limpar = (valor: unknown) =>
  (typeof valor === 'string' ? valor : Array.isArray(valor) ? valor.join(' ') : valor == null ? '' : String(valor))
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // tira acento
    .replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- fora do universo
// Produto que menciona café como SABOR, recheio ou acompanhamento. O erro clássico da v1.
const COMIDA_COM_SABOR_CAFE = /\b(chocolate|bombom|trufa(?!do do)|biscoito|bolacha|bolo|torta|panetone|sorvete|picole|acucar|adocante|cereal|granola|barra de|wafer|pao |paozinho|iogurte|queijo|licor|cerveja|whisky|vodka|energetico|refrigerante)\b/;
const NAO_ALIMENTO = /\b(sabonete|perfume|vela|shampoo|creme hidratante|desodorante|racao|detergente|amaciante)\b/;
// "café" como COR de roupa ou calçado. Achado real: "Sandália Havaianas 37/38 Café par".
const COR_CAFE = /\b(sandalia|chinelo|sapato|tenis|bota|camiseta|blusa|calca|bermuda|vestido|bolsa|almofada decorativa|cortina|tapete|toalha de banho)\b/;

// ------------------------------------------------------------------------ famílias
const EQUIPAMENTO = /\b(cafeteira|maquina de cafe|maquina espresso|moedor|moinho|prensa francesa|chaleira|cafeteira italiana|moka|espremedor|leiteira|bule eletrico)\b/;
const FILTRO_PAPEL = /\b(filtro de papel|filtro para cafe|filtro n?o? ?\d{2,3}|filtro \d{2,3}|papel filtrante)\b/;
const COADOR = /\b(coador|porta ?filtro|filtro permanente|filtro de pano|coador de pano)\b/;
const EMBALAGEM = /\b(embalagem|embalagens|pouch vazio|saco (metalizado|kraft|stand ?up)|stand ?up pouch|sache vazio)\b/;
const ACESSORIO = /\b(caneca|xicara|copo|garrafa termica|colher|dosador|balanca|tamper|jarra|bandeja|suporte para|pote para|porta ?mantimento|recipiente)\b/;
// Formato de embalagem que, no varejo brasileiro, só existe para café torrado e moído:
// grão inteiro não vem em almofada nem em tijolo a vácuo. É sinal, não chute.
const EMBALAGEM_DE_MOIDO = /\b(almofada|a vacuo|vacuo|tijolo|pouch)\b/;
// "café com leite" e companhia: é café, mas NÃO compara com café puro.
const BEBIDA_PRONTA = /\b(cafe com leite|com leite|cappuccino|capuccino|latte|mocha|moccaccino|bebida lactea|pronto para beber|cafe gelado|frappe)\b/;

// ------------------------------------------------------------------- apresentações
const CAPSULA = /\b(capsula|capsulas|nespresso|dolce gusto|tres ?presso|compativel com nespresso)\b/;
const SOLUVEL = /\b(soluvel|instantaneo|instant)\b/;
const GRAOS = /\b(em graos?|graos?|beans|torrado em grao)\b/;
const MOIDO = /\b(moido|torrado e moido|po |em po)\b/;
const SACHE = /\b(sache|saches|stick)\b/;
const VERDE = /\b(cafe verde|cafe cru|graos? verdes?)\b/;

const CLASSES: [RegExp, Classe][] = [
  [/\bespecial\b/, 'especial'], [/\bpremium\b/, 'premium'], [/\bgourmet\b/, 'gourmet'],
  [/\bsuperior\b/, 'superior'], [/\bextra ?forte\b/, 'extraforte'], [/\btradicional\b/, 'tradicional'],
];

const COMPOSICOES: [RegExp, Composicao][] = [
  [/\bdescafeinado\b/, 'descafeinado'], [/\borganico\b/, 'organico'],
  [/\b(100% ?arabica|arabica)\b/, 'arabica'], [/\b(robusta|conilon)\b/, 'robusta'], [/\bblend\b/, 'blend'],
];

// Marcas vistas na base. Lista explícita porque adivinhar marca pelo começo do título erra
// sempre que o anúncio abre com "Café ...".
const MARCAS = [
  '3 coracoes', 'tres coracoes', 'melitta', 'pilao', 'nescafe', 'dolce gusto', 'nespresso',
  "l'or", 'lor ', 'orfeu', 'baggio', 'illy', 'santa clara', 'cafe do ponto', 'damasco', 'utam',
  'caboclo', 'bom jesus', 'america', 'bravo', 'gioi', 'latitude 13', 'octavio', 'suplicy',
  'cafe pele', 'seleto', 'brasileiro', 'saporino', 'tropeiro paulista', 'fazenda floresta',
  'coffee mais', 'appassionato', 'tale coffee', 'belo monte', 'chiara', 'rei do cafe', 'profeta',
];

/**
 * Peso de verdade, incluindo multipack.
 *
 * Os casos que quebravam a v1, todos retirados da base:
 *   "10x9g"             → 10 unidades de 9 g = 90 g   (a v1 lia 9 g)
 *   "1 lata de 250 gr"  → 250 g                        (a v1 não lia: "gr" tem letra depois)
 *   "500 Gramas"        → 500 g                        (idem)
 *   "Kit 4 x 500 g"     → 4 unidades de 500 g = 2 kg
 *   "Caixa C/ 10un"     → 10 unidades, peso por unidade desconhecido → NÃO confiável
 */
export function lerPeso(titulo: string): Peso {
  const t = limpar(titulo).replace(/,(\d)/g, '.$1');

  // 1) multipack explícito com peso: "10x9g", "4 x 500 g", "kit 3x250g"
  const multi = t.match(/(\d{1,3})\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|gr|gramas?)\b/);
  if (multi) {
    const un = parseInt(multi[1], 10);
    const base = parseFloat(multi[2]) * (multi[3] === 'kg' ? 1000 : 1);
    return { unitario: base, unidades: un, total: base * un, confiavel: true };
  }

  // 2) peso simples: "250g", "250 gr", "500 gramas", "1kg", "1,5 kg"
  const simples = t.match(/(\d+(?:\.\d+)?)\s*(kg|quilos?|g|gr|gramas?)\b/);
  const unitario = simples
    ? parseFloat(simples[1]) * (/^(kg|quilo)/.test(simples[2]) ? 1000 : 1)
    : null;

  // 3) quantidade sem peso por unidade: "caixa c/ 10 un", "10 unidades", "leve 3"
  const qtd = t.match(/\b(?:c\/|com|caixa com|kit|leve|pack)\s*(\d{1,3})\s*(?:un|unid|unidades|capsulas|saches|pacotes)?\b/)
    || t.match(/\b(\d{1,3})\s*(?:un|unid|unidades|capsulas|saches|pacotes)\b/);
  const unidades = qtd ? parseInt(qtd[1], 10) : 1;

  if (unitario == null) {
    return { unitario: null, unidades, total: null, confiavel: false, motivo: 'peso não informado no título' };
  }
  if (unidades > 1) {
    // Tem peso e tem quantidade, mas separados: o peso pode ser o da unidade OU o total.
    // Preferir não afirmar do que errar por um fator de 10.
    return {
      unitario, unidades, total: null, confiavel: false,
      motivo: `${unidades} unidades e peso ${unitario} g em partes separadas do título — ambíguo`,
    };
  }
  // Peso absurdo para café costuma ser outra coisa lida por engano.
  if (unitario < 5 || unitario > 60000) {
    return { unitario, unidades: 1, total: null, confiavel: false, motivo: `peso improvável (${unitario} g)` };
  }
  return { unitario, unidades: 1, total: unitario, confiavel: true };
}

/** O que a fonte informou além do título. O briefing manda usar tudo que estiver disponível —
 *  categoria, descrição, marca, atributos — em vez de adivinhar pelo nome do anúncio. */
export interface DadosDaFonte {
  categoria?: string | null;
  descricao?: string | null;
  marca?: string | null;
  /** Campo "Embalagem" do marketplace: almofada, vácuo, pouch, lata. */
  embalagem?: string | null;
}

export function classificar(
  titulo: string,
  preco?: number | null,
  fonte?: DadosDaFonte | string | null,
): Classificacao {
  // Compatível com a chamada antiga `classificar(titulo, preco, categoria)`.
  const extra: DadosDaFonte = typeof fonte === 'string' ? { categoria: fonte } : (fonte ?? {});
  const t = limpar(titulo);
  const cat = limpar(extra.categoria ?? '');
  const emb = limpar(extra.embalagem ?? '');
  const desc = limpar(extra.descricao ?? '').slice(0, 400);
  const motivos: string[] = [];
  const temCafe = /\bcafe/.test(t) || /\bcafe/.test(cat);

  const base = (familia: Familia, relevancia: Relevancia, apresentacao: Apresentacao = null): Classificacao => {
    const peso = lerPeso(titulo);
    const classe = CLASSES.find(([re]) => re.test(t))?.[1] ?? null;
    const composicao = COMPOSICOES.find(([re]) => re.test(t) || re.test(desc))?.[1] ?? null;
    // Marca informada pela fonte vale mais que adivinhar pelo título, que quase sempre
    // começa com a palavra "Café".
    const daFonte = typeof extra.marca === 'string' ? extra.marca.trim() : '';
    const marca = daFonte || MARCAS.find(m => t.includes(m)) || null;
    const numero = t.match(/\b(100|102|103|104)\b/);
    // Preço por quilo só para café de verdade, com peso confiável. Em cápsula o peso do
    // título costuma ser o do café, não o da cápsula — mas só vale se não for ambíguo.
    const preco_por_kg = (familia === 'cafe' && peso.confiavel && peso.total && preco)
      ? +(preco / (peso.total / 1000)).toFixed(2)
      : null;
    if (!peso.confiavel && peso.motivo) motivos.push(peso.motivo);
    return {
      relevancia, familia, apresentacao, classe, composicao,
      filtro_numero: familia === 'filtro' && numero ? parseInt(numero[1], 10) : null,
      marca: marca ? marca.trim() : null,
      peso, preco_por_kg, motivos, versao: VERSAO_CLASSIFICADOR,
    };
  };

  // ---- 1. o que claramente não é do universo
  if (COR_CAFE.test(t)) { motivos.push('"café" aqui é a cor da peça, não o produto'); return base('fora', 'fora_escopo'); }
  if (NAO_ALIMENTO.test(t)) { motivos.push('produto de outra prateleira'); return base('fora', 'fora_escopo'); }
  if (COMIDA_COM_SABOR_CAFE.test(t) && !/\bcafe (torrado|em graos|soluvel|especial|gourmet|tradicional)\b/.test(t)) {
    motivos.push('alimento que cita café como sabor ou ingrediente');
    return base('fora', 'fora_escopo');
  }

  // ---- 2. famílias vizinhas: pertencem à cadeia, mas não comparam com café
  if (EQUIPAMENTO.test(t)) { motivos.push('equipamento'); return base('equipamento', 'relevante'); }
  if (FILTRO_PAPEL.test(t)) { motivos.push('filtro de papel'); return base('filtro', 'relevante'); }
  if (COADOR.test(t)) { motivos.push('coador'); return base('coador', 'relevante'); }
  if (EMBALAGEM.test(t)) { motivos.push('embalagem para envase'); return base('embalagem', 'relevante'); }
  // Acessório ganha de "café" no título quando o café é só o CONTEÚDO pretendido do objeto
  // ("pote para café", "caneca de café"). Só perde se o anúncio disser que vende café de
  // verdade — aí a apresentação aparece.
  const vendeCafeMesmo = CAPSULA.test(t) || SOLUVEL.test(t) || GRAOS.test(t) || MOIDO.test(t);
  if (ACESSORIO.test(t) && !vendeCafeMesmo) { motivos.push('acessório'); return base('acessorio', 'relevante'); }
  if (BEBIDA_PRONTA.test(t)) {
    motivos.push('bebida com leite ou pronta — não compara com café puro');
    return base('bebida_pronta', 'relevante', SOLUVEL.test(t) ? 'soluvel' : CAPSULA.test(t) ? 'capsula' : null);
  }

  // ---- 3. café: só aqui, e só se houver sinal de que é café
  if (!temCafe) { motivos.push('nenhum sinal de café no título'); return base('fora', 'fora_escopo'); }

  if (VERDE.test(t)) return base('cafe', 'relevante', 'verde');
  if (CAPSULA.test(t)) return base('cafe', 'relevante', 'capsula');
  if (SOLUVEL.test(t)) return base('cafe', 'relevante', 'soluvel');
  if (SACHE.test(t) && !MOIDO.test(t)) return base('cafe', 'relevante', 'sache');

  const ehGraos = GRAOS.test(t), ehMoido = MOIDO.test(t);
  if (ehGraos && ehMoido) {
    // "Torrado ou Moído", "grãos ou moído": o anúncio não decidiu, nós também não.
    motivos.push('o anúncio oferece grãos E moído — apresentação indefinida');
    return base('cafe', 'ambiguo', null);
  }
  if (ehGraos) return base('cafe', 'relevante', 'graos');
  if (ehMoido) return base('cafe', 'relevante', 'torrado_moido');

  // Sem dizer a apresentação no título, mas a EMBALAGEM entrega: almofada, tijolo a vácuo e
  // pouch são formatos de café moído — grão inteiro não é vendido assim. Sinal do varejo,
  // não chute, e fica registrado no motivo.
  if (EMBALAGEM_DE_MOIDO.test(t) || EMBALAGEM_DE_MOIDO.test(emb)) {
    motivos.push('apresentação deduzida da embalagem (almofada/vácuo/pouch são de café moído)');
    return base('cafe', 'relevante', 'torrado_moido');
  }

  // Diz "café" e nada mais. Não dá para chutar apresentação — era isto que a v1 fazia.
  motivos.push('diz café mas não informa a apresentação');
  return base('cafe', 'ambiguo', null);
}
