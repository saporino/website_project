import { describe, it, expect } from 'vitest';
import { renderInline, type Bloco, type Documento } from '../pages/coficobrasil/legalMarkup';
import { COFICO, linkLegal, rotaLegalCofico, noDominioCofico, SLUGS_LEGAIS } from '../pages/coficobrasil/config';
import { renderInline as renderInlineMjs, paginaEstatica, LEGAL } from '../../scripts/legal-render.mjs';
import dados from '../pages/coficobrasil/legal.json';

const legal = dados as unknown as { atualizado: string; vars: Record<string, string>; documentos: Documento[] };
const textosDe = (b: Bloco) => [b.h2, b.p, ...(b.ul ?? [])].filter(Boolean) as string[];
const todosOsTextos = legal.documentos.flatMap(d => d.blocos.flatMap(textosDe));
const doc = (slug: string) => legal.documentos.find(d => d.slug === slug)!;

describe('as duas cópias do renderizador não podem divergir', () => {
  // O texto legal é renderizado DUAS vezes: pelo React (legalMarkup.ts) e pelo build
  // (scripts/legal-render.mjs, que gera o HTML lido sem JavaScript). Se alguém mexer em
  // uma e esquecer a outra, a Meta leria uma política diferente da que o cliente vê.
  it('produzem HTML idêntico para todo texto do legal.json', () => {
    expect(todosOsTextos.length).toBeGreaterThan(40);
    for (const t of todosOsTextos) {
      expect(renderInlineMjs(t, legal.vars)).toBe(renderInline(t, legal.vars));
    }
  });
  it('o script do build lê o mesmo arquivo', () => {
    expect(LEGAL.atualizado).toBe(legal.atualizado);
    expect((LEGAL.documentos as Documento[]).map(d => d.slug)).toEqual(legal.documentos.map(d => d.slug));
  });
});

describe('marcação', () => {
  it('negrito, ênfase e link externo', () => {
    const h = renderInline('**forte** e *leve* e [ir](https://exemplo.com)', {});
    expect(h).toContain('<strong>forte</strong>');
    expect(h).toContain('<em>leve</em>');
    expect(h).toContain('target="_blank"');
    expect(h).toContain('rel="noopener noreferrer"');
  });
  it('link interno é relativo e NÃO abre em outra aba', () => {
    const h = renderInline('veja [privacidade](privacidade)', {});
    expect(h).toContain('href="privacidade"');
    expect(h).not.toContain('target="_blank"');
  });
  it('curingas viram os dados da COFICO e o e-mail fica clicável', () => {
    const h = renderInline('fale com {email} ou {telefone}', legal.vars);
    expect(h).toContain(`mailto:${COFICO.email}`);
    expect(h).toContain(COFICO.phone);
  });
  it('não injeta HTML vindo do texto', () => {
    expect(renderInline('<script>x</script>', {})).toBe('&lt;script&gt;x&lt;/script&gt;');
  });
  it('curinga que não existe fica visível em vez de virar vazio', () => {
    expect(renderInline('{naoexiste}', {})).toBe('{naoexiste}');
  });
});

describe('os dados do controlador são os da COFICO, não da Saporino', () => {
  it('legal.json e config.ts contam a mesma história', () => {
    expect(legal.vars.cnpj).toBe(COFICO.cnpj);
    expect(legal.vars.email).toBe(COFICO.email);
    expect(legal.vars.telefone).toBe(COFICO.phone);
  });
  it('nenhum texto legal menciona Saporino nem o CNPJ dela', () => {
    for (const t of todosOsTextos) {
      expect(t.toLowerCase()).not.toContain('saporino');
      expect(t).not.toContain('61.109.694');
    }
  });
  it('nenhum texto legal cita o fornecedor da embalagem', () => {
    // Regra do Vlademir: quem vende é a COFICO. Nada de MAK-PLAST nem do endereço dele.
    for (const t of todosOsTextos) {
      expect(t.toUpperCase()).not.toContain('MAK-PLAST');
      expect(t).not.toContain('41.769.332');
      expect(t.toLowerCase()).not.toContain('caio de brito');
    }
  });
});

describe('as três páginas que a Meta pede existem e dizem o necessário', () => {
  it('os três slugs, com título e descrição', () => {
    expect(legal.documentos.map(d => d.slug)).toEqual([...SLUGS_LEGAIS]);
    for (const d of legal.documentos) {
      expect(d.titulo).toContain('COFICO');
      expect(d.descricao.length).toBeGreaterThan(60);
      expect(d.blocos.length).toBeGreaterThan(5);
    }
  });

  it('privacidade: descreve a MODALIDADE, sem dizer que já opera e sem aviso provisório', () => {
    const tudo = doc('privacidade').blocos.flatMap(textosDe).join('\n');
    expect(tudo).toMatch(/WhatsApp Business Platform/);
    // não pode afirmar que a integração já funciona...
    expect(tudo).not.toMatch(/integração (já )?(está )?(ativa|em opera[çc]ão|funcionando)/i);
    // ...nem carregar aviso provisório, que era justamente o que se queria eliminar
    expect(tudo).not.toMatch(/em prepara[çc]ão|ainda não está em opera|por enquanto|provisóri/i);
    // e precisa deixar claro que descrever não é declarar funcionamento
    expect(tudo).toMatch(/não uma declaração de que todas as funcionalidades estejam em funcionamento/i);
  });

  it('privacidade: cobre a operação inteira, não só o site', () => {
    const tudo = doc('privacidade').blocos.flatMap(textosDe).join('\n').toLowerCase();
    for (const tema of ['cliente', 'fornecedor', 'representante', 'promotor', 'pedido',
      'entrega', 'comiss', 'whatsapp', 'cloud api', 'localização', 'automatiza']) {
      expect(tudo, `falta falar de: ${tema}`).toContain(tema);
    }
  });

  it('privacidade: revisão de decisão automatizada e papel de operador', () => {
    const tudo = doc('privacidade').blocos.flatMap(textosDe).join('\n');
    expect(tudo).toMatch(/Art\. 20/);
    expect(tudo).toMatch(/revisão por pessoa natural/i);
    expect(tudo).toMatch(/operadora|operador/i);   // nem sempre a COFICO é a controladora
  });

  it('privacidade: finalidades, dados, direitos, retenção e exclusão', () => {
    const tudo = doc('privacidade').blocos.flatMap(textosDe).join('\n').toLowerCase();
    for (const exigido of ['finalidade', 'base', 'retenç', 'direito', 'lgpd', 'exclusão', 'transferência internacional', 'meta']) {
      expect(tudo).toContain(exigido.toLowerCase());
    }
  });

  // ——— correções da auditoria de 13/10/2026: cada uma tem o seu teste ———————————————

  it('declara a análise de crédito, com base legal e sem autorização genérica', () => {
    const tudo = doc('privacidade').blocos.flatMap(textosDe).join('\n');
    expect(tudo).toMatch(/limite de crédito/i);
    expect(tudo).toMatch(/birô de crédito/i);
    expect(tudo).toMatch(/Art\. 7º, X/);                       // proteção do crédito
    expect(tudo).toMatch(/autorização genérica.{0,30}NÃO basta|não é feita com base em autorização genérica/i);
  });

  it('não assume como da COFICO o que é de outra empresa', () => {
    const tudo = doc('privacidade').blocos.flatMap(textosDe).join('\n');
    // representantes/promotores/motoristas só entram se forem vinculados à COFICO
    expect(tudo).toMatch(/vinculados à COFICO/);
    expect(tudo).toMatch(/controladora nesse caso/);
    // e a seção 9 abre dizendo a quem se aplica
    expect(tudo).toMatch(/9\.1 A quem esta seção se aplica/);
  });

  it('separa as quatro categorias de monitoramento em campo', () => {
    const tudo = doc('privacidade').blocos.flatMap(textosDe).join('\n');
    for (const cat of ['Localização pontual', 'Registro da visita', 'Status de presença', 'Atividade no sistema']) {
      expect(tudo, `falta a categoria: ${cat}`).toContain(cat);
    }
  });

  it('comprovação de entrega: canhoto fotografado, nunca assinatura digital', () => {
    const tudo = doc('privacidade').blocos.flatMap(textosDe).join('\n');
    expect(tudo).toMatch(/canhoto ou comprovante assinado/i);
    expect(tudo).toMatch(/Não coletamos assinatura digital nem biometria/i);
  });

  it('não promete isolamento técnico entre empresas que o sistema não tem', () => {
    const tudo = doc('privacidade').blocos.flatMap(textosDe).join('\n');
    expect(tudo).toMatch(/controle hoje é por papel de acesso, e não uma separação técnica completa/i);
    // e não pode voltar a prometer o que não existe
    expect(tudo).not.toMatch(/isolamento (completo|total) entre empresas/i);
  });

  it('exclusão: separa prazo de RESPOSTA de prazo de ELIMINAÇÃO', () => {
    const tudo = doc('exclusao-de-dados').blocos.flatMap(textosDe).join('\n');
    expect(tudo).toMatch(/Resposta e eliminação são coisas diferentes/i);
    expect(tudo).toMatch(/Art\. 19, II/);                       // os 15 dias são de confirmação/acesso
    expect(tudo).toMatch(/cópias de segurança/i);
    // não pode prometer eliminação em 15 dias
    expect(tudo).not.toMatch(/elimina\w*.{0,40}15 dias/i);
  });

  it('as pendências jurídicas cobrem contrato de operador e compartilhamento', () => {
    const todas = legal.documentos.flatMap(d => d.revisaoJuridica).join('\n');
    expect(todas).toMatch(/operador de dados \(DPA\)/i);
    expect(todas).toMatch(/compartilhamento/i);
    expect(todas).toMatch(/birô de crédito/i);
    expect(todas).toMatch(/12\.414/);                           // Cadastro Positivo
  });

  it('exclusão de dados: canal, o que informar, prazo e o que pode ficar', () => {
    const tudo = doc('exclusao-de-dados').blocos.flatMap(textosDe).join('\n');
    expect(tudo).toContain('{email}');
    expect(tudo).toContain('{telefone}');
    expect(tudo).toMatch(/15 dias/);
    expect(tudo).toMatch(/ANPD/);
    expect(tudo).toMatch(/obrigação legal/i);
  });

  it('cada documento lista o que depende de revisão jurídica — FORA da página', () => {
    for (const d of legal.documentos) {
      expect(d.revisaoJuridica?.length, `documento ${d.slug} sem revisaoJuridica`).toBeGreaterThan(0);
      for (const ponto of d.revisaoJuridica) expect(ponto.length).toBeGreaterThan(30);
    }
  });

  it('nenhum documento carrega tarja de pendência na página pública', () => {
    // Decisão de 13/10/2026: política definitiva não exibe aviso provisório. O tipo de bloco
    // `aviso` foi removido do código; este teste impede que volte pelo JSON.
    for (const d of legal.documentos) {
      for (const b of d.blocos as unknown as Array<Record<string, unknown>>) {
        expect(Object.keys(b).some(k => !['h2', 'p', 'ul'].includes(k)),
          `${d.slug}: bloco com chave desconhecida — ${JSON.stringify(b).slice(0, 80)}`).toBe(false);
      }
      const tudo = d.blocos.flatMap(textosDe).join('\n');
      expect(tudo, `${d.slug} fala de revisão jurídica na página`).not.toMatch(/revisão jurídica/i);
    }
  });
});

describe('HTML estático: a política tem de ser legível sem JavaScript', () => {
  for (const d of legal.documentos) {
    it(`${d.slug}: traz h1, o texto e a data`, () => {
      const html = paginaEstatica(d, legal.vars, legal.atualizado);
      expect(html).toContain(`<h1`);
      expect(html).toContain(d.h1);
      expect(html).toContain(legal.atualizado);
      // o corpo inteiro, não só o título
      expect(html.length).toBeGreaterThan(3000);
      // links legais relativos: valem na raiz do domínio COFICO e sob /coficobrasil/
      expect(html).toContain('href="privacidade"');
      expect(html).not.toContain('href="/privacidade"');
      // a razão social não vai no rodapé (regra do rodapé da COFICO)
      expect(html.split('<footer')[1]).not.toContain(legal.vars.razao);
    });
  }
  it('o conteúdo de cada bloco realmente aparece', () => {
    const html = paginaEstatica(doc('privacidade'), legal.vars, legal.atualizado);
    expect(html).toContain('WhatsApp Business Platform');
    expect(html).toContain(COFICO.cnpj);
    expect(html).toContain(COFICO.email);
  });
});

describe('rotas: cada marca no seu domínio', () => {
  const COF = 'www.coficobrasil.com.br', SAP = 'www.cafesaporino.com.br';

  it('no domínio da COFICO a política mora na raiz', () => {
    expect(noDominioCofico(COF)).toBe(true);
    expect(linkLegal('privacidade', COF)).toBe('/privacidade');
    expect(rotaLegalCofico('/privacidade', COF)).toBe('privacidade');
    expect(rotaLegalCofico('/exclusao-de-dados', COF)).toBe('exclusao-de-dados');
    expect(rotaLegalCofico('/termos/', COF)).toBe('termos');
  });

  it('no domínio da Saporino, /privacidade NÃO é da COFICO', () => {
    expect(noDominioCofico(SAP)).toBe(false);
    expect(rotaLegalCofico('/privacidade', SAP)).toBeNull();
    expect(linkLegal('privacidade', SAP)).toBe('/coficobrasil/privacidade');
  });

  it('/coficobrasil/<slug> vale em qualquer domínio (inclusive localhost)', () => {
    for (const host of [COF, SAP, 'localhost']) {
      expect(rotaLegalCofico('/coficobrasil/termos', host)).toBe('termos');
    }
  });

  it('não confunde outras rotas', () => {
    for (const p of ['/', '/coficobrasil', '/politica-privacidade', '/termos-servico', '/admin', '/repco']) {
      expect(rotaLegalCofico(p, SAP)).toBeNull();
    }
    // e no domínio da COFICO as rotas da Saporino continuam não sendo páginas legais da COFICO
    expect(rotaLegalCofico('/politica-privacidade', COF)).toBeNull();
    expect(rotaLegalCofico('/coficobrasil/qualquer-coisa', COF)).toBeNull();
  });
});
