// LiVRE Copiloto — primeira versão, por regra.
//
// Sem IA de propósito. Nesta fase o Copiloto precisa ser VERIFICÁVEL: cada
// recomendação sai de uma regra que se lê em uma linha e se testa. Um
// vendedor que recebe "faça isto" de um sistema que ele não entende para
// de confiar no primeiro erro.
//
// Três regras de apresentação, que valem tanto quanto as de negócio:
//   1. No máximo TRÊS recomendações. Dashboard com vinte alertas vira
//      papel de parede, e ninguém lê o vigésimo.
//   2. Cada recomendação diz o problema, o porquê e a ação — e leva à
//      tela onde a ação acontece.
//   3. Uma recomendação por TIPO. Cinco rascunhos viram "5 produtos em
//      rascunho", não cinco cartões iguais.

export interface ProdutoDoVendedor {
  id: string;
  titulo: string;
  status: string;
  ehCafe: boolean;
  /** Percentual do Passport, ou null quando não é café. */
  completude: number | null;
  faltando: string[];
  vendaPorQuantidade: boolean;
  /** Quantidades cuja faixa fura o piso do vendedor. */
  faixasAbaixoDoPiso: number[];
  estoque: number;
  notaModeracao: string | null;
}

export interface Recomendacao {
  tipo: string;
  prioridade: number;
  titulo: string;
  explicacao: string;
  acao: { rotulo: string; caminho: string };
}

const ROTULO_DO_CAMPO: Record<string, string> = {
  classificacao: 'classificação', especie: 'espécie', torra: 'torra', moagem: 'moagem',
  peso: 'peso', origem: 'origem', regiao: 'região', processo: 'processo', notas: 'notas sensoriais',
  variedade: 'variedade', pontuacao: 'pontuação',
};

/** "A" · "A e B" · "A, B e C" */
function listar(itens: string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

const nome = (p: ProdutoDoVendedor) => p.titulo.split(' — ')[0];

/** "Café X" ou "Café X e mais 2" — um cartão por tipo, sem esconder o volume. */
function sujeito(lista: ProdutoDoVendedor[]): string {
  return lista.length === 1 ? nome(lista[0]) : `${nome(lista[0])} e mais ${lista.length - 1}`;
}

const editar = (p: ProdutoDoVendedor) => `vendedor/produtos/${p.id}`;

export function recomendacoes(
  ctx: { lojaAtiva: boolean; produtos: ProdutoDoVendedor[] },
  limite = 3,
): Recomendacao[] {
  const r: Recomendacao[] = [];
  const { produtos } = ctx;

  // 10 — A loja inteira está fora da vitrine. Nada abaixo importa tanto.
  if (!ctx.lojaAtiva) {
    r.push({
      tipo: 'loja_inativa', prioridade: 10,
      titulo: 'Sua loja aguarda aprovação',
      explicacao: 'Seus produtos só aparecem na vitrine depois que a equipe do Coffee LiVRE aprovar a loja. Enquanto isso, deixe a ficha e os produtos prontos.',
      acao: { rotulo: 'Revisar minha loja', caminho: 'vendedor/loja' },
    });
  }

  // 20 — Recusado pela moderação: tem motivo, e tem conserto.
  const recusados = produtos.filter(p => p.status === 'recusado');
  if (recusados.length) {
    const p = recusados[0];
    r.push({
      tipo: 'recusado', prioridade: 20,
      titulo: `${sujeito(recusados)} foi recusado na moderação`,
      explicacao: p.notaModeracao
        ? `Motivo: ${p.notaModeracao}. Corrija e envie de novo.`
        : 'Revise o cadastro e envie de novo para moderação.',
      acao: { rotulo: 'Corrigir', caminho: editar(p) },
    });
  }

  // 30 — O vendedor definiu um piso e uma faixa dele mesmo fura.
  const abaixo = produtos.filter(p => p.faixasAbaixoDoPiso.length > 0);
  if (abaixo.length) {
    const p = abaixo[0];
    const qtds = listar(p.faixasAbaixoDoPiso.map(q => `${q} unidades`));
    r.push({
      tipo: 'abaixo_do_piso', prioridade: 30,
      titulo: `Uma faixa de ${sujeito(abaixo)} fica abaixo do seu preço mínimo`,
      explicacao: `A faixa de ${qtds} passa do piso que você definiu. Continua valendo — só confira se é isso mesmo que você quer receber.`,
      acao: { rotulo: 'Revisar faixas', caminho: editar(p) },
    });
  }

  // 40 — Cadastrado e esquecido: ninguém vê rascunho.
  const rascunhos = produtos.filter(p => p.status === 'rascunho');
  if (rascunhos.length) {
    r.push({
      tipo: 'rascunho', prioridade: 40,
      titulo: rascunhos.length === 1 ? `${nome(rascunhos[0])} está em rascunho` : `${rascunhos.length} produtos em rascunho`,
      explicacao: 'Rascunho não aparece para ninguém. Envie para publicação e ele entra na fila de moderação.',
      acao: rascunhos.length === 1
        ? { rotulo: 'Enviar para publicação', caminho: editar(rascunhos[0]) }
        : { rotulo: 'Ver produtos', caminho: 'vendedor/produtos' },
    });
  }

  // 50 — No ar e sem estoque no CD: aparece, mas não vende.
  const semEstoque = produtos.filter(p => p.status === 'ativo' && p.estoque <= 0);
  if (semEstoque.length) {
    r.push({
      tipo: 'sem_estoque', prioridade: 50,
      titulo: `${sujeito(semEstoque)} está sem estoque no CD`,
      explicacao: 'O produto está publicado, mas sem unidades disponíveis para despacho.',
      acao: { rotulo: 'Ver estoque', caminho: 'vendedor/estoque' },
    });
  }

  // 60 — Passport incompleto. Só café, e só abaixo de 80%.
  const incompletos = produtos
    .filter(p => p.ehCafe && p.completude !== null && p.completude < 80 && p.status !== 'arquivado')
    .sort((a, b) => (a.completude ?? 0) - (b.completude ?? 0));
  if (incompletos.length) {
    const p = incompletos[0];
    const falta = listar(p.faltando.slice(0, 3).map(c => ROTULO_DO_CAMPO[c] ?? c));
    r.push({
      tipo: 'passport', prioridade: 60,
      titulo: `O LiVRE Passport de ${sujeito(incompletos)} está ${p.completude}% completo`,
      explicacao: `Falta informar ${falta}. Informação real e completa ajuda o comprador a encontrar e escolher o seu café.`,
      acao: { rotulo: 'Completar Passport', caminho: editar(p) },
    });
  }

  // 70 — Café no ar sem desconto por quantidade.
  const semEscada = produtos.filter(p => p.ehCafe && p.status === 'ativo' && !p.vendaPorQuantidade);
  if (semEscada.length) {
    r.push({
      tipo: 'sem_escada', prioridade: 70,
      titulo: `${sujeito(semEscada)} ainda não tem desconto por quantidade`,
      explicacao: 'Quem leva mais pacotes paga menos por unidade — e você vende mais em cada pedido.',
      acao: { rotulo: 'Configurar', caminho: editar(semEscada[0]) },
    });
  }

  return r.sort((a, b) => a.prioridade - b.prioridade).slice(0, limite);
}
