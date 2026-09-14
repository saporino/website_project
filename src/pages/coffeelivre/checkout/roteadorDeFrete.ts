// Coffee LiVRE — roteador de frete (a parte que decide, sem saber de API).
//
// O provedor (demo hoje, transportadoras reais na Unidade 10) devolve opções
// cruas: transportadora, serviço, preço, prazo. Este módulo só CLASSIFICA:
//   • mais econômico       — menor preço (empate: menor prazo)
//   • mais rápido          — menor prazo (empate: menor preço)
//   • melhor custo-benefício — menor preço + prazo × valor do dia
// Como a cotação é refeita para cada carrinho, a classificação muda sozinha com
// a quantidade: com 1 pacote a transportadora A pode ganhar; com 4, a B.
// Nunca empurra mais quantidade: não há sugestão "leve mais para o frete sair
// melhor" aqui.

export interface EntregaPorVendedor {
  seller_id: string;
  loja_nome: string;
  frete_cents: number;
  peso_g: number;
}

export interface OpcaoDeFrete {
  provedor: string;
  codigo: string;
  transportadora: string;
  servico: string;
  prazo_dias: number;
  total_cents: number;
  entregas: EntregaPorVendedor[];
}

export type Etiqueta = 'mais_economico' | 'mais_rapido' | 'melhor_custo_beneficio';

export interface OpcaoClassificada extends OpcaoDeFrete {
  etiquetas: Etiqueta[];
}

/** Quanto vale, em centavos, receber um dia antes. Premissa de UX, não de custo. */
export const VALOR_DO_DIA_CENTS = 150;

export const ROTULO_DA_ETIQUETA: Record<Etiqueta, string> = {
  mais_economico: 'Mais econômico',
  mais_rapido: 'Mais rápido',
  melhor_custo_beneficio: 'Melhor custo-benefício',
};

function menor<T>(lista: T[], chave: (x: T) => [number, number]): T | undefined {
  return [...lista].sort((a, b) => {
    const [a1, a2] = chave(a);
    const [b1, b2] = chave(b);
    return a1 - b1 || a2 - b2;
  })[0];
}

export function classificarOpcoes(opcoes: OpcaoDeFrete[], valorDoDia = VALOR_DO_DIA_CENTS): OpcaoClassificada[] {
  if (opcoes.length === 0) return [];
  const economico = menor(opcoes, o => [o.total_cents, o.prazo_dias]);
  const rapido = menor(opcoes, o => [o.prazo_dias, o.total_cents]);
  const custo = menor(opcoes, o => [o.total_cents + o.prazo_dias * valorDoDia, o.total_cents]);
  return opcoes.map(o => {
    const etiquetas: Etiqueta[] = [];
    if (o === economico) etiquetas.push('mais_economico');
    if (o === rapido) etiquetas.push('mais_rapido');
    if (o === custo) etiquetas.push('melhor_custo_beneficio');
    return { ...o, etiquetas };
  });
}

/** A opção que a tela pré-seleciona: o melhor custo-benefício. */
export function opcaoRecomendada(opcoes: OpcaoClassificada[]): OpcaoClassificada | null {
  return opcoes.find(o => o.etiquetas.includes('melhor_custo_beneficio')) ?? opcoes[0] ?? null;
}
