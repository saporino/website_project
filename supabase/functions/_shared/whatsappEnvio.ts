// Envio de mensagem pela central — as decisões, sem I/O.
//
// A ordem aqui existe por um motivo: **nada sai para a Meta antes de a linha existir no
// banco**. Se a Meta respondesse e o banco falhasse depois, o cliente teria recebido uma
// mensagem que o atendimento não sabe que mandou. O contrário é recuperável: uma linha
// marcada como falha é visível e dá para tentar de novo.

export type MotivoRecusa =
  | 'conversa_inexistente' | 'sem_permissao' | 'numero_nao_envia' | 'janela_fechada'
  | 'texto_vazio' | 'texto_longo' | 'chave_invalida' | 'nao_autenticado';

/** O limite do WhatsApp para mensagem de texto. Cortar no servidor, não só na tela. */
export const LIMITE_TEXTO = 4096;

export const EXPLICACAO: Record<MotivoRecusa, string> = {
  conversa_inexistente: 'Esta conversa não existe.',
  sem_permissao: 'Você não tem permissão para responder nesta conversa.',
  numero_nao_envia: 'Este número ainda não está habilitado para enviar.',
  janela_fechada: 'A janela de 24 horas fechou. Só o cliente pode reabrir a conversa.',
  texto_vazio: 'Escreva alguma coisa antes de enviar.',
  texto_longo: `A mensagem passa de ${LIMITE_TEXTO} caracteres.`,
  chave_invalida: 'Pedido de envio mal formado.',
  nao_autenticado: 'Entre na sua conta para responder.',
};

export interface PedidoDeEnvio { conversa?: unknown; texto?: unknown; chave?: unknown }
export interface PedidoValido { conversa: string; texto: string; chave: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Confere a forma do pedido antes de qualquer consulta.
 *
 * A chave de idempotência é obrigatória e precisa ser um UUID: é ela que impede o clique
 * duplo de virar duas mensagens para o cliente. Sem ela, não há envio.
 */
export function lerPedido(p: PedidoDeEnvio): { ok: true; pedido: PedidoValido } | { ok: false; motivo: MotivoRecusa } {
  const conversa = typeof p.conversa === 'string' ? p.conversa.trim() : '';
  const chave = typeof p.chave === 'string' ? p.chave.trim() : '';
  const bruto = typeof p.texto === 'string' ? p.texto : '';
  if (!UUID.test(conversa) || !UUID.test(chave)) return { ok: false, motivo: 'chave_invalida' };
  const texto = bruto.replace(/\r\n/g, '\n').trim();
  if (!texto) return { ok: false, motivo: 'texto_vazio' };
  if (texto.length > LIMITE_TEXTO) return { ok: false, motivo: 'texto_longo' };
  return { ok: true, pedido: { conversa, texto, chave } };
}

/** Resposta de `wa_pode_enviar`. A regra mora no banco; aqui só se lê o veredito. */
export interface Veredito {
  pode: boolean; motivo?: MotivoRecusa;
  company_id?: string; numero_id?: string; phone_number_id?: string;
  telefone?: string; ambiente?: string; janela_minutos?: number;
}

export function lerVeredito(v: unknown): Veredito {
  const o = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  if (o.pode !== true) {
    const m = typeof o.motivo === 'string' ? o.motivo : 'sem_permissao';
    return { pode: false, motivo: m as MotivoRecusa };
  }
  return {
    pode: true,
    company_id: String(o.company_id ?? ''), numero_id: String(o.numero_id ?? ''),
    phone_number_id: String(o.phone_number_id ?? ''), telefone: String(o.telefone ?? ''),
    ambiente: String(o.ambiente ?? ''), janela_minutos: Number(o.janela_minutos ?? 0),
  };
}

/** O corpo que a Cloud API espera para uma mensagem de texto. */
export function corpoParaMeta(telefone: string, texto: string) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: telefone,
    type: 'text',
    // `preview_url: false` de propósito: um link numa resposta comercial não deve virar
    // cartão com imagem de terceiro sem alguém ter escolhido isso.
    text: { preview_url: false, body: texto },
  };
}

export interface RespostaDaMeta { wamid: string | null; erroCodigo: string | null; erroTexto: string | null }

/**
 * Lê a resposta da Meta. Nunca lança: um corpo inesperado vira falha explicada, porque a
 * linha da mensagem já existe e precisa receber um veredito.
 */
export function lerRespostaDaMeta(status: number, corpo: unknown): RespostaDaMeta {
  const o = (corpo && typeof corpo === 'object') ? corpo as Record<string, unknown> : {};
  const erro = (o.error && typeof o.error === 'object') ? o.error as Record<string, unknown> : null;
  if (erro) {
    const codigo = erro.code != null ? String(erro.code) : String(status);
    const detalhe = (erro.error_data && typeof erro.error_data === 'object')
      ? String((erro.error_data as Record<string, unknown>).details ?? '') : '';
    const texto = [erro.message, detalhe].filter(Boolean).join(' · ') || `HTTP ${status}`;
    return { wamid: null, erroCodigo: codigo, erroTexto: String(texto).slice(0, 300) };
  }
  const msgs = Array.isArray(o.messages) ? o.messages : [];
  const primeira = (msgs[0] && typeof msgs[0] === 'object') ? msgs[0] as Record<string, unknown> : null;
  const wamid = primeira && typeof primeira.id === 'string' ? primeira.id : null;
  if (!wamid || status >= 400) {
    return { wamid: null, erroCodigo: String(status), erroTexto: 'resposta sem id de mensagem' };
  }
  return { wamid, erroCodigo: null, erroTexto: null };
}

/** Id provisório, usado entre gravar a linha e a Meta responder. */
export const idProvisorio = (chave: string) => `pendente:${chave}`;
/** Id de um envio SIMULADO: o prefixo denuncia, no banco e na tela, que não saiu de verdade. */
export const idSimulado = (chave: string) => `wamid.SIMULADO.${chave}`;
export const foiSimulado = (idExterno: string) => idExterno.startsWith('wamid.SIMULADO.');
