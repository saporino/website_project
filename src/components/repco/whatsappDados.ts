// A camada de dados da central de WhatsApp. Separada da tela de propósito: o componente
// desenha, isto busca. Assim dá para trocar a origem (demo ↔ banco) sem mexer no desenho.
//
// Tudo passa pela RLS: `vw_wa_caixa` não é security definer, então cada pessoa só enxerga
// as conversas da empresa em que tem papel. Nada aqui usa service role.
import { supabase } from '../../lib/supabase';
import type { ConversaDemo, MensagemDemo } from './whatsappDemo';

/** Uma linha de `vw_wa_caixa`. */
interface LinhaDaCaixa {
  id: string; company_id: string; status: string; nao_lidas: number;
  responsavel_id: string | null; ultima_entrada_em: string | null; ultima_saida_em: string | null;
  contato_id: string; telefone_e164: string; nome_perfil: string | null;
  representative_client_id: string | null; numero_rotulo: string | null;
  janela_aberta: boolean; janela_minutos: number;
}

interface LinhaDeMensagem {
  id: string; conversa_id: string; id_externo: string; direcao: 'entrada' | 'saida';
  tipo: string; texto: string | null; midia_mime: string | null;
  estado: string | null; erro_codigo: string | null; erro_texto: string | null;
  ocorrida_em: string;
}

/** Minutos entre `quando` e agora. A tela pensa em "há quanto tempo", não em data. */
const minutosAtras = (quando: string | null): number => {
  if (!quando) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, (Date.now() - new Date(quando).getTime()) / 60000);
};

const TIPO_TELA: Record<string, MensagemDemo['tipo']> = {
  texto: 'texto', imagem: 'imagem', documento: 'documento',
};

/** Nome de arquivo nunca vem da Meta; o que temos é o tipo. Melhor dizer o que é. */
function rotuloDoAnexo(tipo: string, mime: string | null): string | undefined {
  if (tipo === 'texto' || tipo === 'outro') return undefined;
  const nomes: Record<string, string> = {
    imagem: 'Imagem', documento: 'Documento', audio: 'Áudio', video: 'Vídeo',
    figurinha: 'Figurinha', localizacao: 'Localização', contato: 'Contato',
  };
  return `${nomes[tipo] ?? 'Anexo'}${mime ? ` · ${mime}` : ''}`;
}

export interface CaixaDoBanco { conversas: ConversaDemo[]; empresas: number; }

/**
 * Lê a caixa inteira: conversas + mensagens, já no formato que a tela desenha.
 *
 * Duas consultas em vez de um join por conversa: a caixa de atendimento é pequena por
 * natureza (o que importa é o que está aberto), e uma consulta por conversa viraria dezenas
 * de idas ao banco só para pintar a lista.
 */
export async function lerCaixa(limite = 100, companyId?: string | null): Promise<CaixaDoBanco> {
  // ⚠️ FILTRA PELA EMPRESA ESCOLHIDA NO TOPO.
  //
  // A RLS garante que ninguém veja conversa de empresa onde não tem papel —
  // mas quem tem papel em DUAS via as duas misturadas, debaixo de um título
  // que dizia "COFICO" fixo. Trocar a empresa no seletor não mudava nada.
  //
  // Conversa de cliente é da empresa que atende. Misturar Saporino com COFICO
  // na mesma caixa é o caminho curto para responder pela marca errada.
  let consulta = supabase
    .from('vw_wa_caixa').select('*')
    .order('ultima_entrada_em', { ascending: false, nullsFirst: false })
    .limit(limite);
  if (companyId) consulta = consulta.eq('company_id', companyId);
  const { data: caixa, error } = await consulta;
  if (error) throw new Error(error.message);
  const linhas = (caixa ?? []) as LinhaDaCaixa[];
  if (linhas.length === 0) return { conversas: [], empresas: 0 };

  const { data: msgs, error: e2 } = await supabase
    .from('wa_mensagens')
    .select('id, conversa_id, id_externo, direcao, tipo, texto, midia_mime, estado, erro_codigo, erro_texto, ocorrida_em')
    .in('conversa_id', linhas.map(l => l.id))
    .order('ocorrida_em', { ascending: true });
  if (e2) throw new Error(e2.message);

  const porConversa = new Map<string, LinhaDeMensagem[]>();
  for (const m of (msgs ?? []) as LinhaDeMensagem[]) {
    const lista = porConversa.get(m.conversa_id) ?? [];
    lista.push(m);
    porConversa.set(m.conversa_id, lista);
  }

  // Nome do responsável vem por RPC (user_profiles só deixa o dono ler o próprio perfil).
  const comResponsavel = linhas.filter(l => l.responsavel_id);
  const nomes = new Map<string, string>();
  await Promise.all(comResponsavel.map(async l => {
    const { data } = await supabase.rpc('wa_nome_do_atendente', { p_conversa: l.id });
    if (data) nomes.set(l.id, data as string);
  }));

  const conversas: ConversaDemo[] = linhas.map(l => ({
    id: l.id,
    nome: l.nome_perfil?.trim() || 'Sem nome no perfil',
    telefone: l.telefone_e164,
    cliente: l.representative_client_id ? 'Cliente cadastrado' : null,
    naoLidas: l.nao_lidas,
    responsavel: nomes.get(l.id) ?? (l.responsavel_id ? 'Atendente' : null),
    // A tela conta a janela a partir daqui; a view já devolve `janela_minutos`, mas o
    // desenho usa "minutos desde a entrada" para também mostrar "há quanto tempo".
    desdeEntrada: minutosAtras(l.ultima_entrada_em),
    mensagens: (porConversa.get(l.id) ?? []).map(m => ({
      id: m.id,
      direcao: m.direcao,
      texto: m.texto ?? '',
      ha: minutosAtras(m.ocorrida_em),
      estado: (m.estado ?? undefined) as MensagemDemo['estado'],
      erro: [m.erro_codigo, m.erro_texto].filter(Boolean).join(' ') || undefined,
      tipo: TIPO_TELA[m.tipo] ?? 'texto',
      anexo: rotuloDoAnexo(m.tipo, m.midia_mime),
    })),
  }));

  return { conversas, empresas: new Set(linhas.map(l => l.company_id)).size };
}

/** Zera o contador. O banco confere o papel; a tela não decide isso sozinha. */
export async function marcarLida(conversaId: string): Promise<void> {
  const { error } = await supabase.rpc('wa_marcar_lida', { p_conversa: conversaId });
  if (error) throw new Error(error.message);
}

/** Assume ou larga o atendimento. Largar a conversa de outro é recusado pelo banco. */
export async function assumirAtendimento(conversaId: string, assumir: boolean): Promise<void> {
  const { error } = await supabase.rpc('wa_assumir', { p_conversa: conversaId, p_assumir: assumir });
  if (error) throw new Error(error.message);
}

export interface ResultadoEnvio {
  ok: boolean; simulado?: boolean; duplicado?: boolean; explicacao?: string; motivo?: string;
}

/**
 * Envia a resposta. O token da Meta NUNCA passa por aqui: quem fala com a Meta é a função
 * de borda, com a sessão da pessoa no cabeçalho.
 *
 * `chave` é gerada no navegador e é o que impede o clique duplo de virar duas mensagens
 * para o cliente — o banco recusa a segunda.
 */
export async function enviarMensagem(conversaId: string, texto: string): Promise<ResultadoEnvio> {
  const chave = crypto.randomUUID();
  const { data, error } = await supabase.functions.invoke('whatsapp-enviar', {
    body: { conversa: conversaId, texto, chave },
  });
  if (error) {
    // O corpo do erro traz a explicação em português que a função devolveu.
    const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
    return { ok: false, explicacao: corpo?.explicacao ?? 'Não foi possível enviar agora.', motivo: corpo?.motivo };
  }
  return (data ?? { ok: false, explicacao: 'Resposta vazia do servidor.' }) as ResultadoEnvio;
}

/** Quem está olhando pode usar a central? Admin, ou papel `atendimento` em alguma empresa. */
export async function podeAtender(): Promise<{ pode: boolean; admin: boolean }> {
  const [{ data: admin }, { data: papeis }] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.from('user_roles').select('company_id').eq('role_code', 'atendimento').eq('is_active', true),
  ]);
  return { pode: !!admin || (papeis?.length ?? 0) > 0, admin: !!admin };
}
