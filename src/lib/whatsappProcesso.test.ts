import { describe, it, expect } from 'vitest';
import {
  processarEvento, telefoneMascarado, paraLog,
  type Repositorio, type Numero, type Resultado,
} from '../../supabase/functions/_shared/whatsappProcesso';

// Repositório falso: deixa provocar as falhas que, em produção, só apareceriam com a Meta
// do outro lado. Nenhuma mensagem real, nenhum banco, nenhuma rede.

const EMPRESA_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const EMPRESA_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const PNID_A = '1386100787926214';

interface Opcoes {
  numero?: Numero | null;
  falhar?: Partial<Record<keyof Repositorio, string>>;
  wamidsJaVistos?: string[];
  eventosJaVistos?: string[];
}

function repoFalso(o: Opcoes = {}) {
  const log: string[] = [];
  const gravadas: Array<Record<string, unknown>> = [];
  const entradas: Array<{ conversaId: string; quando: string }> = [];
  const saidas: Array<{ companyId: string; telefone: string }> = [];
  const fechamentos: Array<{ resultado: Resultado; detalhe: string | null }> = [];
  const estados: unknown[] = [];
  const vistos = new Set(o.wamidsJaVistos ?? []);
  const eventos = new Set(o.eventosJaVistos ?? []);

  const talvezFalhar = (m: keyof Repositorio) => {
    const msg = o.falhar?.[m];
    if (msg) throw new Error(msg);
  };

  const repo: Repositorio = {
    async guardarEvento(e) {
      log.push('guardarEvento'); talvezFalhar('guardarEvento');
      if (eventos.has(e.assinatura)) return 'repetido';
      eventos.add(e.assinatura);
      return 'novo';
    },
    async numeroDe(pnid) {
      log.push('numeroDe'); talvezFalhar('numeroDe');
      if (o.numero === null) return null;
      return o.numero ?? (pnid === PNID_A ? { companyId: EMPRESA_A, numeroId: 'num-a' } : null);
    },
    async acharOuCriarContato(companyId, telefone) {
      log.push('contato'); talvezFalhar('acharOuCriarContato');
      return `contato:${companyId}:${telefone}`;
    },
    async acharOuCriarConversa(companyId, numeroId, contatoId) {
      log.push('conversa'); talvezFalhar('acharOuCriarConversa');
      return `conversa:${companyId}:${numeroId}:${contatoId}`;
    },
    async gravarMensagem(m) {
      log.push('gravarMensagem'); talvezFalhar('gravarMensagem');
      if (vistos.has(m.idExterno)) return 'repetida';
      vistos.add(m.idExterno); gravadas.push(m);
      return 'nova';
    },
    async marcarEntrada(conversaId, quando) {
      log.push('marcarEntrada'); talvezFalhar('marcarEntrada');
      entradas.push({ conversaId, quando });
    },
    async atualizarEstado(s) { log.push('atualizarEstado'); talvezFalhar('atualizarEstado'); estados.push(s); },
    async registrarSaida(companyId, telefone) {
      log.push('registrarSaida'); talvezFalhar('registrarSaida');
      saidas.push({ companyId, telefone });
    },
    async fecharEvento(_a, resultado, detalhe) {
      log.push('fecharEvento'); talvezFalhar('fecharEvento');
      fechamentos.push({ resultado, detalhe });
    },
  };
  return { repo, log, gravadas, entradas, saidas, fechamentos, estados };
}

const envelope = (valor: Record<string, unknown>, pnid = PNID_A) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: 'waba', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp',
    metadata: { display_phone_number: '5511938100909', phone_number_id: pnid },
    ...valor,
  } }] }],
});

const umTexto = (texto: string, wamid = 'wamid.1', de = '5511999998888') => envelope({
  contacts: [{ profile: { name: 'Mercado do Zé' }, wa_id: de }],
  messages: [{ from: de, id: wamid, timestamp: '1760000000', type: 'text', text: { body: texto } }],
});

describe('caminho feliz', () => {
  it('guarda o cru ANTES de processar e grava a mensagem', async () => {
    const f = repoFalso();
    const v = await processarEvento(umTexto('Bom dia, quero cotar'), 'sig1', f.repo);
    expect(v.resultado).toBe('processado');
    expect(v.http).toBe(200);
    expect(v.mensagensNovas).toBe(1);
    // a ordem é a garantia contra perda: o cru entra antes de qualquer processamento
    expect(f.log.indexOf('guardarEvento')).toBeLessThan(f.log.indexOf('gravarMensagem'));
    expect(f.gravadas[0].companyId).toBe(EMPRESA_A);
    expect(f.gravadas[0].texto).toBe('Bom dia, quero cotar');
  });

  it('a janela de 24 h anda com a mensagem', async () => {
    const f = repoFalso();
    await processarEvento(umTexto('oi'), 'sig2', f.repo);
    expect(f.entradas).toHaveLength(1);
    expect(f.entradas[0].quando).toBe(new Date(1760000000 * 1000).toISOString());
  });

  it('status de entrega é aplicado', async () => {
    const f = repoFalso();
    const v = await processarEvento(envelope({
      statuses: [{ id: 'wamid.env', status: 'delivered', timestamp: '1760000300' }],
    }), 'sig3', f.repo);
    expect(v.statusAplicados).toBe(1);
    expect(v.resultado).toBe('processado');
  });
});

describe('idempotência — a Meta reenvia', () => {
  it('evento repetido devolve 200 e NÃO reprocessa', async () => {
    const f = repoFalso({ eventosJaVistos: ['sig-repetida'] });
    const v = await processarEvento(umTexto('oi'), 'sig-repetida', f.repo);
    expect(v.resultado).toBe('repetido');
    expect(v.http).toBe(200);
    expect(f.log).not.toContain('gravarMensagem');   // nem chegou perto do conteúdo
  });

  it('wamid repetido não duplica nem estica a janela', async () => {
    const f = repoFalso({ wamidsJaVistos: ['wamid.1'] });
    const v = await processarEvento(umTexto('oi', 'wamid.1'), 'sig-nova', f.repo);
    expect(v.mensagensNovas).toBe(0);
    expect(v.mensagensRepetidas).toBe(1);
    expect(f.entradas).toHaveLength(0);              // reprocessar não estica a janela
    expect(v.resultado).toBe('processado');
  });
});

describe('número desconhecido — não existe empresa padrão', () => {
  it('guarda o evento, não cria mensagem, devolve 200', async () => {
    const f = repoFalso({ numero: null });
    const v = await processarEvento(umTexto('oi'), 'sig4', f.repo);
    expect(v.resultado).toBe('numero_desconhecido');
    expect(v.http).toBe(200);                        // não é erro da Meta: não peça reenvio
    expect(f.log).toContain('guardarEvento');        // o cru fica, é o sinal do engano
    expect(f.log).not.toContain('gravarMensagem');   // mas não vira mensagem de ninguém
    expect(f.fechamentos[0].resultado).toBe('numero_desconhecido');
  });

  it('evento sem phone_number_id nenhum também não inventa empresa', async () => {
    const f = repoFalso();
    const v = await processarEvento({ object: 'whatsapp_business_account', entry: [] }, 'sig5', f.repo);
    expect(v.resultado).toBe('numero_desconhecido');
    expect(f.log).not.toContain('gravarMensagem');
  });
});

describe('falhas — evento válido não pode se perder', () => {
  it('falha ao GUARDAR o cru devolve 500, para a Meta reenviar', async () => {
    const f = repoFalso({ falhar: { guardarEvento: 'connection reset' } });
    const v = await processarEvento(umTexto('oi'), 'sig6', f.repo);
    expect(v.resultado).toBe('erro');
    expect(v.http).toBe(500);                        // único caso em que pedimos reenvio
    expect(v.detalhe).toContain('guardar o evento cru');
  });

  it('falha ao consultar o número devolve 500 antes de gravar qualquer coisa', async () => {
    const f = repoFalso({ falhar: { numeroDe: 'timeout' } });
    const v = await processarEvento(umTexto('oi'), 'sig7', f.repo);
    expect(v.http).toBe(500);
    expect(f.log).not.toContain('guardarEvento');
  });

  it('falha ao gravar a MENSAGEM devolve 200 — o cru está salvo, reprocessar é nosso', async () => {
    // 500 aqui faria a Meta reenviar um lote que a idempotência ia descartar: barulho até
    // a inscrição cair. O evento fica marcado 'erro' e sai no índice de problemas.
    const f = repoFalso({ falhar: { gravarMensagem: 'deadlock detected' } });
    const v = await processarEvento(umTexto('oi'), 'sig8', f.repo);
    expect(v.resultado).toBe('erro');
    expect(v.http).toBe(200);
    expect(f.fechamentos[0].resultado).toBe('erro');
    expect(f.fechamentos[0].detalhe).toContain('deadlock');
  });

  it('uma mensagem ruim não derruba as outras do mesmo lote', async () => {
    let n = 0;
    const f = repoFalso();
    const original = f.repo.gravarMensagem;
    f.repo.gravarMensagem = async (m) => { if (++n === 1) throw new Error('falha isolada'); return original(m); };
    const v = await processarEvento(envelope({
      contacts: [{ profile: { name: 'A' }, wa_id: '5511999998888' }],
      messages: [
        { from: '5511999998888', id: 'w1', timestamp: '1760000000', type: 'text', text: { body: 'um' } },
        { from: '5511977776666', id: 'w2', timestamp: '1760000001', type: 'text', text: { body: 'dois' } },
      ],
    }), 'sig9', f.repo);
    expect(v.mensagensNovas).toBe(1);                // a segunda entrou
    expect(v.resultado).toBe('erro');                // e o problema ficou registrado
  });

  it('falha ao FECHAR o evento não transforma 200 em 500', async () => {
    const f = repoFalso({ falhar: { fecharEvento: 'no connection' } });
    const v = await processarEvento(umTexto('oi'), 'sig10', f.repo);
    expect(v.http).toBe(200);
    expect(v.mensagensNovas).toBe(1);
  });
});

describe('descadastramento', () => {
  it('"SAIR" sozinho registra a saída', async () => {
    const f = repoFalso();
    const v = await processarEvento(umTexto('SAIR'), 'sig11', f.repo);
    expect(v.saidas).toBe(1);
    expect(f.saidas[0]).toEqual({ companyId: EMPRESA_A, telefone: '5511999998888' });
  });
  it('"pode parar a entrega de amanhã?" NÃO descadastra', async () => {
    const f = repoFalso();
    const v = await processarEvento(umTexto('pode parar a entrega de amanhã?'), 'sig12', f.repo);
    expect(v.saidas).toBe(0);
  });
  it('mensagem repetida não descadastra de novo', async () => {
    const f = repoFalso({ wamidsJaVistos: ['wamid.1'] });
    const v = await processarEvento(umTexto('SAIR', 'wamid.1'), 'sig13', f.repo);
    expect(v.saidas).toBe(0);
  });
});

describe('nada de conteúdo, telefone ou token no log', () => {
  it('o detalhe do erro não traz o texto da mensagem', async () => {
    const f = repoFalso({ falhar: { gravarMensagem: 'constraint violated' } });
    const v = await processarEvento(umTexto('MEU CARTAO E 4111 1111 1111 1111'), 'sig14', f.repo);
    expect(v.detalhe).not.toContain('4111');
    expect(v.detalhe).not.toContain('CARTAO');
  });

  it('o telefone sai mascarado', async () => {
    expect(telefoneMascarado('5511999998888')).toBe('5511•••••8888');
    expect(telefoneMascarado('123')).toBe('•••');
    const f = repoFalso({ falhar: { gravarMensagem: 'x' } });
    const v = await processarEvento(umTexto('oi'), 'sig15', f.repo);
    expect(v.detalhe).toContain('5511•••••8888');
    expect(v.detalhe).not.toContain('5511999998888');
  });

  it('o resumo de log não carrega número inteiro nem conteúdo', () => {
    const r = paraLog({
      resultado: 'processado', http: 200, mensagensNovas: 2, mensagensRepetidas: 0,
      statusAplicados: 1, saidas: 0, detalhe: null,
    }, PNID_A);
    expect(JSON.stringify(r)).not.toContain(PNID_A);
    expect(r.numero).toBe('…6214');
  });
});

describe('isolamento entre empresas', () => {
  it('a empresa vem SEMPRE do número, nunca do corpo do evento', async () => {
    // Um payload forjado não escolhe a empresa: quem decide é wa_numeros.
    const f = repoFalso({ numero: { companyId: EMPRESA_B, numeroId: 'num-b' } });
    const v = await processarEvento(umTexto('oi'), 'sig16', f.repo);
    expect(v.resultado).toBe('processado');
    expect(f.gravadas[0].companyId).toBe(EMPRESA_B);
    expect(f.gravadas[0].conversaId).toContain(EMPRESA_B);
    expect(f.gravadas[0].conversaId).not.toContain(EMPRESA_A);
  });
});
