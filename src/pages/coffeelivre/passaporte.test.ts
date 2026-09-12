// A completude do Passport não pode punir café comercial por não ser
// microlote. É a regra que protege o vendedor de inventar informação.
import { describe, it, expect } from 'vitest';
import { completudeDoPassport } from './passaporte';

// Os campos que as categorias de café declaram hoje no banco.
const CAFE = [
  'classificacao', 'origem', 'regiao', 'fazenda', 'produtor', 'especie', 'variedade',
  'processo', 'safra', 'lote', 'torra', 'moagem', 'pontuacao', 'notas', 'certificacoes',
  'data_torra', 'peso',
];
const MOEDOR = ['material', 'capacidade', 'voltagem', 'garantia'];

const TRADICIONAL_COMPLETO = {
  classificacao: 'Tradicional', especie: 'Blend', torra: 'Média', moagem: 'Média', peso: '500',
};

describe('café comercial', () => {
  it('tradicional com os cinco essenciais está 100% completo', () => {
    const c = completudeDoPassport(TRADICIONAL_COMPLETO, CAFE);
    expect(c?.percentual).toBe(100);
    expect(c?.nivel).toBe('essencial');
  });

  it('NÃO cobra fazenda, lote, safra nem pontuação de café tradicional', () => {
    const c = completudeDoPassport(TRADICIONAL_COMPLETO, CAFE);
    for (const campo of ['fazenda', 'lote', 'safra', 'pontuacao', 'variedade']) {
      expect(c?.exigidos).not.toContain(campo);
    }
  });

  it('extra forte segue a mesma régua do tradicional', () => {
    const c = completudeDoPassport({ ...TRADICIONAL_COMPLETO, classificacao: 'Extra Forte' }, CAFE);
    expect(c?.percentual).toBe(100);
  });

  it('faltando dois essenciais, fica em 60% e diz quais', () => {
    const c = completudeDoPassport({ classificacao: 'Tradicional', especie: 'Blend', peso: '500' }, CAFE);
    expect(c?.percentual).toBe(60);
    expect(c?.faltando).toEqual(['torra', 'moagem']);
  });
});

describe('a exigência sobe com o que o vendedor declara', () => {
  it('gourmet passa a pedir origem', () => {
    const c = completudeDoPassport({ ...TRADICIONAL_COMPLETO, classificacao: 'Gourmet' }, CAFE);
    expect(c?.nivel).toBe('origem');
    expect(c?.faltando).toEqual(['origem', 'regiao', 'processo', 'notas']);
    // 5 de 9
    expect(c?.percentual).toBe(56);
  });

  it('especial com só os essenciais fica pela metade', () => {
    const c = completudeDoPassport({ ...TRADICIONAL_COMPLETO, classificacao: 'Especial' }, CAFE);
    expect(c?.nivel).toBe('especial');
    // 5 de 11
    expect(c?.percentual).toBe(45);
  });

  it('especial completo chega a 100%', () => {
    const c = completudeDoPassport({
      ...TRADICIONAL_COMPLETO, classificacao: 'Especial',
      origem: 'Brasil', regiao: 'Mantiqueira de Minas', processo: 'Natural', notas: 'Mel',
      variedade: 'Bourbon Amarelo', pontuacao: '88',
    }, CAFE);
    expect(c?.percentual).toBe(100);
  });

  it('declarar pontuação 80+ sem classificação já exige o conjunto especial', () => {
    // Quem informa nota de café especial está fazendo uma afirmação de
    // especial — e passa a precisar sustentá-la.
    const c = completudeDoPassport({ ...TRADICIONAL_COMPLETO, classificacao: '', pontuacao: '84' }, CAFE);
    expect(c?.nivel).toBe('especial');
  });

  it('fazenda, produtor, safra e lote nunca são exigidos, nem de especial', () => {
    const c = completudeDoPassport({ ...TRADICIONAL_COMPLETO, classificacao: 'Especial' }, CAFE);
    for (const campo of ['fazenda', 'produtor', 'safra', 'lote']) {
      expect(c?.exigidos).not.toContain(campo);
    }
  });
});

describe('o que não é café', () => {
  it('moedor não tem Passport para medir', () => {
    expect(completudeDoPassport({ material: 'Aço' }, MOEDOR)).toBeNull();
  });

  it('só exige o que a categoria admite', () => {
    // Uma categoria sem "moagem" não nasce eternamente incompleta.
    const semMoagem = CAFE.filter(c => c !== 'moagem');
    const c = completudeDoPassport({ classificacao: 'Tradicional', especie: 'Blend', torra: 'Média', peso: '250' }, semMoagem);
    expect(c?.percentual).toBe(100);
    expect(c?.exigidos).not.toContain('moagem');
  });
});

describe('dado vazio continua vazio', () => {
  it('espaço em branco não conta como preenchido', () => {
    const c = completudeDoPassport({ ...TRADICIONAL_COMPLETO, torra: '   ' }, CAFE);
    expect(c?.faltando).toContain('torra');
    expect(c?.percentual).toBe(80);
  });
});
