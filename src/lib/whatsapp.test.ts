import { describe, it, expect } from 'vitest';
import {
  respostaDoDesafio, hexDaAssinatura, assinaturaConfere, iguaisEmTempoConstante,
  lerEvento, instanteDe, paraE164BR, soDigitos, dentroDaJanela, minutosDeJanela, pediuParaSair,
} from '../../supabase/functions/_shared/whatsapp';

// Os payloads abaixo seguem o formato documentado da WhatsApp Cloud API. Nenhuma mensagem
// real foi enviada ou recebida: isto é lógica pura, rodando sem rede.

const envelope = (valor: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: '1414275710855684', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp',
    metadata: { display_phone_number: '5511938100909', phone_number_id: '1386100787926214' },
    ...valor,
  } }] }],
});

describe('verificação da URL (GET da Meta)', () => {
  const d = { modo: 'subscribe', token: 'segredo-certo', challenge: '1158201444' };

  it('devolve o challenge quando o token bate', () => {
    expect(respostaDoDesafio(d, 'segredo-certo')).toBe('1158201444');
  });
  it('recusa token errado, vazio ou ausente', () => {
    expect(respostaDoDesafio({ ...d, token: 'outro' }, 'segredo-certo')).toBeNull();
    expect(respostaDoDesafio({ ...d, token: '' }, 'segredo-certo')).toBeNull();
    expect(respostaDoDesafio({ ...d, token: null }, 'segredo-certo')).toBeNull();
  });
  it('recusa quando NÓS não temos segredo configurado (fail closed)', () => {
    expect(respostaDoDesafio(d, undefined)).toBeNull();
    expect(respostaDoDesafio(d, '')).toBeNull();
  });
  it('recusa modo diferente de subscribe', () => {
    expect(respostaDoDesafio({ ...d, modo: 'unsubscribe' }, 'segredo-certo')).toBeNull();
  });
});

describe('assinatura do evento (X-Hub-Signature-256)', () => {
  const hex = 'a'.repeat(64);

  it('lê o hex de "sha256=..."', () => {
    expect(hexDaAssinatura(`sha256=${hex}`)).toBe(hex);
    expect(hexDaAssinatura(`SHA256=${hex.toUpperCase()}`)).toBe(hex);
  });
  it('recusa formato estranho', () => {
    for (const ruim of [null, undefined, '', hex, 'sha1=' + hex, 'sha256=xyz', `sha256=${'a'.repeat(63)}`]) {
      expect(hexDaAssinatura(ruim)).toBeNull();
    }
  });
  it('confere o HMAC e recusa o que não bate', () => {
    expect(assinaturaConfere(`sha256=${hex}`, hex)).toBe(true);
    expect(assinaturaConfere(`sha256=${hex}`, 'b'.repeat(64))).toBe(false);
    expect(assinaturaConfere(null, hex)).toBe(false);            // sem assinatura = recusa
  });
  it('a comparação não vaza onde difere', () => {
    expect(iguaisEmTempoConstante('abc', 'abc')).toBe(true);
    expect(iguaisEmTempoConstante('abc', 'abd')).toBe(false);
    expect(iguaisEmTempoConstante('abc', 'abcd')).toBe(false);
  });
});

describe('leitura do evento', () => {
  it('mensagem de texto: id, telefone, nome e número da empresa', () => {
    const e = lerEvento(envelope({
      contacts: [{ profile: { name: 'Mercado do Zé' }, wa_id: '5511999998888' }],
      messages: [{ from: '5511999998888', id: 'wamid.ABC', timestamp: '1760000000',
        text: { body: 'Bom dia, quero cotar 10 fardos' }, type: 'text' }],
    }));
    expect(e.mensagens).toHaveLength(1);
    const m = e.mensagens[0];
    expect(m.idExterno).toBe('wamid.ABC');
    expect(m.telefone).toBe('5511999998888');
    expect(m.nomePerfil).toBe('Mercado do Zé');
    expect(m.tipo).toBe('texto');
    expect(m.texto).toBe('Bom dia, quero cotar 10 fardos');
    expect(m.numeroDaEmpresa).toBe('1386100787926214');   // decide de QUAL empresa é
    expect(e.ignorados).toBe(0);
  });

  it('imagem com legenda guarda o id da mídia e o mime', () => {
    const e = lerEvento(envelope({
      messages: [{ from: '5511999998888', id: 'wamid.IMG', timestamp: '1760000100', type: 'image',
        image: { id: '999', mime_type: 'image/jpeg', caption: 'comprovante' } }],
    }));
    expect(e.mensagens[0].tipo).toBe('imagem');
    expect(e.mensagens[0].midiaId).toBe('999');
    expect(e.mensagens[0].midiaMime).toBe('image/jpeg');
    expect(e.mensagens[0].texto).toBe('comprovante');
  });

  it('tipo desconhecido vira "outro", não derruba o lote', () => {
    const e = lerEvento(envelope({
      messages: [{ from: '5511999998888', id: 'wamid.X', timestamp: '1760000200', type: 'order', order: {} }],
    }));
    expect(e.mensagens[0].tipo).toBe('outro');
    expect(e.mensagens[0].idExterno).toBe('wamid.X');
  });

  it('status de entrega da mensagem que enviamos', () => {
    const e = lerEvento(envelope({
      statuses: [{ id: 'wamid.ENV', status: 'delivered', timestamp: '1760000300', recipient_id: '5511999998888' }],
    }));
    expect(e.statuses).toEqual([{
      idExterno: 'wamid.ENV', estado: 'entregue',
      em: new Date(1760000300 * 1000).toISOString(), erro: null, numeroDaEmpresa: '1386100787926214',
    }]);
  });

  it('falha de envio traz o motivo legível', () => {
    const e = lerEvento(envelope({
      statuses: [{ id: 'wamid.F', status: 'failed', timestamp: '1760000400',
        errors: [{ code: 131047, title: 'Re-engagement message' }] }],
    }));
    expect(e.statuses[0].estado).toBe('falhou');
    expect(e.statuses[0].erro).toContain('131047');
  });

  it('lixo não lança exceção — conta como ignorado', () => {
    // Derrubar o webhook faz a Meta reenviar o lote e, depois de muitas falhas, desativar.
    for (const ruim of [null, undefined, 0, 'texto', [], {}, { object: 'page' }, { object: 'whatsapp_business_account' }]) {
      expect(() => lerEvento(ruim)).not.toThrow();
    }
    expect(lerEvento({ object: 'page' }).ignorados).toBe(1);
    expect(lerEvento(envelope({ messages: [{ type: 'text' }] })).ignorados).toBe(1);  // sem id/from
  });

  it('vários eventos no mesmo lote', () => {
    const e = lerEvento(envelope({
      contacts: [{ profile: { name: 'A' }, wa_id: '5511999998888' }],
      messages: [
        { from: '5511999998888', id: 'w1', timestamp: '1760000000', type: 'text', text: { body: 'oi' } },
        { from: '5511977776666', id: 'w2', timestamp: '1760000001', type: 'text', text: { body: 'olá' } },
      ],
      statuses: [{ id: 'w0', status: 'read', timestamp: '1760000002' }],
    }));
    expect(e.mensagens).toHaveLength(2);
    expect(e.statuses).toHaveLength(1);
    expect(e.mensagens[1].nomePerfil).toBeNull();   // sem contato correspondente
  });

  it('timestamp inválido não quebra a data', () => {
    expect(() => new Date(instanteDe('abc'))).not.toThrow();
    expect(instanteDe('1760000000')).toBe(new Date(1760000000 * 1000).toISOString());
  });
});

describe('telefone', () => {
  it('normaliza o que o brasileiro digita', () => {
    expect(paraE164BR('(11) 93810-0909')).toBe('5511938100909');
    expect(paraE164BR('11938100909')).toBe('5511938100909');
    expect(paraE164BR('+55 11 93810-0909')).toBe('5511938100909');
    expect(paraE164BR('011 93810-0909')).toBe('5511938100909');   // prefixo de operadora
    expect(paraE164BR('1138100909')).toBe('551138100909');     // fixo, 10 dígitos
  });
  it('devolve null quando não dá para afirmar', () => {
    for (const ruim of ['', '123', 'abc', '99999999999999999', '4004']) {
      expect(paraE164BR(ruim)).toBeNull();
    }
  });
  it('11 dígitos sem país são tratados como brasileiros, de propósito', () => {
    // '1 800 555 0199' é indistinguível de um celular brasileiro de 11 dígitos. Adivinhar
    // país aqui seria pior do que assumir o Brasil, que é a operação inteira da COFICO.
    expect(paraE164BR('1 800 555 0199')).toBe('5518005550199');
  });
  it('soDigitos limpa qualquer formatação', () => {
    expect(soDigitos('+55 (11) 93810-0909')).toBe('5511938100909');
  });
});

describe('janela de 24 horas', () => {
  const agora = new Date('2026-10-13T20:00:00Z');
  const hAtras = (h: number) => new Date(agora.getTime() - h * 3600_000).toISOString();

  it('aberta dentro das 24 h', () => {
    expect(dentroDaJanela(hAtras(1), agora)).toBe(true);
    expect(dentroDaJanela(hAtras(23.9), agora)).toBe(true);
  });
  it('fechada depois de 24 h — aí só modelo aprovado, que é cobrado', () => {
    expect(dentroDaJanela(hAtras(24.1), agora)).toBe(false);
    expect(dentroDaJanela(hAtras(72), agora)).toBe(false);
  });
  it('sem mensagem do cliente, nunca esteve aberta', () => {
    expect(dentroDaJanela(null, agora)).toBe(false);
    expect(dentroDaJanela('data torta', agora)).toBe(false);
  });
  it('quanto falta, em minutos', () => {
    expect(minutosDeJanela(hAtras(23), agora)).toBe(60);
    expect(minutosDeJanela(hAtras(25), agora)).toBeLessThan(0);
    expect(minutosDeJanela(null, agora)).toBe(-1);
  });
});

describe('descadastramento', () => {
  it('a palavra sozinha vale', () => {
    for (const t of ['SAIR', 'sair', ' Parar ', 'PARE', 'cancelar', 'Descadastrar', 'stop', 'unsubscribe', 'sair.']) {
      expect(pediuParaSair(t), t).toBe(true);
    }
  });
  it('a palavra no meio de uma frase NÃO vale', () => {
    // "não quero parar de comprar" não pode descadastrar ninguém.
    for (const t of ['não quero parar de comprar', 'pode parar a entrega de amanhã?',
      'vou sair da loja agora', 'preciso cancelar o pedido 123']) {
      expect(pediuParaSair(t), t).toBe(false);
    }
  });
  it('vazio e nulo não descadastram', () => {
    for (const t of ['', null, undefined, '   ']) expect(pediuParaSair(t)).toBe(false);
  });
});
