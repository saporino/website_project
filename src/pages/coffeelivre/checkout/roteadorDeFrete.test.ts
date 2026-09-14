import { describe, expect, it } from 'vitest';
import { classificarOpcoes, opcaoRecomendada, type OpcaoDeFrete } from './roteadorDeFrete';

// Mesma tabela fictícia de lv_settings.frete_demo: base + por kg cobrado (arredondado para cima).
const TABELA = [
  { codigo: 'demo_economico', transportadora: 'A', servico: 'Econômico', base: 1290, kg: 250, prazo: 8 },
  { codigo: 'demo_padrao', transportadora: 'C', servico: 'Padrão', base: 1590, kg: 180, prazo: 5 },
  { codigo: 'demo_expresso', transportadora: 'B', servico: 'Expresso', base: 2190, kg: 450, prazo: 3 },
];

function cotar(pacotes: number, gramatura = 500, embalagem = 14): OpcaoDeFrete[] {
  const peso = pacotes * (gramatura + embalagem);
  const kg = Math.max(1, Math.ceil(peso / 1000));
  return TABELA.map(t => ({
    provedor: 'demo', codigo: t.codigo, transportadora: t.transportadora, servico: t.servico,
    prazo_dias: t.prazo, total_cents: t.base + t.kg * kg, entregas: [],
  }));
}

describe('classificarOpcoes', () => {
  it('marca econômico, rápido e custo-benefício', () => {
    const r = classificarOpcoes(cotar(1));
    expect(r.find(o => o.etiquetas.includes('mais_economico'))?.codigo).toBe('demo_economico');
    expect(r.find(o => o.etiquetas.includes('mais_rapido'))?.codigo).toBe('demo_expresso');
    expect(r.filter(o => o.etiquetas.includes('melhor_custo_beneficio'))).toHaveLength(1);
  });

  it('a mais econômica muda com a quantidade (roteador por quantidade)', () => {
    const economica = (n: number) => classificarOpcoes(cotar(n)).find(o => o.etiquetas.includes('mais_economico'))?.transportadora;
    expect(economica(1)).toBe('A');
    expect(economica(8)).toBe('C');
  });

  it('empate de preço desempata pelo prazo', () => {
    const base = cotar(1);
    base[1] = { ...base[1], total_cents: base[0].total_cents };
    expect(classificarOpcoes(base).find(o => o.etiquetas.includes('mais_economico'))?.codigo).toBe('demo_padrao');
  });

  it('sem opções, nada; recomendada é a de custo-benefício', () => {
    expect(classificarOpcoes([])).toEqual([]);
    const r = classificarOpcoes(cotar(2));
    expect(opcaoRecomendada(r)?.etiquetas).toContain('melhor_custo_beneficio');
  });
});
