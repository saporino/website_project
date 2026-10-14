import { describe, it, expect } from 'vitest';
import {
  lerPedido, lerVeredito, corpoParaMeta, lerRespostaDaMeta,
  idProvisorio, idSimulado, foiSimulado, LIMITE_TEXTO, EXPLICACAO,
} from '../../supabase/functions/_shared/whatsappEnvio';

const UM = '11111111-1111-4111-8111-111111111111';
const DOIS = '22222222-2222-4222-8222-222222222222';

describe('o pedido, antes de qualquer consulta', () => {
  it('aceita um pedido bem formado e limpa o texto', () => {
    const r = lerPedido({ conversa: UM, chave: DOIS, texto: '  Bom dia!\r\nTudo certo?  ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pedido.texto).toBe('Bom dia!\nTudo certo?');
  });

  it('exige a chave de idempotência — sem ela não existe envio', () => {
    // É a chave que impede o clique duplo de virar duas mensagens para o cliente.
    for (const chave of [undefined, '', 'abc', 123, null]) {
      const r = lerPedido({ conversa: UM, chave, texto: 'oi' });
      expect(r.ok, String(chave)).toBe(false);
      if (!r.ok) expect(r.motivo).toBe('chave_invalida');
    }
  });

  it('recusa conversa que não é um identificador', () => {
    const r = lerPedido({ conversa: 'a-conversa', chave: DOIS, texto: 'oi' });
    expect(r.ok).toBe(false);
  });

  it('recusa texto vazio ou só espaço', () => {
    for (const t of ['', '   ', '\n\n', undefined]) {
      const r = lerPedido({ conversa: UM, chave: DOIS, texto: t });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toBe('texto_vazio');
    }
  });

  it('recusa texto acima do limite do WhatsApp, no SERVIDOR', () => {
    const r = lerPedido({ conversa: UM, chave: DOIS, texto: 'a'.repeat(LIMITE_TEXTO + 1) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe('texto_longo');
    expect(lerPedido({ conversa: UM, chave: DOIS, texto: 'a'.repeat(LIMITE_TEXTO) }).ok).toBe(true);
  });

  it('toda recusa tem explicação em português', () => {
    for (const [motivo, texto] of Object.entries(EXPLICACAO)) {
      expect(texto.length, motivo).toBeGreaterThan(10);
      expect(texto).not.toMatch(/undefined|null|\[object/);
    }
  });
});

describe('o veredito vem do banco, não daqui', () => {
  it('lê a permissão concedida', () => {
    const v = lerVeredito({
      pode: true, company_id: 'c1', numero_id: 'n1', phone_number_id: '1386100787926214',
      telefone: '5511917719798', ambiente: 'teste', janela_minutos: 1430,
    });
    expect(v.pode).toBe(true);
    expect(v.phone_number_id).toBe('1386100787926214');
    expect(v.janela_minutos).toBe(1430);
  });

  it('qualquer coisa que não seja um "pode: true" explícito é recusa', () => {
    // Fail closed: resposta estranha nunca libera envio.
    for (const bruto of [null, undefined, {}, 'sim', 0, [], { pode: 'true' }, { pode: 1 }]) {
      expect(lerVeredito(bruto).pode, JSON.stringify(bruto)).toBe(false);
    }
  });

  it('preserva o motivo da recusa', () => {
    expect(lerVeredito({ pode: false, motivo: 'janela_fechada' }).motivo).toBe('janela_fechada');
    expect(lerVeredito({ pode: false, motivo: 'numero_nao_envia' }).motivo).toBe('numero_nao_envia');
    expect(lerVeredito({ pode: false }).motivo).toBe('sem_permissao');   // sem motivo = o mais restrito
  });
});

describe('o corpo que vai para a Meta', () => {
  it('mensagem de texto, sem cartão de link', () => {
    const c = corpoParaMeta('5511917719798', 'Bom dia, veja https://exemplo.com');
    expect(c.messaging_product).toBe('whatsapp');
    expect(c.to).toBe('5511917719798');
    expect(c.type).toBe('text');
    // Um link numa resposta comercial não deve virar cartão com imagem de terceiro
    // sem alguém ter escolhido isso.
    expect(c.text.preview_url).toBe(false);
    expect(c.text.body).toContain('exemplo.com');
  });
});

describe('a resposta da Meta', () => {
  it('sucesso devolve o wamid', () => {
    const r = lerRespostaDaMeta(200, {
      messaging_product: 'whatsapp',
      contacts: [{ input: '5511917719798', wa_id: '5511917719798' }],
      messages: [{ id: 'wamid.HBgNNTUxMTkxNzcxOTc5OBUCABEYEjlGQj...' }],
    });
    expect(r.wamid).toContain('wamid.');
    expect(r.erroCodigo).toBeNull();
  });

  it('erro da Meta vira código e texto legíveis', () => {
    const r = lerRespostaDaMeta(400, {
      error: {
        message: '(#131030) Recipient phone number not in allowed list',
        code: 131030,
        error_data: { details: 'Add the number to the allowed list' },
      },
    });
    expect(r.wamid).toBeNull();
    expect(r.erroCodigo).toBe('131030');          // o código é o que permite achar a causa
    expect(r.erroTexto).toContain('allowed list');
  });

  it('200 sem id de mensagem NÃO conta como enviado', () => {
    // Já aconteceu com outra API do projeto: HTTP 200 e corpo inesperado. Se isso contasse
    // como sucesso, a mensagem ficaria "enviada" sem nunca ter saído.
    const r = lerRespostaDaMeta(200, { messaging_product: 'whatsapp' });
    expect(r.wamid).toBeNull();
    expect(r.erroTexto).toContain('sem id');
  });

  it('corpo inesperado não lança — a linha já existe e precisa de veredito', () => {
    for (const c of [null, undefined, 'texto', 0, [], { messages: 'x' }, { messages: [{}] }]) {
      expect(() => lerRespostaDaMeta(500, c)).not.toThrow();
      expect(lerRespostaDaMeta(500, c).wamid).toBeNull();
    }
  });

  it('erro sem código usa o status HTTP', () => {
    expect(lerRespostaDaMeta(503, { error: { message: 'oops' } }).erroCodigo).toBe('503');
  });
});

describe('identificadores do envio', () => {
  it('o provisório vive só entre gravar e a Meta responder', () => {
    expect(idProvisorio(DOIS)).toBe(`pendente:${DOIS}`);
  });
  it('o simulado se denuncia, no banco e na tela', () => {
    const id = idSimulado(DOIS);
    expect(foiSimulado(id)).toBe(true);
    expect(id).toContain('SIMULADO');
    expect(foiSimulado('wamid.HBgNreal')).toBe(false);
  });
});
