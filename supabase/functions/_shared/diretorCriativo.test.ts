import { describe, it, expect } from 'vitest';
import {
  systemDoDiretor, TIPOS, MODOS, LAYOUTS, ZONAS_DE_TEXTO,
  custoDoDiretorUSD, ESQUEMA_BRIEFING, type TipoId,
} from './diretorCriativo.ts';

const base = {
  intencao: 'quero um bom dia com meu café',
  tipo: 'bom_dia' as TipoId,
  canal: 'feed' as const,
  marca: 'Café Teste',
  dna: { tom: 'acolhedor' },
  temAtivoOficial: false,
};

describe('modo de saída — a decisão que faltava', () => {
  it('conhece os três modos', () => {
    expect(Object.keys(MODOS).sort()).toEqual(['hybrid', 'photo_first', 'post_first']);
  });

  it('todo tipo de conteúdo tem um modo padrão', () => {
    for (const [id, t] of Object.entries(TIPOS)) {
      expect(t.modo, `tipo ${id}`).toBeTruthy();
      expect(Object.keys(MODOS)).toContain(t.modo);
    }
  });

  it('oferta, comunicado e institucional pedem post, não foto', () => {
    // São peças de comunicação: sem estrutura de texto elas não cumprem o
    // trabalho, por mais bonita que a foto seja.
    expect(TIPOS.oferta.modo).toBe('post_first');
    expect(TIPOS.comunicado.modo).toBe('post_first');
    expect(TIPOS.institucional.modo).toBe('post_first');
  });

  it('lifestyle é o único que pende para foto pura', () => {
    expect(TIPOS.lifestyle.modo).toBe('photo_first');
  });

  it('o modo padrão do tipo entra no prompt', () => {
    expect(systemDoDiretor({ ...base, tipo: 'oferta' })).toContain('post_first');
    expect(systemDoDiretor({ ...base, tipo: 'lifestyle' })).toContain('photo_first');
  });
});

describe('repertório visual', () => {
  it('oferece famílias de layout suficientes para não repetir', () => {
    expect(Object.keys(LAYOUTS).length).toBeGreaterThanOrEqual(10);
  });

  it('oferece zonas de texto, inclusive a de não ter texto', () => {
    expect(Object.keys(ZONAS_DE_TEXTO)).toContain('sem_texto');
    expect(Object.keys(ZONAS_DE_TEXTO).length).toBeGreaterThanOrEqual(5);
  });

  it('layouts e zonas vão inteiros para o prompt', () => {
    const s = systemDoDiretor(base);
    for (const k of Object.keys(LAYOUTS)) expect(s, `layout ${k}`).toContain(k);
    for (const k of Object.keys(ZONAS_DE_TEXTO)) expect(s, `zona ${k}`).toContain(k);
  });
});

describe('texto na arte deixou de ser proibido, mas ganhou disciplina', () => {
  it('não proíbe mais texto legível', () => {
    // A v1 dizia "NUNCA escreva texto legível dentro da imagem" — era essa
    // linha que fazia a saída ter cara de foto.
    expect(systemDoDiretor(base)).not.toContain('NUNCA escreva texto legível');
  });

  it('limita a headline, porque gerador erra letra', () => {
    expect(systemDoDiretor(base)).toContain('MÁXIMO 5 palavras');
  });

  it('mantém preço e telefone fora da imagem', () => {
    const s = systemDoDiretor(base);
    expect(s).toContain('Nada de preço, porcentagem, data, telefone');
  });

  it('manda o Diretor escrever a headline — quem pediu não vai escrever', () => {
    expect(systemDoDiretor(base)).toContain('escreva você a headline');
  });
});

describe('anti-repetição estrutural', () => {
  it('sem histórico, não inventa restrição', () => {
    expect(systemDoDiretor(base)).not.toContain('ÚLTIMAS PEÇAS');
  });

  it('com histórico, exige estrutura diferente', () => {
    const s = systemDoDiretor({
      ...base,
      fingerprintsRecentes: ['hero_centrado / sem texto / xícara no centro'],
    });
    expect(s).toContain('ÚLTIMAS PEÇAS');
    expect(s).toContain('hero_centrado / sem texto / xícara no centro');
    // O ponto central: variar cenário não conta como variar.
    expect(s).toContain('Variar o cenário não basta');
  });

  it('pede a assinatura estrutural de volta, para alimentar a próxima', () => {
    expect(systemDoDiretor(base)).toContain('creative_fingerprint');
  });
});

describe('regras condicionais entram por seleção, não todas de uma vez', () => {
  it('regra de oferta só aparece em oferta', () => {
    expect(systemDoDiretor({ ...base, tipo: 'oferta' })).toContain('peça de OFERTA');
    expect(systemDoDiretor({ ...base, tipo: 'bom_dia' })).not.toContain('peça de OFERTA');
  });

  it('regra de ativo oficial só aparece quando há ativo', () => {
    expect(systemDoDiretor({ ...base, temAtivoOficial: true })).toContain('HÁ ATIVO OFICIAL');
    expect(systemDoDiretor({ ...base, temAtivoOficial: false })).toContain('NÃO há ativo oficial');
  });

  it('regra do canal é só a do canal pedido', () => {
    // O repertório de layouts vai inteiro (é catálogo), mas a seção CANAL
    // carrega apenas a regra do canal escolhido.
    const secao = (s: string) => s.slice(s.indexOf('CANAL:'), s.indexOf('CANAL:') + 300);
    expect(secao(systemDoDiretor({ ...base, canal: 'story' }))).toContain('terço central');
    expect(secao(systemDoDiretor({ ...base, canal: 'feed' }))).toContain('miniatura');
    expect(secao(systemDoDiretor({ ...base, canal: 'feed' }))).not.toContain('terço central');
  });

  it('múltiplas referências mudam a instrução', () => {
    const s = systemDoDiretor({ ...base, temAtivoOficial: true, qtdAtivos: 3 });
    expect(s).toContain('3 REFERÊNCIAS');
    expect(s).toContain('nunca como algo a copiar literalmente');
  });
});

describe('marca sem identidade cadastrada', () => {
  it('manda ser conservador em vez de inventar', () => {
    expect(systemDoDiretor({ ...base, dna: {} })).toContain('seja conservador');
  });
});

describe('esquema do briefing', () => {
  it('carrega os campos de decisão de post, não só de foto', () => {
    for (const campo of [
      'creative_output_mode', 'on_art_text', 'headline', 'layout_family',
      'text_zone_strategy', 'product_role', 'visual_density',
      'creative_fingerprint', 'final_prompt',
    ]) {
      expect(ESQUEMA_BRIEFING, `campo ${campo}`).toContain(campo);
    }
  });
});

describe('custo do Diretor', () => {
  it('usa o preço oficial do Sonnet 5: $2 entrada, $10 saída', () => {
    // 2.000 entrada = $0,004 · 800 saída = $0,008
    expect(custoDoDiretorUSD({ input_tokens: 2000, output_tokens: 800 })).toBeCloseTo(0.012, 6);
  });

  it('sem usage devolve null, nunca zero', () => {
    expect(custoDoDiretorUSD(null)).toBeNull();
    expect(custoDoDiretorUSD(undefined)).toBeNull();
  });
});
