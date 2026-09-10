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

  it('mantém a headline curta, porque gerador erra letra', () => {
    // "~5 palavras" vale para a HEADLINE, não para a peça: uma peça com
    // headline curta + linha de apoio + assinatura está certa.
    expect(systemDoDiretor(base)).toContain('idealmente até ~5 palavras');
    expect(systemDoDiretor(base)).toContain('quanto mais curta a frase, menor o risco');
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

// =====================================================================
// IDIOMA — regra dura do produto
// =====================================================================
import { LOCALE_SAIDA, REGRA_DE_IDIOMA, pareceEstrangeiro, ESTILOS, MODOS_DE_TEXTO, PAPEL_OFICIAL, PAPEL_INSPIRACAO } from './diretorCriativo.ts';

describe('idioma de saída é regra de sistema, não frase ocasional', () => {
  it('existe uma constante de locale — não depende do prompt', () => {
    expect(LOCALE_SAIDA).toBe('pt-BR');
  });

  it('o esquema do briefing registra o idioma', () => {
    expect(ESQUEMA_BRIEFING).toContain('"output_language": "pt-BR"');
  });

  it('a regra entra em todo prompt, qualquer que seja o pedido', () => {
    for (const t of ['bom_dia', 'oferta', 'lifestyle'] as TipoId[]) {
      expect(systemDoDiretor({ ...base, tipo: t })).toContain('PORTUGUÊS DO BRASIL');
    }
  });

  it('a referência estrangeira não define o idioma da peça', () => {
    expect(REGRA_DE_IDIOMA).toContain('Isso NÃO define o idioma da peça');
  });

  it('proíbe tradução literal — quer reinterpretação', () => {
    expect(REGRA_DE_IDIOMA).toContain('NÃO traduza ao pé da letra');
    expect(REGRA_DE_IDIOMA).toContain('BREWING HAPPINESS');
  });

  it('preserva @, marca, produto, URL e texto da embalagem oficial', () => {
    for (const termo of ['nome da marca', 'nome registrado do produto', '@ do Instagram', 'URL', 'EMBALAGEM OFICIAL']) {
      expect(REGRA_DE_IDIOMA, `preserva ${termo}`).toContain(termo);
    }
  });

  it('o prompt de imagem carrega a exigência em inglês, para o gerador', () => {
    expect(systemDoDiretor(base)).toContain('ALL VISIBLE TEXT MUST BE IN BRAZILIAN PORTUGUESE');
  });
});

describe('pareceEstrangeiro — verificação determinística, não só confiança no modelo', () => {
  it('pega headline em inglês', () => {
    expect(pareceEstrangeiro('BREWING HAPPINESS EVERY DAY')).toBe(true);
    expect(pareceEstrangeiro('Start your day with coffee')).toBe(true);
  });

  it('pega headline em espanhol', () => {
    expect(pareceEstrangeiro('Buenos días, el mejor café')).toBe(true);
  });

  it('deixa passar português legítimo', () => {
    expect(pareceEstrangeiro('Bom dia!')).toBe(false);
    expect(pareceEstrangeiro('Que hoje não falte um bom café')).toBe(false);
    expect(pareceEstrangeiro('Mais que café, mais momentos felizes')).toBe(false);
  });

  it('não acusa nome de marca ou @ isolado', () => {
    // Uma palavra estrangeira sozinha pode ser nome próprio — só duas ou mais
    // caracterizam frase em outro idioma.
    expect(pareceEstrangeiro('@cafecapital')).toBe(false);
    expect(pareceEstrangeiro('Café Capital Expresso')).toBe(false);
  });

  it('ignora texto vazio ou curto demais', () => {
    expect(pareceEstrangeiro('')).toBe(false);
    expect(pareceEstrangeiro(null)).toBe(false);
    expect(pareceEstrangeiro(undefined)).toBe(false);
  });
});

describe('texto na arte permite hierarquia, não vira slogan de 5 palavras', () => {
  it('descreve os três níveis possíveis', () => {
    const s = systemDoDiretor(base);
    expect(s).toContain('HEADLINE');
    expect(s).toContain('APOIO (opcional)');
    expect(s).toContain('ASSINATURA (opcional)');
  });

  it('diz explicitamente que não é limite para a peça inteira', () => {
    expect(systemDoDiretor(base)).toContain('NÃO é limite de cinco palavras para a peça inteira');
  });
});

describe('experiência guiada — o cliente aponta, o servidor traduz', () => {
  it('o estilo escolhido manda no modo de saída', () => {
    // "Mais premium" é o que o dono de torrefação sabe dizer; luz direcional
    // e espaço negativo é o que ele não saberia descrever.
    expect(systemDoDiretor({ ...base, estilo: 'premium' })).toContain('Mais premium');
    expect(systemDoDiretor({ ...base, estilo: 'fotografico' })).toContain('photo_first');
    expect(systemDoDiretor({ ...base, estilo: 'comercial' })).toContain('post_first');
  });

  it('todo estilo tem modo e direção de acabamento', () => {
    for (const [id, e] of Object.entries(ESTILOS)) {
      expect(e.modo, `estilo ${id}`).toBeTruthy();
      expect(e.direcao.length, `estilo ${id}`).toBeGreaterThan(30);
    }
  });

  it('a decisão de texto do cliente chega ao Diretor', () => {
    expect(systemDoDiretor({ ...base, modoTexto: 'sem_texto' })).toContain(MODOS_DE_TEXTO.sem_texto);
    expect(systemDoDiretor({ ...base, modoTexto: 'com_frase' })).toContain(MODOS_DE_TEXTO.com_frase);
    // "automático" não polui o prompt com instrução redundante.
    expect(systemDoDiretor({ ...base, modoTexto: 'automatico' })).not.toContain('DECISÃO DE TEXTO');
  });

  it('o @ vira assinatura e é preservado sem tradução', () => {
    const s = systemDoDiretor({ ...base, handle: '@cafecapital' });
    expect(s).toContain('@cafecapital');
    expect(s).toContain('sem traduzir');
  });

  it('oficial e inspiração recebem instruções OPOSTAS', () => {
    const s = systemDoDiretor({ ...base, papeis: ['oficial', 'inspiracao'], qtdAtivos: 2 });
    expect(s).toContain(PAPEL_OFICIAL);
    expect(s).toContain(PAPEL_INSPIRACAO);
    // A diferença que importa: uma se preserva, a outra se abandona.
    expect(PAPEL_OFICIAL).toContain('fiéis à referência');
    expect(PAPEL_INSPIRACAO).toContain('ABANDONE a execução');
  });

  it('sem inspiração anexada, a regra de não copiar não aparece', () => {
    expect(systemDoDiretor({ ...base, papeis: ['oficial'] })).not.toContain(PAPEL_INSPIRACAO);
  });
});

// ---------------------------------------------------------------------
// Paleta e assinatura — o que a peça vermelha sobre embalagem verde ensinou
// ---------------------------------------------------------------------
import { REGRA_DE_PALETA, normalizarHandle } from './diretorCriativo.ts';

describe('a embalagem manda na paleta da peça', () => {
  it('com ativo oficial, a regra de paleta entra no prompt', () => {
    const s = systemDoDiretor({ ...base, temAtivoOficial: true, papeis: ['oficial'] });
    expect(s).toContain(REGRA_DE_PALETA);
  });

  it('sem ativo oficial, a paleta cai na identidade cadastrada', () => {
    const s = systemDoDiretor({ ...base, temAtivoOficial: false });
    expect(s).not.toContain(REGRA_DE_PALETA);
    expect(s).toContain('apenas as cores da identidade da marca');
  });

  it('a regra proíbe cor que não existe na embalagem', () => {
    expect(REGRA_DE_PALETA).toContain('PROIBIDO introduzir cor que não existe na embalagem');
  });

  it('a paleta escolhida é auditável no briefing', () => {
    expect(ESQUEMA_BRIEFING).toContain('paleta_da_peca');
  });

  it('o final_prompt tem de nomear a cor do fundo e a de cada texto', () => {
    expect(systemDoDiretor({ ...base, temAtivoOficial: true }))
      .toContain('qual é a cor do fundo e qual é a cor de cada texto');
  });
});

describe('assinatura do Instagram — garantida por código', () => {
  it('põe a arroba quando o cliente não põe', () => {
    expect(normalizarHandle('cafecapital')).toBe('@cafecapital');
  });

  it('não duplica a arroba de quem já digitou', () => {
    expect(normalizarHandle('@cafecapital')).toBe('@cafecapital');
    expect(normalizarHandle('@@cafecapital')).toBe('@cafecapital');
  });

  it('tira espaço, que na arte vira nome quebrado', () => {
    expect(normalizarHandle('  @cafe capital ')).toBe('@cafecapital');
  });

  it('vazio continua vazio — não inventa assinatura', () => {
    expect(normalizarHandle('')).toBeNull();
    expect(normalizarHandle('   ')).toBeNull();
    expect(normalizarHandle('@')).toBeNull();
    expect(normalizarHandle(null)).toBeNull();
  });

  it('a assinatura sai sempre com arroba, mesmo digitada sem', () => {
    expect(systemDoDiretor({ ...base, handle: 'cafecapital' })).toContain('"@cafecapital"');
  });

  it('o ícone de rede social é proibido — o gerador não sabe compor lockup', () => {
    const s = systemDoDiretor({ ...base, handle: '@cafecapital' });
    expect(s).toContain('não desenhe o ícone do Instagram');
  });
});

// ---------------------------------------------------------------------
// Marca livre e trava de contaminação — o incidente Capital→Saporino
// ---------------------------------------------------------------------
import { MODO_MARCA_LIVRE, marcaEstranhaNoPrompt } from './diretorCriativo.ts';

describe('marca livre — a embalagem é o documento da marca', () => {
  it('em modo livre o DNA some e a regra da embalagem entra', () => {
    const s = systemDoDiretor({ ...base, modoMarca: 'livre', marca: 'Café Capital', dna: { tom: 'x' } });
    expect(s).toContain(MODO_MARCA_LIVRE);
    // O DNA cadastrado NÃO pode vazar para dentro do prompt.
    expect(s).not.toContain('"tom":"x"');
  });

  it('em modo perfil o DNA continua mandando', () => {
    expect(systemDoDiretor({ ...base, modoMarca: 'perfil' })).toContain('acolhedor');
  });

  it('a marca livre proíbe citar qualquer outra marca de café', () => {
    expect(MODO_MARCA_LIVRE).toContain('PROIBIDO citar');
  });

  it('o prompt sempre proíbe marca que não seja a da peça', () => {
    expect(systemDoDiretor({ ...base, marca: 'Café Capital' }))
      .toContain('que não seja "Café Capital"');
  });
});

describe('trava de contaminação de marca no prompt', () => {
  const conhecidas = ['Café Saporino', 'COFICO Brasil'];

  it('pega a marca intrusa que causou o incidente', () => {
    const prompt = "place the official Saporino Clássico Tradicional coffee package, red packaging";
    expect(marcaEstranhaNoPrompt(prompt, 'Café Capital', conhecidas)).toBe('Café Saporino');
  });

  it('não acusa a própria marca da peça', () => {
    const prompt = 'place the official Saporino package on a linen cloth';
    expect(marcaEstranhaNoPrompt(prompt, 'Café Saporino', conhecidas)).toBeNull();
  });

  it('palavra genérica de café não vira acusação', () => {
    // "café" e "brasil" aparecem em quase toda peça; acusar por elas
    // bloquearia tudo e a trava viraria ruído.
    const prompt = 'a warm brazilian café scene with fresh coffee';
    expect(marcaEstranhaNoPrompt(prompt, 'Café Capital', conhecidas)).toBeNull();
  });

  it('não confunde pedaço de palavra com nome de marca', () => {
    const prompt = 'the coficobrasilia street market at sunrise';
    expect(marcaEstranhaNoPrompt(prompt, 'Café Capital', conhecidas)).toBeNull();
  });
});

describe('unicidade — nenhuma frase se repete', () => {
  it('as frases já usadas entram no prompt como proibição', () => {
    const s = systemDoDiretor({ ...base, headlinesProibidas: ['Bom dia com aroma de café'] });
    expect(s).toContain('FRASES JÁ USADAS');
    expect(s).toContain('Bom dia com aroma de café');
  });

  it('sem frases anteriores, a seção não polui o prompt', () => {
    expect(systemDoDiretor({ ...base, headlinesProibidas: [] })).not.toContain('FRASES JÁ USADAS');
  });
});
