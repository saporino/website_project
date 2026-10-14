// WhatsApp Cloud API — o que fazer com um evento, e em que ordem.
//
// Separado da função de borda de propósito: aqui não há Deno, rede nem banco. O `Repositorio`
// é uma interface; o teste passa um falso e consegue provocar as falhas que, em produção,
// só apareceriam com a Meta do outro lado.
//
// A ORDEM é a parte que importa, e ela vem de uma regra: a Meta reenvia o lote quando
// recebe erro, e desativa a inscrição depois de muitas falhas. Então:
//
//   1. assinatura inválida      → 401, NADA é gravado
//   2. guardar o evento CRU     → se falhar aqui, devolve 500 e a Meta reenvia (nada se perde)
//   3. evento já recebido antes → 200 na hora, sem reprocessar
//   4. número desconhecido      → 200, evento fica guardado com a marca, sem virar mensagem
//   5. falha ao processar       → 200 + evento marcado 'erro'. O cru está salvo; reprocessar
//                                 é problema nosso. Devolver 500 aqui faria a Meta reenviar
//                                 um lote que a idempotência ia descartar — barulho até a
//                                 inscrição cair.

import { lerEvento, pediuParaSair, type EventoLido, type MensagemRecebida, type StatusDeMensagem } from './whatsapp.ts';

export type Resultado =
  | 'assinatura_invalida' | 'repetido' | 'numero_desconhecido' | 'processado' | 'erro' | 'ignorado';

export interface Numero { companyId: string; numeroId: string; }

/** Tudo que o processamento precisa do mundo exterior. O teste implementa isto. */
export interface Repositorio {
  /** Grava o evento cru. 'repetido' quando a impressão digital já existe. */
  guardarEvento(e: {
    assinatura: string; corpo: unknown; phoneNumberId: string | null; companyId: string | null;
    mensagens: number; statuses: number; ignorados: number;
  }): Promise<'novo' | 'repetido'>;
  /** Empresa dona do número, ou null. NUNCA inventa uma empresa padrão. */
  numeroDe(phoneNumberId: string): Promise<Numero | null>;
  /** Contato por telefone dentro da empresa; cria se não existir. Devolve o id. */
  acharOuCriarContato(companyId: string, telefone: string, nomePerfil: string | null): Promise<string>;
  /** Conversa daquele contato naquele número; cria se não existir. */
  acharOuCriarConversa(companyId: string, numeroId: string, contatoId: string): Promise<string>;
  /** Grava a mensagem. 'repetida' quando o wamid já existe. */
  gravarMensagem(m: {
    companyId: string; conversaId: string; idExterno: string; tipo: string;
    texto: string | null; midiaId: string | null; midiaMime: string | null; ocorridaEm: string;
  }): Promise<'nova' | 'repetida'>;
  /** Atualiza a janela de 24 h e o contador de não lidas. */
  marcarEntrada(conversaId: string, quando: string): Promise<void>;
  /** Estado de entrega de uma mensagem que NÓS enviamos. Silencioso se não a conhecemos. */
  atualizarEstado(s: StatusDeMensagem): Promise<void>;
  /** Registra o pedido de descadastramento. Não encerra o atendimento humano. */
  registrarSaida(companyId: string, telefone: string): Promise<void>;
  /** Fecha a linha do evento com o veredito. */
  fecharEvento(assinatura: string, resultado: Resultado, detalhe: string | null): Promise<void>;
}

export interface Veredito {
  resultado: Resultado;
  http: number;
  mensagensNovas: number;
  mensagensRepetidas: number;
  statusAplicados: number;
  saidas: number;
  /** Para log: NUNCA contém texto de mensagem, telefone ou token. */
  detalhe: string | null;
}

/** Telefone só em contagem e nunca inteiro no log: 5511•••••8888. */
export function telefoneMascarado(t: string): string {
  if (t.length < 8) return '•'.repeat(t.length);
  return t.slice(0, 4) + '•'.repeat(t.length - 8) + t.slice(-4);
}

/**
 * Processa um evento JÁ com assinatura conferida.
 *
 * `assinatura` é a impressão digital do corpo cru (o próprio hex do HMAC serve): é ela que
 * torna a entrega repetida um no-op.
 */
export async function processarEvento(
  corpo: unknown, assinatura: string, repo: Repositorio,
): Promise<Veredito> {
  const vazio: Veredito = {
    resultado: 'ignorado', http: 200, mensagensNovas: 0, mensagensRepetidas: 0,
    statusAplicados: 0, saidas: 0, detalhe: null,
  };

  const lido: EventoLido = lerEvento(corpo);
  const phoneNumberId = lido.mensagens[0]?.numeroDaEmpresa
    ?? lido.statuses[0]?.numeroDaEmpresa ?? null;

  // O número decide a empresa. Sem número conhecido, não existe empresa — e sem empresa,
  // nada vira mensagem. O evento cru ainda é guardado: é assim que se enxerga o engano.
  let numero: Numero | null = null;
  if (phoneNumberId) {
    try { numero = await repo.numeroDe(phoneNumberId); }
    catch { return { ...vazio, resultado: 'erro', http: 500, detalhe: 'falha ao consultar o numero' }; }
  }

  // Passo 2: guardar o cru ANTES de processar. Se isto falhar, 500 — a Meta reenvia e
  // nada se perde. É o único caso em que pedimos reenvio.
  let estado: 'novo' | 'repetido';
  try {
    estado = await repo.guardarEvento({
      assinatura, corpo, phoneNumberId, companyId: numero?.companyId ?? null,
      mensagens: lido.mensagens.length, statuses: lido.statuses.length, ignorados: lido.ignorados,
    });
  } catch {
    return { ...vazio, resultado: 'erro', http: 500, detalhe: 'falha ao guardar o evento cru' };
  }
  if (estado === 'repetido') return { ...vazio, resultado: 'repetido' };

  if (!phoneNumberId || !numero) {
    const r: Resultado = 'numero_desconhecido';
    await semQuebrar(() => repo.fecharEvento(assinatura, r, 'phone_number_id fora de wa_numeros'));
    return { ...vazio, resultado: r, detalhe: 'numero nao cadastrado' };
  }

  const v: Veredito = { ...vazio, resultado: 'processado' };
  const problemas: string[] = [];

  for (const m of lido.mensagens) {
    try { await umaMensagem(m, numero, repo, v); }
    catch (e) {
      // Uma mensagem ruim não derruba as outras do mesmo lote.
      problemas.push(`mensagem ${telefoneMascarado(m.telefone)}: ${motivo(e)}`);
    }
  }
  for (const s of lido.statuses) {
    try { await repo.atualizarEstado(s); v.statusAplicados++; }
    catch (e) { problemas.push(`status: ${motivo(e)}`); }
  }

  if (problemas.length) {
    v.resultado = 'erro';
    v.detalhe = problemas.slice(0, 5).join(' · ');
  }
  // 200 mesmo com problema: o cru está guardado e dá para reprocessar sem pedir nada à Meta.
  await semQuebrar(() => repo.fecharEvento(assinatura, v.resultado, v.detalhe));
  return v;
}

async function umaMensagem(m: MensagemRecebida, numero: Numero, repo: Repositorio, v: Veredito) {
  const contatoId = await repo.acharOuCriarContato(numero.companyId, m.telefone, m.nomePerfil);
  const conversaId = await repo.acharOuCriarConversa(numero.companyId, numero.numeroId, contatoId);
  const gravada = await repo.gravarMensagem({
    companyId: numero.companyId, conversaId, idExterno: m.idExterno, tipo: m.tipo,
    texto: m.texto, midiaId: m.midiaId, midiaMime: m.midiaMime, ocorridaEm: m.recebidaEm,
  });
  if (gravada === 'repetida') { v.mensagensRepetidas++; return; }
  v.mensagensNovas++;
  // A janela de 24 h só anda com mensagem NOVA; reprocessar não pode esticá-la.
  await repo.marcarEntrada(conversaId, m.recebidaEm);
  if (pediuParaSair(m.texto)) { await repo.registrarSaida(numero.companyId, m.telefone); v.saidas++; }
}

/** Motivo curto e sem conteúdo: nome do erro, nunca o texto da mensagem. */
function motivo(e: unknown): string {
  const t = e instanceof Error ? e.message : String(e);
  return t.replace(/\s+/g, ' ').slice(0, 80);
}

/** Fechar o evento é registro: falhar aqui não pode trocar um 200 por um 500. */
async function semQuebrar(f: () => Promise<unknown>) { try { await f(); } catch { /* registrado no log */ } }

/** Resumo para o log. Sem texto de mensagem, sem telefone inteiro, sem token. */
export function paraLog(v: Veredito, phoneNumberId: string | null) {
  return {
    resultado: v.resultado, http: v.http, numero: phoneNumberId ? '…' + phoneNumberId.slice(-4) : null,
    novas: v.mensagensNovas, repetidas: v.mensagensRepetidas,
    statuses: v.statusAplicados, saidas: v.saidas, detalhe: v.detalhe,
  };
}
