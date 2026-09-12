import { describe, it, expect } from 'vitest';
import { paraCentavos, deCentavos, paraBps, deBps } from './dinheiro';

describe('o vendedor digita, o banco guarda centavos', () => {
  it('aceita vírgula, ponto e milhar', () => {
    expect(paraCentavos('23,90')).toBe(2390);
    expect(paraCentavos('23.90')).toBe(2390);
    expect(paraCentavos('1.234,56')).toBe(123456);
    expect(paraCentavos('R$ 23,9')).toBe(2390);
    expect(paraCentavos('24')).toBe(2400);
  });

  it('não perde centavo em valores que o float erra', () => {
    // 0,29 * 100 em float dá 28,999999999999996.
    expect(paraCentavos('0,29')).toBe(29);
    expect(paraCentavos('19,99')).toBe(1999);
  });

  it('recusa o que não é dinheiro', () => {
    expect(paraCentavos('')).toBeNull();
    expect(paraCentavos('abc')).toBeNull();
    expect(paraCentavos('1,234')).toBeNull();
  });

  it('volta para o formato do campo', () => {
    expect(deCentavos(2390)).toBe('23,90');
    expect(deCentavos(5)).toBe('0,05');
    expect(deCentavos(null)).toBe('');
  });
});

describe('percentual em pontos-base', () => {
  it('lê inteiro e fração', () => {
    expect(paraBps('2')).toBe(200);
    expect(paraBps('2,5')).toBe(250);
    expect(paraBps('6%')).toBe(600);
  });

  it('não passa de 100%', () => {
    expect(paraBps('150')).toBe(10000);
  });

  it('volta sem zero sobrando', () => {
    expect(deBps(200)).toBe('2');
    expect(deBps(250)).toBe('2,5');
    expect(deBps(625)).toBe('6,25');
  });
});
