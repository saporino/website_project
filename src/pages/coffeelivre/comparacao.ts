// LiVRE Copiloto — comparação de mercado.
//
// Funções puras. A comparação só vale se comparar o que é comparável:
//
//   COMPARAÇÃO DIRETA   mesma gramatura, classificação, espécie, torra e
//                       moagem (e ABIC, quando o café do vendedor tem ABIC).
//   SEMELHANTES         mesma classificação, ou mesma gramatura e moagem,
//                       mas com alguma diferença — aparecem para contexto,
//                       NUNCA entram na mediana.
//
// Um especial de 250 g nunca entra na comparação direta de um tradicional
// de 500 g.
//
// E a comparação não termina em informação: termina numa recomendação com
// opções de preço que respeitam o piso. Nunca "seja o mais barato".
//
// Dinheiro em centavos inteiros; percentual em pontos-base.

export interface ProdutoDeMercado {
  id: string;
  storeId: string;
  lojaNome: string;
  titulo: string;
  slug: string;
  precoCents: number;
  gramaturaG: number | null;
  atributos: Record<string, string>;
  disponivel?: number;
}

export type Relacao = 'direto' | 'semelhante' | 'outro';

export interface ItemComparado {
  produto: ProdutoDeMercado;
  precoKgCents: number;
  /** O que difere do café do vendedor (vazio na comparação direta). */
  diferencas: string[];
}

export type Posicao = 'abaixo_da_faixa' | 'faixa_inferior' | 'na_mediana' | 'faixa_superior' | 'acima_da_faixa';

export interface Estatisticas {
  quantidade: number;
  seuKgCents: number;
  menorKgCents: number;
  maiorKgCents: number;
  medianaKgCents: number;
  /** Mediana convertida para a gramatura do café do vendedor. */
  medianaPacoteCents: number;
  menorPacoteCents: number;
  maiorPacoteCents: number;
  /** (seu − mediana) ÷ mediana, em pontos-base. */
  distanciaBps: number;
  posicao: Posicao;
}

export interface ComparacaoDeMercado {
  diretos: ItemComparado[];
  semelhantes: ItemComparado[];
  /** Atributos que faltam no café do vendedor para existir comparação direta. */
  faltandoParaDireto: string[];
  amostraSuficiente: boolean;
  minimoAmostra: number;
  estatisticas: Estatisticas | null;
}

/** Atributos que definem "o mesmo café" para a comparação direta. */
export const CHAVES_DE_EQUIVALENCIA = ['classificacao', 'especie', 'torra', 'moagem'] as const;

/** O que pode justificar preço acima da mediana. */
const DIFERENCIAIS = ['pontuacao', 'certificacoes', 'regiao', 'variedade', 'fazenda', 'processo'];

export const ROTULO_DO_ATRIBUTO: Record<string, string> = {
  classificacao: 'classificação', especie: 'espécie', torra: 'torra', moagem: 'moagem', gramatura: 'gramatura',
  certificacoes: 'certificação', pontuacao: 'pontuação', regiao: 'região', variedade: 'variedade',
  fazenda: 'fazenda', processo: 'processo',
};

export const MINIMO_AMOSTRA = 3;
export const MARGEM_MEDIANA_BPS = 500;

// ---------------------------------------------------------------------
const normal = (v: string | undefined) => (v ?? '').trim().toLocaleLowerCase('pt-BR');
const div = (a: number, b: number) => Math.floor((2 * a + b) / (2 * b));

export function precoPorKg(precoCents: number, gramaturaG: number): number {
  return div(precoCents * 1000, gramaturaG);
}

export function temAbic(atributos: Record<string, string>): boolean {
  return (atributos.certificacoes ?? '').split(',').some(c => normal(c) === 'abic');
}

function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : div(v[meio - 1] + v[meio], 2);
}

/** Como um candidato se relaciona com o café do vendedor. */
export function relacionar(alvo: ProdutoDeMercado, candidato: ProdutoDeMercado): { relacao: Relacao; diferencas: string[] } {
  // Os próprios produtos do vendedor não são "mercado".
  if (candidato.id === alvo.id || candidato.storeId === alvo.storeId) return { relacao: 'outro', diferencas: [] };
  if (!alvo.gramaturaG || !candidato.gramaturaG || candidato.precoCents <= 0) return { relacao: 'outro', diferencas: [] };

  const diferencas: string[] = [];
  if (alvo.gramaturaG !== candidato.gramaturaG) diferencas.push(`gramatura ${candidato.gramaturaG} g`);
  let chavesCompletas = true;
  for (const chave of CHAVES_DE_EQUIVALENCIA) {
    const a = normal(alvo.atributos[chave]);
    const c = normal(candidato.atributos[chave]);
    if (!a || !c) { chavesCompletas = false; if (c) diferencas.push(`${ROTULO_DO_ATRIBUTO[chave]} ${candidato.atributos[chave]}`); continue; }
    if (a !== c) diferencas.push(`${ROTULO_DO_ATRIBUTO[chave]} ${candidato.atributos[chave]}`);
  }
  if (temAbic(alvo.atributos) && !temAbic(candidato.atributos)) diferencas.push('sem ABIC');

  if (chavesCompletas && diferencas.length === 0) return { relacao: 'direto', diferencas };

  const mesmaClassificacao = !!normal(alvo.atributos.classificacao)
    && normal(alvo.atributos.classificacao) === normal(candidato.atributos.classificacao);
  const mesmoFormato = alvo.gramaturaG === candidato.gramaturaG
    && !!normal(alvo.atributos.moagem) && normal(alvo.atributos.moagem) === normal(candidato.atributos.moagem);
  if (mesmaClassificacao || mesmoFormato) {
    return { relacao: 'semelhante', diferencas: diferencas.length ? diferencas : ['ficha incompleta para comparação direta'] };
  }
  return { relacao: 'outro', diferencas };
}

export function compararComMercado(
  alvo: ProdutoDeMercado,
  candidatos: ProdutoDeMercado[],
  opcoes: { minimoAmostra?: number; margemBps?: number } = {},
): ComparacaoDeMercado {
  const minimo = opcoes.minimoAmostra ?? MINIMO_AMOSTRA;
  const margem = opcoes.margemBps ?? MARGEM_MEDIANA_BPS;
  const faltando = CHAVES_DE_EQUIVALENCIA.filter(c => !normal(alvo.atributos[c]));
  if (!alvo.gramaturaG) faltando.unshift('gramatura' as never);

  const diretos: ItemComparado[] = [];
  const semelhantes: ItemComparado[] = [];
  for (const c of candidatos) {
    const { relacao, diferencas } = relacionar(alvo, c);
    if (relacao === 'outro') continue;
    const item = { produto: c, precoKgCents: precoPorKg(c.precoCents, c.gramaturaG!), diferencas };
    (relacao === 'direto' ? diretos : semelhantes).push(item);
  }
  const porKg = (a: ItemComparado, b: ItemComparado) => a.precoKgCents - b.precoKgCents;
  diretos.sort(porKg);
  semelhantes.sort(porKg);

  const amostraSuficiente = diretos.length >= minimo && !!alvo.gramaturaG && alvo.precoCents > 0;
  let estatisticas: Estatisticas | null = null;
  if (amostraSuficiente) {
    const g = alvo.gramaturaG!;
    const kgs = diretos.map(d => d.precoKgCents);
    const seu = precoPorKg(alvo.precoCents, g);
    const med = mediana(kgs);
    const menor = kgs[0];
    const maior = kgs[kgs.length - 1];
    const distancia = Math.round(((seu - med) * 10000) / med);
    const posicao: Posicao = seu < menor ? 'abaixo_da_faixa'
      : seu > maior ? 'acima_da_faixa'
      : Math.abs(distancia) <= margem ? 'na_mediana'
      : seu < med ? 'faixa_inferior' : 'faixa_superior';
    estatisticas = {
      quantidade: diretos.length,
      seuKgCents: seu,
      menorKgCents: menor,
      maiorKgCents: maior,
      medianaKgCents: med,
      medianaPacoteCents: div(med * g, 1000),
      menorPacoteCents: div(menor * g, 1000),
      maiorPacoteCents: div(maior * g, 1000),
      distanciaBps: distancia,
      posicao,
    };
  }

  return { diretos, semelhantes, faltandoParaDireto: faltando, amostraSuficiente, minimoAmostra: minimo, estatisticas };
}

// ---------------------------------------------------------------------
// Recomendação
// ---------------------------------------------------------------------
export type TipoDeRecomendacao =
  | 'amostra_insuficiente' | 'competitivo' | 'acima_com_diferenciais'
  | 'acima_da_mediana' | 'abaixo_da_mediana' | 'piso_impede';

export type ChaveDaOpcao = 'recomendado' | 'mediana' | 'mediana_menos_1' | 'manter';

export interface OpcaoDePreco {
  chave: ChaveDaOpcao;
  rotulo: string;
  precoCents: number;
  /** Abaixo do piso nunca é aplicado pelo Copiloto. */
  abaixoDoPiso: boolean;
}

export interface RecomendacaoDePreco {
  tipo: TipoDeRecomendacao;
  titulo: string;
  explicacao: string;
  /** Preço que o Copiloto recomenda aplicar, ou null quando recomenda manter. */
  sugestaoCents: number | null;
  opcoes: OpcaoDePreco[];
}

const brl = (c: number) => `R$ ${Math.floor(c / 100).toLocaleString('pt-BR')},${String(c % 100).padStart(2, '0')}`;
const porcento = (bps: number) => `${Math.round(Math.abs(bps) / 100)}%`;

/** Tem diferenciais que a maioria dos equivalentes não tem? */
export function temDiferenciais(alvo: ProdutoDeMercado, diretos: ItemComparado[]): boolean {
  const conta = (a: Record<string, string>) => DIFERENCIAIS.filter(k => normal(a[k])).length;
  const meu = conta(alvo.atributos);
  if (meu < 2 || !diretos.length) return false;
  const deles = mediana(diretos.map(d => conta(d.produto.atributos)));
  return meu >= deles + 2;
}

export function recomendarPreco(
  comparacao: ComparacaoDeMercado,
  alvo: ProdutoDeMercado,
  pisoCents: number | null,
  opcoes: { margemBps?: number } = {},
): RecomendacaoDePreco {
  const margem = opcoes.margemBps ?? MARGEM_MEDIANA_BPS;
  const preco = alvo.precoCents;
  const abaixo = (p: number) => pisoCents != null && p < pisoCents;
  const e = comparacao.estatisticas;

  if (!comparacao.amostraSuficiente || !e) {
    const n = comparacao.diretos.length;
    return {
      tipo: 'amostra_insuficiente',
      titulo: 'Ainda não há cafés equivalentes suficientes para comparar',
      explicacao: comparacao.faltandoParaDireto.length
        ? `Complete ${comparacao.faltandoParaDireto.map(c => ROTULO_DO_ATRIBUTO[c] ?? c).join(', ')} para encontrarmos cafés realmente equivalentes.`
        : `Encontramos ${n} ${n === 1 ? 'café equivalente' : 'cafés equivalentes'}. Precisamos de pelo menos ${comparacao.minimoAmostra} para uma mediana confiável — não inventamos inteligência com poucos dados.`,
      sugestaoCents: null,
      opcoes: [],
    };
  }

  const med = e.medianaPacoteCents;
  const menos1 = div(med * 99, 100);
  const base = (recomendado: number): OpcaoDePreco[] => {
    const lista: OpcaoDePreco[] = [
      { chave: 'recomendado', rotulo: 'Preço recomendado pelo LiVRE', precoCents: recomendado, abaixoDoPiso: abaixo(recomendado) },
      { chave: 'mediana', rotulo: 'Igualar mediana', precoCents: med, abaixoDoPiso: abaixo(med) },
      { chave: 'mediana_menos_1', rotulo: '1% abaixo da mediana', precoCents: menos1, abaixoDoPiso: abaixo(menos1) },
      { chave: 'manter', rotulo: 'Manter meu preço', precoCents: preco, abaixoDoPiso: false },
    ];
    // Opções que caem no mesmo preço não viram botões repetidos.
    const vistos = new Set<number>();
    return lista.filter(o => (o.chave === 'manter' || !vistos.has(o.precoCents)) && (vistos.add(o.precoCents), true));
  };

  if (Math.abs(e.distanciaBps) <= margem) {
    return {
      tipo: 'competitivo',
      titulo: 'Seu preço está competitivo. Não recomendamos alteração.',
      explicacao: `Você está a ${porcento(e.distanciaBps)} da mediana de ${e.quantidade} cafés equivalentes.`,
      sugestaoCents: null,
      opcoes: base(preco),
    };
  }

  if (e.distanciaBps > 0) {
    if (temDiferenciais(alvo, comparacao.diretos)) {
      return {
        tipo: 'acima_com_diferenciais',
        titulo: `Seu preço está ${porcento(e.distanciaBps)} acima da mediana — e o seu café tem diferenciais.`,
        explicacao: 'Você possui diferenciais que justificam preço acima da mediana (origem, certificação ou pontuação informadas). Não recomendamos alteração.',
        sugestaoCents: null,
        opcoes: base(preco),
      };
    }
    let sugestao = med - 1;
    if (pisoCents != null && sugestao < pisoCents) {
      if (preco <= pisoCents) {
        return {
          tipo: 'piso_impede',
          titulo: `Seu preço está ${porcento(e.distanciaBps)} acima da mediana, mas já está no seu piso.`,
          explicacao: `A mediana dos equivalentes (${brl(med)}) fica abaixo do piso que você definiu (${brl(pisoCents)}). Não recomendamos reduzir.`,
          sugestaoCents: null,
          opcoes: base(preco),
        };
      }
      sugestao = pisoCents;
    }
    return {
      tipo: 'acima_da_mediana',
      titulo: `Seu preço está ${porcento(e.distanciaBps)} acima da mediana de cafés equivalentes.`,
      explicacao: sugestao === pisoCents
        ? `A mediana fica abaixo do seu piso. O menor preço que respeita o seu piso é ${brl(sugestao)}.`
        : pisoCents != null
          ? `Você pode ir para ${brl(sugestao)} e continuar acima do seu piso.`
          : `Você pode ir para ${brl(sugestao)}, logo abaixo da mediana. Informe seu preço mínimo para o Copiloto proteger sua margem.`,
      sugestaoCents: sugestao,
      opcoes: base(sugestao),
    };
  }

  // Abaixo da mediana: há espaço para subir, sem empurrar.
  const sugestao = Math.max(med - 1, preco);
  return {
    tipo: 'abaixo_da_mediana',
    titulo: `Seu preço está ${porcento(e.distanciaBps)} abaixo da mediana de cafés equivalentes.`,
    explicacao: `Há espaço para ir até ${brl(sugestao)} sem sair da faixa dos equivalentes. Manter um preço menor também é estratégia, se o objetivo for volume.`,
    sugestaoCents: sugestao,
    opcoes: base(sugestao),
  };
}
