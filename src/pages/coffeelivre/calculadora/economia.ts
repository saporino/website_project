// Calculadora de Economia LiVRE — o motor da conta.
//
// Funções puras e nenhum número de plataforma aqui dentro. As tarifas vêm
// de `lv_tarifas_simulacao`; este arquivo só sabe APLICAR regra: achar a
// faixa de preço e de peso, multiplicar, somar, comparar com o piso.
//
// TRÊS PRINCÍPIOS QUE O CÓDIGO GUARDA:
//
// 1. Desconhecido nunca vira zero. Um componente sem valor público fica
//    `null`, o pedido fica "incompleto", e o líquido passa a ser um TETO
//    (o real só pode ser menor). Daí se tira só o que é matematicamente
//    certo: se nem o teto alcança o piso, está abaixo do piso; se alcança,
//    é indeterminado.
//
// 2. Dinheiro em centavos inteiros. Percentual em pontos-base.
//    Arredondamento meio-para-cima, uma vez por componente.
//
// 3. O sistema não decide preço. As funções inversas respondem "a partir
//    de quanto", e a tela deixa a decisão com o vendedor.

import { montarEscada, type Faixa } from '../escada';

export type Plataforma = 'coffeelivre' | 'mercado_livre' | 'shopee' | 'amazon' | 'magalu';

export type Componente =
  | 'comissao' | 'tarifa_fixa_pedido' | 'tarifa_unidade' | 'logistica_pedido'
  | 'armazenagem_unidade' | 'pagamento' | 'mensalidade' | 'frete' | 'frete_gratis_limiar';

export type Confiabilidade =
  | 'verificado' | 'fonte_secundaria' | 'calculado' | 'premissa' | 'conflitante'
  | 'nao_publico' | 'em_estudo' | 'desatualizado' | 'nao_se_aplica'
  // Só no resultado: nenhuma faixa estudada cobre este pedido.
  | 'fora_da_tabela';

export interface Regra {
  id: string;
  plataforma: Plataforma;
  modalidade: string | null;
  componente: Componente;
  cenario: string | null;
  percentual_bps: number | null;
  valor_cents: number | null;
  valor_micros: number | null;
  minimo_cents: number | null;
  preco_min_cents: number | null;
  preco_max_cents: number | null;
  peso_sobre: 'envio' | 'unidade' | null;
  peso_min_g: number | null;
  peso_max_g: number | null;
  confiabilidade: Exclude<Confiabilidade, 'fora_da_tabela'>;
  natureza: 'benchmark' | 'hipotese_livre';
  rotulo: string | null;
  fonte: string | null;
  fonte_url: string | null;
  verificado_em: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  observacao: string | null;
  ordem: number;
}

export interface Premissas {
  /** Somado à gramatura para achar a faixa de peso do envio. */
  pesoEmbalagemG: number;
  /** Acima do piso, mas a menos desta margem dele, é "próximo". */
  margemProximoBps: number;
}

export const PREMISSAS_PADRAO: Premissas = { pesoEmbalagemG: 14, margemProximoBps: 500 };

export interface Alvo {
  plataforma: Plataforma;
  modalidade: string;
}

export interface Cenario {
  /** Preço de UMA unidade. */
  precoCents: number;
  gramaturaG: number;
  /** Unidades no pedido. */
  quantidade: number;
  /** Unidades vendidas por mês. */
  volumeMensal: number;
  pisoCents: number | null;
  pagamento: 'cartao' | 'pix';
  /** Valor do pedido, quando não é preço × quantidade (escada). */
  vendaCents?: number;
  /** Data de referência para vigência (AAAA-MM-DD). */
  hoje?: string;
}

export interface Linha {
  componente: Componente;
  rotulo: string;
  /** null = não disponível. NUNCA é convertido em zero. */
  valorCents: number | null;
  confiabilidade: Confiabilidade;
  regra: Regra | null;
}

export type SituacaoPiso = 'acima' | 'proximo' | 'abaixo' | 'indeterminado';

export interface ResultadoPedido {
  alvo: Alvo;
  quantidade: number;
  vendaCents: number;
  pesoEnvioG: number;
  linhas: Linha[];
  custoConhecidoCents: number;
  completo: boolean;
  /** Se incompleto, é o TETO: o líquido real só pode ser menor. */
  liquidoCents: number;
  liquidoUnidadeCents: number;
  /** Custos ÷ venda, em pontos-base. Só existe com a conta completa. */
  cargaBps: number | null;
  piso: { situacao: SituacaoPiso; diferencaUnidadeCents: number } | null;
  /** Mensalidade cheia do mês (null se desconhecida, 0 se não existe). */
  mensalidadeMensalCents: number | null;
}

export type Erro = { erro: string };

const ROTULO_PADRAO: Record<Componente, string> = {
  comissao: 'Comissão',
  tarifa_fixa_pedido: 'Tarifa fixa',
  tarifa_unidade: 'Tarifa por pacote',
  logistica_pedido: 'Logística',
  armazenagem_unidade: 'Armazenagem',
  pagamento: 'Pagamento',
  mensalidade: 'Mensalidade (rateada por pedido)',
  frete: 'Frete',
  frete_gratis_limiar: 'Frete grátis a partir de',
};

/** Ordem em que os custos aparecem na tela. */
export const ORDEM_DOS_COMPONENTES: Componente[] = [
  'comissao', 'tarifa_fixa_pedido', 'tarifa_unidade', 'logistica_pedido', 'frete',
  'pagamento', 'armazenagem_unidade', 'mensalidade',
];

// ---------------------------------------------------------------------
// Aritmética
// ---------------------------------------------------------------------
/** Percentual em pontos-base sobre centavos, meio-para-cima, só inteiros. */
export function aplicarBps(cents: number, bps: number): number {
  return Math.floor((cents * bps + 5000) / 10000);
}

/** Divisão inteira meio-para-cima (para números não negativos). */
function dividir(a: number, b: number): number {
  return Math.floor((2 * a + b) / (2 * b));
}

function arredondar(n: number): number {
  return n < 0 ? -dividir(-n, 1) : dividir(n, 1);
}

// ---------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------
const inteiroPositivo = (n: number) => Number.isInteger(n) && n > 0;

export function validarCenario(c: Cenario): string | null {
  if (!inteiroPositivo(c.precoCents)) return 'Informe um preço maior que zero.';
  if (!inteiroPositivo(c.gramaturaG)) return 'Informe a gramatura do pacote.';
  if (!inteiroPositivo(c.quantidade) || c.quantidade > 99) return 'A quantidade por pedido deve ser um número inteiro de 1 a 99.';
  if (!Number.isInteger(c.volumeMensal) || c.volumeMensal < 0) return 'O volume mensal deve ser um número inteiro, zero ou maior.';
  if (c.pisoCents != null && (!Number.isInteger(c.pisoCents) || c.pisoCents < 0)) return 'O piso deve ser um valor positivo.';
  if (c.vendaCents != null && !inteiroPositivo(c.vendaCents)) return 'O valor do pedido deve ser maior que zero.';
  return null;
}

// ---------------------------------------------------------------------
// Achar a regra
// ---------------------------------------------------------------------
function dentro(valor: number, min: number | null, max: number | null): boolean {
  return (min == null || valor >= min) && (max == null || valor <= max);
}

function dentroDoPeso(peso: number, min: number | null, max: number | null): boolean {
  // Mínimo exclusivo, máximo inclusivo: "de 0,5 a 1 kg".
  return (min == null || peso > min) && (max == null || peso <= max);
}

function regrasDoAlvo(regras: Regra[], alvo: Alvo): Regra[] {
  return regras.filter(r => r.plataforma === alvo.plataforma && (r.modalidade == null || r.modalidade === alvo.modalidade));
}

/** Modalidades que existem nas regras (as de modalidade nula não criam uma). */
export function modalidadesDasRegras(regras: Regra[]): Alvo[] {
  const vistos = new Set<string>();
  const saida: Alvo[] = [];
  for (const r of regras) {
    if (!r.modalidade) continue;
    const chave = `${r.plataforma}:${r.modalidade}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push({ plataforma: r.plataforma, modalidade: r.modalidade });
  }
  return saida;
}

// ---------------------------------------------------------------------
// Um pedido
// ---------------------------------------------------------------------
export function calcularPedido(
  regras: Regra[],
  alvo: Alvo,
  cenario: Cenario,
  premissas: Premissas = PREMISSAS_PADRAO,
): ResultadoPedido | Erro {
  const invalido = validarCenario(cenario);
  if (invalido) return { erro: invalido };

  const doAlvo = regrasDoAlvo(regras, alvo);
  const q = cenario.quantidade;
  const venda = cenario.vendaCents ?? cenario.precoCents * q;
  const pesoEnvio = q * (cenario.gramaturaG + premissas.pesoEmbalagemG);

  const componentes = new Set<Componente>(doAlvo.map(r => r.componente).filter(c => c !== 'frete_gratis_limiar'));
  const linhas: Linha[] = [];
  let mensalidadeMensal: number | null = 0;

  for (const componente of ORDEM_DOS_COMPONENTES) {
    if (!componentes.has(componente)) continue;

    const candidatas = doAlvo
      .filter(r => r.componente === componente)
      .filter(r => r.cenario == null || r.cenario === cenario.pagamento)
      .filter(r => dentro(venda, r.preco_min_cents, r.preco_max_cents))
      .filter(r => r.peso_sobre == null
        || dentroDoPeso(r.peso_sobre === 'envio' ? pesoEnvio : cenario.gramaturaG, r.peso_min_g, r.peso_max_g))
      // A regra da modalidade vence a regra geral da plataforma.
      .sort((a, b) => Number(b.modalidade != null) - Number(a.modalidade != null));
    const regra = candidatas[0] ?? null;

    if (!regra) {
      linhas.push({ componente, rotulo: ROTULO_PADRAO[componente], valorCents: null, confiabilidade: 'fora_da_tabela', regra: null });
      if (componente === 'mensalidade') mensalidadeMensal = null;
      continue;
    }

    const vencida = !!(cenario.hoje && regra.vigencia_fim && regra.vigencia_fim < cenario.hoje);
    const confiabilidade: Confiabilidade = vencida ? 'desatualizado' : regra.confiabilidade;
    let valor: number | null = null;

    switch (componente) {
      case 'comissao':
      case 'pagamento':
        if (regra.percentual_bps != null) {
          valor = Math.max(aplicarBps(venda, regra.percentual_bps), regra.minimo_cents ?? 0);
        }
        break;
      case 'tarifa_unidade':
        if (regra.valor_cents != null) valor = regra.valor_cents * q;
        break;
      case 'armazenagem_unidade':
        if (regra.valor_micros != null) valor = dividir(regra.valor_micros * q, 10000);
        else if (regra.valor_cents != null) valor = regra.valor_cents * q;
        break;
      case 'mensalidade':
        if (regra.valor_cents == null) {
          mensalidadeMensal = null;
        } else {
          mensalidadeMensal = regra.valor_cents;
          // Sem vendas no mês não há pedido para ratear: o mês paga cheio,
          // e isso aparece na projeção mensal, não aqui.
          valor = cenario.volumeMensal > 0 ? dividir(regra.valor_cents * q, cenario.volumeMensal) : 0;
        }
        break;
      default:
        if (regra.valor_cents != null) valor = regra.valor_cents;
    }

    linhas.push({ componente, rotulo: regra.rotulo ?? ROTULO_PADRAO[componente], valorCents: valor, confiabilidade, regra });
  }

  const custo = linhas.reduce((s, l) => s + (l.valorCents ?? 0), 0);
  const completo = linhas.every(l => l.valorCents != null);
  const liquido = venda - custo;
  const liquidoUnidade = arredondar(liquido / q);

  let piso: ResultadoPedido['piso'] = null;
  if (cenario.pisoCents != null) {
    const diferenca = liquidoUnidade - cenario.pisoCents;
    let situacao: SituacaoPiso;
    if (diferenca < 0) situacao = 'abaixo';            // vale mesmo com teto: o real é menor ainda
    else if (!completo) situacao = 'indeterminado';
    else if (diferenca * 10000 < cenario.pisoCents * premissas.margemProximoBps) situacao = 'proximo';
    else situacao = 'acima';
    piso = { situacao, diferencaUnidadeCents: diferenca };
  }

  return {
    alvo,
    quantidade: q,
    vendaCents: venda,
    pesoEnvioG: pesoEnvio,
    linhas,
    custoConhecidoCents: custo,
    completo,
    liquidoCents: liquido,
    liquidoUnidadeCents: liquidoUnidade,
    cargaBps: completo ? dividir(custo * 10000, venda) : null,
    piso,
    mensalidadeMensalCents: componentes.has('mensalidade') ? mensalidadeMensal : 0,
  };
}

export const ehErro = (r: ResultadoPedido | Erro): r is Erro => 'erro' in r;

// ---------------------------------------------------------------------
// Mês e ano
// ---------------------------------------------------------------------
export interface Periodo {
  meses: number;
  vendaCents: number;
  custoCents: number;
  liquidoCents: number;
  completo: boolean;
  /** Líquido do período menos piso × unidades do período. */
  diferencaPisoCents: number | null;
}

/**
 * Projeta um pedido típico sobre o volume do mês. Pedidos no mês =
 * volume ÷ unidades por pedido. A mensalidade entra cheia, uma vez por mês,
 * e não rateada — o rateio é só a forma de mostrá-la por pedido.
 */
export function projetar(r: ResultadoPedido, volumeMensal: number, meses: number, pisoCents: number | null): Periodo {
  const variavel = r.linhas.filter(l => l.componente !== 'mensalidade').reduce((s, l) => s + (l.valorCents ?? 0), 0);
  const vendaMes = dividir(r.vendaCents * volumeMensal, r.quantidade);
  const variavelMes = dividir(variavel * volumeMensal, r.quantidade);
  const mensalidade = r.mensalidadeMensalCents ?? 0;
  const custo = (variavelMes + mensalidade) * meses;
  const venda = vendaMes * meses;
  const liquido = venda - custo;
  return {
    meses,
    vendaCents: venda,
    custoCents: custo,
    liquidoCents: liquido,
    completo: r.completo && r.mensalidadeMensalCents != null,
    diferencaPisoCents: pisoCents == null ? null : liquido - pisoCents * volumeMensal * meses,
  };
}

// ---------------------------------------------------------------------
// Comparar duas plataformas
// ---------------------------------------------------------------------
export type Comparacao =
  | { tipo: 'exata'; diferencaCents: number }
  /** A plataforma atual está incompleta: o real dela é menor, a vantagem é pelo menos isto. */
  | { tipo: 'minima'; diferencaCents: number }
  | { tipo: 'indeterminada' };

export function comparar(atual: Periodo, livre: Periodo): Comparacao {
  if (!livre.completo) return { tipo: 'indeterminada' };
  const diferenca = livre.liquidoCents - atual.liquidoCents;
  if (atual.completo) return { tipo: 'exata', diferencaCents: diferenca };
  return { tipo: 'minima', diferencaCents: diferenca };
}

/** Quanto a mensalidade pesa sobre a economia simulada, em pontos-base. */
export function pesoDaMensalidade(mensalidadeCents: number, economiaMensalCents: number): number | null {
  if (mensalidadeCents <= 0 || economiaMensalCents <= 0) return null;
  return dividir(mensalidadeCents * 10000, economiaMensalCents);
}

// ---------------------------------------------------------------------
// Funções inversas
// ---------------------------------------------------------------------
export type Solucao =
  | { tipo: 'preco'; precoCents: number }
  | { tipo: 'indeterminado' }
  | { tipo: 'sem_solucao' };

/**
 * Menor preço por unidade que entrega pelo menos `alvoUnidadeCents`
 * líquidos por unidade, com a quantidade do cenário.
 *
 * Busca centavo a centavo a partir do próprio alvo, porque as tarifas têm
 * degraus (faixa de preço, faixa de peso) e o líquido não cresce sempre de
 * forma contínua. Se passar por um preço cujo custo não é público e o teto
 * já alcançaria o alvo, para e diz que não dá para determinar.
 */
export function precoParaLiquido(
  regras: Regra[],
  alvo: Alvo,
  cenario: Cenario,
  alvoUnidadeCents: number,
  premissas: Premissas = PREMISSAS_PADRAO,
): Solucao {
  if (!Number.isInteger(alvoUnidadeCents) || alvoUnidadeCents <= 0) return { tipo: 'sem_solucao' };
  const doAlvo = regrasDoAlvo(regras, alvo);
  const inicio = alvoUnidadeCents;
  const fim = Math.min(alvoUnidadeCents * 6 + 5000, 500000);
  for (let p = inicio; p <= fim; p++) {
    const r = calcularPedido(doAlvo, alvo, { ...cenario, precoCents: p, vendaCents: undefined }, premissas);
    if (ehErro(r)) return { tipo: 'sem_solucao' };
    if (r.liquidoUnidadeCents < alvoUnidadeCents) continue;
    return r.completo ? { tipo: 'preco', precoCents: p } : { tipo: 'indeterminado' };
  }
  return { tipo: 'sem_solucao' };
}

// ---------------------------------------------------------------------
// Escada de quantidade, com o mesmo motor da PDP
// ---------------------------------------------------------------------
export interface DegrauSimulado {
  quantidade: number;
  unitarioCents: number;
  totalCents: number;
  resultado: ResultadoPedido;
}

export function simularEscada(
  regras: Regra[],
  alvo: Alvo,
  cenario: Cenario,
  faixas: Faixa[],
  ate = 5,
  premissas: Premissas = PREMISSAS_PADRAO,
): DegrauSimulado[] {
  return montarEscada(cenario.precoCents, faixas, { ate }).flatMap(d => {
    const r = calcularPedido(regras, alvo, { ...cenario, quantidade: d.quantidade, vendaCents: d.total_cents }, premissas);
    return ehErro(r) ? [] : [{ quantidade: d.quantidade, unitarioCents: d.unitario_cents, totalCents: d.total_cents, resultado: r }];
  });
}

/**
 * Faltam unidades para o comprador alcançar frete grátis? Só responde
 * quando a regra existe e quando mais UMA unidade realmente cruza o limiar.
 */
export function unidadeParaFreteGratis(regras: Regra[], alvo: Alvo, precoCents: number, quantidade: number): number | null {
  const limiar = regrasDoAlvo(regras, alvo).find(r => r.componente === 'frete_gratis_limiar')?.valor_cents;
  if (limiar == null) return null;
  const agora = precoCents * quantidade;
  const comMaisUma = precoCents * (quantidade + 1);
  return agora < limiar && comMaisUma >= limiar ? limiar : null;
}
