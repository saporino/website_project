// "Trabalhe conosco" é da COFICO — e o link tem de respeitar o domínio.
//
// Este teste existe porque o erro é fácil de cometer e invisível em revisão: um
// `href="/trabalhe-conosco"` fixo funciona perfeitamente em localhost e serve a
// página da COFICO dentro de cafesaporino.com.br em produção.
import { describe, it, expect } from 'vitest';
import { linkTrabalheConosco, linkLegal, linkPortalPJ, COFICO_URL } from './config';

describe('linkTrabalheConosco', () => {
  it('do site da Saporino, SAI do domínio', () => {
    expect(linkTrabalheConosco('www.cafesaporino.com.br')).toBe(`${COFICO_URL}/trabalhe-conosco`);
    expect(linkTrabalheConosco('cafesaporino.com.br')).toBe(`${COFICO_URL}/trabalhe-conosco`);
  });

  it('no domínio da COFICO, fica relativo', () => {
    expect(linkTrabalheConosco('coficobrasil.com.br')).toBe('/trabalhe-conosco');
    expect(linkTrabalheConosco('www.coficobrasil.com.br')).toBe('/trabalhe-conosco');
  });

  it('no subdomínio do RepCo também é a COFICO', () => {
    expect(linkTrabalheConosco('repco.coficobrasil.com.br')).toBe('/trabalhe-conosco');
  });

  it('em localhost fica relativo, senão não dá para testar a página', () => {
    expect(linkTrabalheConosco('localhost')).toBe('/trabalhe-conosco');
    expect(linkTrabalheConosco('127.0.0.1')).toBe('/trabalhe-conosco');
  });

  it('não confunde um domínio que só TERMINA parecido', () => {
    // "naocoficobrasil.com.br" não é a COFICO. `endsWith` sem o ponto deixaria passar.
    expect(linkTrabalheConosco('naocoficobrasil.com.br')).toBe(`${COFICO_URL}/trabalhe-conosco`);
  });
});

describe('os outros links da COFICO continuam cientes do domínio', () => {
  it('páginas legais', () => {
    expect(linkLegal('privacidade', 'coficobrasil.com.br')).toBe('/privacidade');
    expect(linkLegal('privacidade', 'www.cafesaporino.com.br')).toBe('/coficobrasil/privacidade');
  });

  it('portal do cliente PJ', () => {
    expect(linkPortalPJ('cadastro', 'coficobrasil.com.br')).toBe('/cadastro');
    expect(linkPortalPJ('cadastro', 'www.cafesaporino.com.br')).toBe('/coficobrasil/cadastro');
  });
});
