// O Copiloto é por regra nesta fase, e regra se testa.
import { describe, it, expect } from 'vitest';
import { recomendacoes, type ProdutoDoVendedor, type SinalDeMercado } from './copiloto';

const base = (x: Partial<ProdutoDoVendedor> = {}): ProdutoDoVendedor => ({
  id: 'p1', titulo: 'Café Teste 500g', status: 'ativo', ehCafe: true,
  completude: 100, faltando: [], vendaPorQuantidade: true,
  faixasAbaixoDoPiso: [], estoque: 30, notaModeracao: null, ...x,
});

describe('o que merece atenção', () => {
  it('loja aprovada com tudo em ordem não gera recomendação', () => {
    expect(recomendacoes({ lojaAtiva: true, produtos: [base()] })).toEqual([]);
  });

  it('loja inativa vem sempre em primeiro', () => {
    const r = recomendacoes({ lojaAtiva: false, produtos: [base({ status: 'rascunho' })] });
    expect(r[0].tipo).toBe('loja_inativa');
    expect(r[0].acao.caminho).toBe('vendedor/loja');
  });

  it('rascunho pede envio para publicação e leva ao produto', () => {
    const r = recomendacoes({ lojaAtiva: true, produtos: [base({ status: 'rascunho' })] });
    expect(r[0].tipo).toBe('rascunho');
    expect(r[0].acao.caminho).toBe('vendedor/produtos/p1');
  });

  it('faixa abaixo do piso alerta com as quantidades', () => {
    const r = recomendacoes({ lojaAtiva: true, produtos: [base({ faixasAbaixoDoPiso: [3, 4] })] });
    expect(r[0].tipo).toBe('abaixo_do_piso');
    expect(r[0].explicacao).toContain('3 unidades e 4 unidades');
  });

  it('recusado traz o motivo da moderação', () => {
    const r = recomendacoes({ lojaAtiva: true, produtos: [base({ status: 'recusado', notaModeracao: 'foto sem rótulo legível' })] });
    expect(r[0].explicacao).toContain('foto sem rótulo legível');
  });

  it('produto no ar sem estoque é avisado', () => {
    const r = recomendacoes({ lojaAtiva: true, produtos: [base({ estoque: 0 })] });
    expect(r.map(x => x.tipo)).toContain('sem_estoque');
  });

  it('Passport abaixo de 80% diz o que falta', () => {
    const r = recomendacoes({ lojaAtiva: true, produtos: [base({ completude: 60, faltando: ['torra', 'moagem'] })] });
    const p = r.find(x => x.tipo === 'passport');
    expect(p?.titulo).toContain('60% completo');
    expect(p?.explicacao).toContain('torra e moagem');
  });

  it('café no ar sem escada recebe sugestão', () => {
    const r = recomendacoes({ lojaAtiva: true, produtos: [base({ vendaPorQuantidade: false })] });
    expect(r.map(x => x.tipo)).toContain('sem_escada');
  });
});

describe('o que NÃO merece atenção', () => {
  it('café comercial 100% completo não é cobrado de nada', () => {
    const r = recomendacoes({ lojaAtiva: true, produtos: [base({ completude: 100 })] });
    expect(r.find(x => x.tipo === 'passport')).toBeUndefined();
  });

  it('equipamento nunca recebe cobrança de Passport nem de escada', () => {
    const r = recomendacoes({ lojaAtiva: true, produtos: [base({ ehCafe: false, completude: null, vendaPorQuantidade: false })] });
    expect(r.find(x => x.tipo === 'passport')).toBeUndefined();
    expect(r.find(x => x.tipo === 'sem_escada')).toBeUndefined();
  });

  it('produto em moderação não vira alerta — não há o que o vendedor fazer', () => {
    expect(recomendacoes({ lojaAtiva: true, produtos: [base({ status: 'em_moderacao' })] })).toEqual([]);
  });

  it('rascunho não é cobrado por falta de escada: ainda não está no ar', () => {
    const r = recomendacoes({ lojaAtiva: true, produtos: [base({ status: 'rascunho', vendaPorQuantidade: false })] });
    expect(r.find(x => x.tipo === 'sem_escada')).toBeUndefined();
  });
});

describe('disciplina da tela', () => {
  it('nunca passa de três recomendações', () => {
    const r = recomendacoes({
      lojaAtiva: false,
      produtos: [
        base({ id: 'a', status: 'recusado' }),
        base({ id: 'b', faixasAbaixoDoPiso: [4] }),
        base({ id: 'c', status: 'rascunho' }),
        base({ id: 'd', estoque: 0 }),
        base({ id: 'e', completude: 40, faltando: ['torra'] }),
        base({ id: 'f', vendaPorQuantidade: false }),
      ],
    });
    expect(r.length).toBe(3);
    expect(r.map(x => x.tipo)).toEqual(['loja_inativa', 'recusado', 'abaixo_do_piso']);
  });

  it('cinco rascunhos viram UM cartão com a contagem', () => {
    const produtos = ['a', 'b', 'c', 'd', 'e'].map(id => base({ id, status: 'rascunho' }));
    const r = recomendacoes({ lojaAtiva: true, produtos });
    expect(r.filter(x => x.tipo === 'rascunho').length).toBe(1);
    expect(r[0].titulo).toBe('5 produtos em rascunho');
    expect(r[0].acao.caminho).toBe('vendedor/produtos');
  });

  it('Passport aponta primeiro o produto MAIS incompleto', () => {
    const r = recomendacoes({
      lojaAtiva: true,
      produtos: [
        base({ id: 'bom', titulo: 'Café Bom', completude: 70, faltando: ['notas'] }),
        base({ id: 'ruim', titulo: 'Café Ruim', completude: 20, faltando: ['torra'] }),
      ],
    });
    const p = r.find(x => x.tipo === 'passport');
    expect(p?.acao.caminho).toBe('vendedor/produtos/ruim');
    expect(p?.titulo).toContain('Café Ruim e mais 1');
  });
});

describe('comparação de mercado no Copiloto', () => {
  const sinal = (x: Partial<SinalDeMercado> = {}): SinalDeMercado => ({
    produtoId: 'p1', titulo: 'Café Teste 500g', tipo: 'acima_da_mediana',
    tituloDaRecomendacao: 'Seu preço está 12% acima da mediana de cafés equivalentes.',
    explicacao: 'Você pode ir para R$ 26,79 e continuar acima do seu piso.', sugestaoCents: 2679, ...x,
  });

  it('preço acima da mediana vira recomendação com botão de aplicar', () => {
    const r = recomendacoes({ lojaAtiva: true, produtos: [base()], mercado: [sinal()] });
    expect(r[0].tipo).toBe('preco_mercado');
    expect(r[0].aplicarPreco).toEqual({ produtoId: 'p1', precoCents: 2679 });
    expect(r[0].titulo).toBe('Café Teste 500g: Seu preço está 12% acima da mediana de cafés equivalentes.');
  });

  it('preço competitivo não ocupa espaço de alerta', () => {
    const r = recomendacoes({ lojaAtiva: true, produtos: [base()], mercado: [sinal({ tipo: 'competitivo', sugestaoCents: null })] });
    expect(r).toEqual([]);
  });

  it('amostra insuficiente não inventa recomendação', () => {
    const r = recomendacoes({ lojaAtiva: true, produtos: [base()], mercado: [sinal({ tipo: 'amostra_insuficiente', sugestaoCents: null })] });
    expect(r.find(x => x.tipo === 'preco_mercado')).toBeUndefined();
  });

  it('acima da mediana tem prioridade sobre abaixo', () => {
    const r = recomendacoes({
      lojaAtiva: true, produtos: [base()],
      mercado: [sinal({ produtoId: 'barato', tipo: 'abaixo_da_mediana', sugestaoCents: 2600 }), sinal({ produtoId: 'caro' })],
    });
    expect(r[0].aplicarPreco?.produtoId).toBe('caro');
  });

  it('loja inativa continua antes do preço', () => {
    const r = recomendacoes({ lojaAtiva: false, produtos: [base()], mercado: [sinal()] });
    expect(r.map(x => x.tipo)).toEqual(['loja_inativa', 'preco_mercado']);
  });
});
