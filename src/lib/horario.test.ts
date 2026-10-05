import { describe, it, expect } from 'vitest';
import { quandoEmSP, dataHoraEmSP, isoDeSaoPaulo, paraInputSP, faltamPara } from './horario';

// O risco que estes testes guardam: o painel aberto num aparelho fora do fuso de Brasília
// mostrava e gravava outra hora. Por isso tudo aqui é comparado contra o horário de SP,
// nunca contra o fuso de quem roda o teste.
describe('horário de São Paulo', () => {
  it('mostra a hora de Brasília, não a do aparelho', () => {
    // 5/10/2026 19:40 UTC = 16:40 em São Paulo
    expect(quandoEmSP('2026-10-05T19:40:00.000Z')).toBe('5 de outubro, 16:40');
  });

  it('formata data curta em Brasília', () => {
    expect(dataHoraEmSP('2026-10-05T19:40:00.000Z')).toBe('05/10/2026 16:40');
  });

  it('vira o dia pelo fuso certo', () => {
    // 2h UTC ainda é o dia anterior em São Paulo (23h)
    expect(quandoEmSP('2026-10-06T02:00:00.000Z')).toBe('5 de outubro, 23:00');
  });

  it('o que a pessoa digita é horário de São Paulo', () => {
    // digitou 14:00 → grava 17:00 UTC
    expect(isoDeSaoPaulo('2026-10-06T14:00')).toBe('2026-10-06T17:00:00.000Z');
  });

  it('digitar de madrugada não pula o dia', () => {
    expect(isoDeSaoPaulo('2026-10-06T00:30')).toBe('2026-10-06T03:30:00.000Z');
  });

  it('ida e volta não muda a hora', () => {
    const digitado = '2026-12-24T09:15';
    expect(paraInputSP(isoDeSaoPaulo(digitado))).toBe(digitado);
  });

  it('preenche o input com a hora de Brasília', () => {
    expect(paraInputSP('2026-10-05T19:40:00.000Z')).toBe('2026-10-05T16:40');
  });

  it('meia-noite em São Paulo aparece como 00:00, não 24:00', () => {
    expect(paraInputSP('2026-10-06T03:00:00.000Z')).toBe('2026-10-06T00:00');
    expect(quandoEmSP('2026-10-06T03:00:00.000Z')).toBe('6 de outubro, 00:00');
  });

  it('diz quanto falta', () => {
    const daqui3h = new Date(Date.now() + 3 * 3600e3).toISOString();
    expect(faltamPara(daqui3h)).toBe('em 3h');
    expect(faltamPara(new Date(Date.now() - 1000).toISOString())).toBe('a qualquer momento');
  });
});
