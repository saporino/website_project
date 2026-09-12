// LiVRE Passport — quão completo está.
//
// A regra que manda aqui é a do próprio Passport: NÃO OBRIGAR CAFÉ
// COMERCIAL A FINGIR QUE É MICROLOTE. Um tradicional com classificação,
// espécie, torra, moagem e peso preenchidos está 100% completo, e é
// verdade — não existe fazenda nem lote para informar num blend de
// supermercado. Cobrar isso dele empurraria o vendedor a inventar.
//
// O quanto se exige sobe com o que o próprio vendedor declara:
//   Tradicional, Extra Forte, Superior -> essenciais
//   Gourmet, ou qualquer pontuação     -> essenciais + origem
//   Especial, ou pontuação >= 80       -> essenciais + origem + especial
//
// Fazenda, produtor, safra e lote nunca são exigidos: são ganho, não
// obrigação. Um microlote que os informa aparece melhor; um tradicional
// que não os tem não perde nada.

export const ESSENCIAIS = ['classificacao', 'especie', 'torra', 'moagem', 'peso'] as const;
export const DE_ORIGEM = ['origem', 'regiao', 'processo', 'notas'] as const;
export const DE_ESPECIAL = ['variedade', 'pontuacao'] as const;

export type NivelDeExigencia = 'essencial' | 'origem' | 'especial';

export interface Completude {
  percentual: number;
  nivel: NivelDeExigencia;
  exigidos: string[];
  preenchidos: string[];
  /** Na ordem em que devem ser pedidos, para a tela mostrar o próximo. */
  faltando: string[];
}

function pontuacaoDe(valor: string | undefined): number {
  const n = Number(String(valor ?? '').replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Completude do Passport de um produto.
 *
 * `chavesDaCategoria` são os atributos que a categoria declara. Só se
 * exige o que a categoria admite: sem isto, uma categoria sem "moagem"
 * nasceria sempre incompleta. E quando a categoria não tem nenhum campo
 * de Passport — um moedor — o resultado é `null`: não existe Passport para
 * medir, e mostrar "0% completo" num equipamento seria mentira.
 */
export function completudeDoPassport(
  valores: Record<string, string | undefined>,
  chavesDaCategoria: string[],
): Completude | null {
  const classe = (valores.classificacao ?? '').trim();
  const nota = pontuacaoDe(valores.pontuacao);

  let nivel: NivelDeExigencia = 'essencial';
  const exigidos: string[] = [...ESSENCIAIS];

  if (classe === 'Gourmet' || classe === 'Especial' || nota > 0) {
    exigidos.push(...DE_ORIGEM);
    nivel = 'origem';
  }
  if (classe === 'Especial' || nota >= 80) {
    exigidos.push(...DE_ESPECIAL);
    nivel = 'especial';
  }

  const admitidos = new Set(chavesDaCategoria);
  const aplicaveis = exigidos.filter(c => admitidos.has(c));
  if (!aplicaveis.length) return null;

  const cheio = (c: string) => (valores[c] ?? '').trim() !== '';
  const preenchidos = aplicaveis.filter(cheio);

  return {
    percentual: Math.round((preenchidos.length / aplicaveis.length) * 100),
    nivel,
    exigidos: aplicaveis,
    preenchidos,
    faltando: aplicaveis.filter(c => !cheio(c)),
  };
}
