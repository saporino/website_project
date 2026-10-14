// WhatsApp Cloud API — lógica PURA do webhook e da janela de atendimento.
//
// Sem I/O, sem Deno, sem banco: dá para testar inteiro no vitest, e é justamente a parte
// que mais erra em silêncio. O mesmo caminho que o Mercado Pago seguiu (`mpWebhook.ts`):
// um defeito de um caractere no manifest da assinatura só apareceria no primeiro
// pagamento real. Aqui a assinatura, a janela de 24 h e a leitura do evento vêm com teste.
//
// NADA aqui envia mensagem nem fala com a Meta. É só interpretação.

// ─────────────────────────────────────────────────────── verificação do webhook (GET)

export interface DesafioDaMeta {
  modo: string | null; token: string | null; challenge: string | null;
}

/**
 * A Meta chama o webhook com GET uma vez, para provar que a URL é nossa:
 * ?hub.mode=subscribe&hub.verify_token=<o que configuramos>&hub.challenge=<número>
 * Devolvemos o challenge em texto puro — e só se o token bater.
 *
 * Fail closed: token ausente, vazio ou diferente → null, e quem chama responde 403.
 */
export function respostaDoDesafio(d: DesafioDaMeta, tokenEsperado: string | undefined): string | null {
  if (!tokenEsperado) return null;                 // sem segredo configurado, ninguém entra
  if (d.modo !== 'subscribe') return null;
  if (!d.token || d.token !== tokenEsperado) return null;
  return d.challenge ?? null;
}

// ─────────────────────────────────────────── assinatura dos eventos (POST, X-Hub-256)

/** Compara dois hex sem vazar onde diferem (evita timing attack). */
export function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/**
 * O cabeçalho vem como `sha256=<hex>`. Devolve só o hex, em minúsculas, ou null.
 * Formato errado é recusa, não tentativa de adivinhar.
 */
export function hexDaAssinatura(cabecalho: string | null | undefined): string | null {
  if (!cabecalho) return null;
  const m = /^sha256=([a-f0-9]{64})$/i.exec(cabecalho.trim());
  return m ? m[1].toLowerCase() : null;
}

/**
 * Confere a assinatura do corpo. `hmacHex` é o HMAC-SHA256 do corpo CRU com o App Secret,
 * calculado por quem chama (precisa de crypto, que é I/O de plataforma).
 *
 * Regra: corpo tem de ser o texto exato recebido — reserializar o JSON muda um espaço e
 * a assinatura não bate mais.
 */
export function assinaturaConfere(cabecalho: string | null | undefined, hmacHex: string): boolean {
  const esperado = hexDaAssinatura(cabecalho);
  return esperado !== null && iguaisEmTempoConstante(esperado, hmacHex.toLowerCase());
}

// ─────────────────────────────────────────────────────────── leitura do evento (POST)

export type TipoDeMensagem = 'texto' | 'imagem' | 'documento' | 'audio' | 'video' | 'figurinha'
  | 'localizacao' | 'contato' | 'botao' | 'lista' | 'reacao' | 'outro';

export interface MensagemRecebida {
  idExterno: string;            // wamid — chave de idempotência
  telefone: string;             // E.164 sem '+'
  nomePerfil: string | null;
  tipo: TipoDeMensagem;
  texto: string | null;
  midiaId: string | null;       // precisa de uma segunda chamada p/ baixar
  midiaMime: string | null;
  recebidaEm: string;           // ISO
  numeroDaEmpresa: string;      // phone_number_id que recebeu — decide de QUAL empresa é
  bruto: unknown;
}

export interface StatusDeMensagem {
  idExterno: string;            // wamid da mensagem que ENVIAMOS
  estado: 'enviada' | 'entregue' | 'lida' | 'falhou';
  em: string;
  erro: string | null;
  numeroDaEmpresa: string;
}

export interface EventoLido {
  mensagens: MensagemRecebida[];
  statuses: StatusDeMensagem[];
  ignorados: number;            // o que veio e não sabemos tratar — conta, não derruba
}

const TIPOS: Record<string, TipoDeMensagem> = {
  text: 'texto', image: 'imagem', document: 'documento', audio: 'audio', video: 'video',
  sticker: 'figurinha', location: 'localizacao', contacts: 'contato', button: 'botao',
  interactive: 'lista', reaction: 'reacao',
};

const ESTADOS: Record<string, StatusDeMensagem['estado']> = {
  sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'falhou',
};

const umObjeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const umaLista = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const texto = (v: unknown): string | null => typeof v === 'string' && v !== '' ? v : null;

/** Segundos do epoch (string, como a Meta manda) → ISO. */
export function instanteDe(ts: unknown): string {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date(n * 1000).toISOString();
}

/**
 * Desembrulha o evento da Meta: entry[] → changes[] → value{ messages[], statuses[] }.
 *
 * Nunca lança. Um campo inesperado vira `ignorados++`, porque derrubar o webhook faz a
 * Meta reenviar o lote inteiro e, depois de muitas falhas, desativar a inscrição.
 */
export function lerEvento(payload: unknown): EventoLido {
  const out: EventoLido = { mensagens: [], statuses: [], ignorados: 0 };
  const raiz = umObjeto(payload);
  if (!raiz || raiz.object !== 'whatsapp_business_account') { out.ignorados++; return out; }

  for (const e of umaLista(raiz.entry)) {
    for (const c of umaLista(umObjeto(e)?.changes)) {
      const mudanca = umObjeto(c);
      if (mudanca?.field !== 'messages') { out.ignorados++; continue; }
      const valor = umObjeto(mudanca.value);
      if (!valor) { out.ignorados++; continue; }

      const numeroDaEmpresa = texto(umObjeto(valor.metadata)?.phone_number_id) ?? '';
      const nomes = new Map<string, string>();
      for (const ct of umaLista(valor.contacts)) {
        const contato = umObjeto(ct);
        const wa = texto(contato?.wa_id);
        const nome = texto(umObjeto(contato?.profile)?.name);
        if (wa && nome) nomes.set(wa, nome);
      }

      for (const m of umaLista(valor.messages)) {
        const msg = umObjeto(m);
        const id = texto(msg?.id), de = texto(msg?.from);
        if (!msg || !id || !de) { out.ignorados++; continue; }
        const tipoBruto = texto(msg.type) ?? '';
        const tipo = TIPOS[tipoBruto] ?? 'outro';
        const corpo = umObjeto(msg[tipoBruto]);
        out.mensagens.push({
          idExterno: id,
          telefone: soDigitos(de),
          nomePerfil: nomes.get(de) ?? null,
          tipo,
          texto: texto(umObjeto(msg.text)?.body)
            ?? texto(corpo?.caption)
            ?? texto(corpo?.emoji)
            ?? texto(umObjeto(corpo?.button_reply)?.title)
            ?? texto(umObjeto(corpo?.list_reply)?.title)
            ?? texto(corpo?.text),
          midiaId: texto(corpo?.id),
          midiaMime: texto(corpo?.mime_type),
          recebidaEm: instanteDe(msg.timestamp),
          numeroDaEmpresa,
          bruto: m,
        });
      }

      for (const s of umaLista(valor.statuses)) {
        const st = umObjeto(s);
        const id = texto(st?.id), estado = ESTADOS[texto(st?.status) ?? ''];
        if (!st || !id || !estado) { out.ignorados++; continue; }
        const erro = umaLista(st.errors).map(x => {
          const e2 = umObjeto(x);
          // `code` vem como NÚMERO (131047, 131026…), não string. Lido só como texto,
          // o código sumia e o atendente via "Re-engagement message" sem o número que
          // permite procurar a causa na documentação.
          const codigo = typeof e2?.code === 'number' ? String(e2.code) : texto(e2?.code);
          return [codigo, texto(e2?.title) ?? texto(e2?.message)].filter(Boolean).join(' ');
        }).filter(Boolean).join(' · ') || null;
        out.statuses.push({ idExterno: id, estado, em: instanteDe(st.timestamp), erro, numeroDaEmpresa });
      }
    }
  }
  return out;
}

// ───────────────────────────────────────────────────────────── telefone e janela de 24 h

/** Só os dígitos: a Meta manda E.164 sem '+', e o banco guarda do mesmo jeito. */
export function soDigitos(v: string): string { return String(v).replace(/\D+/g, ''); }

/**
 * Telefone brasileiro em E.164 (55 + DDD + número), a partir do que o usuário digitou.
 * Devolve null quando não dá para afirmar — melhor não ter telefone do que ter o errado.
 */
export function paraE164BR(entrada: string): string | null {
  let d = soDigitos(entrada);
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;        // veio sem o país
  if (!d.startsWith('55') || d.length < 12 || d.length > 13) return null;
  return d;
}

export const JANELA_HORAS = 24;

/**
 * Dentro da janela de atendimento?
 *
 * A Meta só deixa responder em texto livre nas 24 h seguintes à ÚLTIMA mensagem que o
 * cliente mandou. Fora dela, só modelo (template) aprovado — e modelo é cobrado. Sem esta
 * conta, a tela deixaria o atendente escrever uma resposta que a Meta recusa.
 */
export function dentroDaJanela(ultimaEntrada: string | Date | null, agora: Date = new Date()): boolean {
  if (!ultimaEntrada) return false;
  const t = ultimaEntrada instanceof Date ? ultimaEntrada.getTime() : Date.parse(ultimaEntrada);
  if (!Number.isFinite(t)) return false;
  const passou = agora.getTime() - t;
  return passou >= 0 && passou < JANELA_HORAS * 3600_000;
}

/** Quanto falta para a janela fechar, em minutos. Negativo = já fechou. */
export function minutosDeJanela(ultimaEntrada: string | Date | null, agora: Date = new Date()): number {
  if (!ultimaEntrada) return -1;
  const t = ultimaEntrada instanceof Date ? ultimaEntrada.getTime() : Date.parse(ultimaEntrada);
  if (!Number.isFinite(t)) return -1;
  return Math.floor((t + JANELA_HORAS * 3600_000 - agora.getTime()) / 60000);
}

// ────────────────────────────────────────────────────────────── consentimento / opt-out

/** Palavras que, sozinhas na mensagem, valem como pedido de descadastramento. */
const PALAVRAS_DE_SAIDA = ['sair', 'parar', 'pare', 'cancelar', 'descadastrar', 'stop', 'unsubscribe'];

/**
 * O cliente pediu para parar de receber?
 *
 * Só conta quando a mensagem é PRATICAMENTE só a palavra — "não quero parar de comprar"
 * não pode descadastrar ninguém. O atendimento humano continua; o que para é o envio
 * promocional.
 */
export function pediuParaSair(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const limpo = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, '').trim();
  if (limpo.length > 24) return false;
  const palavras = limpo.split(/\s+/).filter(Boolean);
  return palavras.length > 0 && palavras.every(p => PALAVRAS_DE_SAIDA.includes(p));
}
