// Observabilidade do Coffee LiVRE — nenhuma falha silenciosa.
//
// Toda operação que fala com o banco e pode falhar passa o erro por aqui:
//   1. classifica (autenticação, permissão/RLS, validação do banco, rede, banco);
//   2. escreve UM evento estruturado no console, sempre com o mesmo formato;
//   3. devolve a mensagem que a tela mostra ao usuário.
//
// O rastro de negócio fica no servidor (lv_price_history, lv_b2b_solicitacoes,
// pedidos no futuro). Este módulo é o rastro técnico do lado de quem usa. Ainda
// não há coleta central (Sentry/tabela de eventos): o destino é decisão a tomar
// antes do checkout real, e trocar o destino é mudar só `emitir`.

export type TipoDeFalha = 'autenticacao' | 'permissao' | 'validacao' | 'rede' | 'banco';

export type Operacao =
  | 'aplicar-preco' | 'desfazer-preco' | 'b2b-solicitar' | 'salvar-produto'
  | 'publicar-produto' | 'login' | 'checkout' | 'carregar';

export interface EventoDeFalha {
  operacao: Operacao;
  tipo: TipoDeFalha;
  codigo: string | null;
  mensagem: string;
  momento: string;
}

type ErroBruto = { message?: string; code?: string; status?: number; name?: string } | Error | string | null | undefined;

export function classificarFalha(erro: ErroBruto): { tipo: TipoDeFalha; codigo: string | null; mensagem: string } {
  const e = (typeof erro === 'string' ? { message: erro } : erro ?? {}) as { message?: string; code?: string; status?: number; name?: string };
  const mensagem = (e.message ?? 'Erro desconhecido.').trim();
  const codigo = e.code ?? (e.status != null ? String(e.status) : null);
  const m = mensagem.toLowerCase();

  if (e.status === 401 || /jwt|token|not authenticated|sessão expirada|invalid login|invalid_credentials/.test(m) || codigo === 'PGRST301') {
    return { tipo: 'autenticacao', codigo, mensagem };
  }
  if (e.status === 403 || codigo === '42501' || /permission denied|row-level security|violates row-level|não autorizado|sem permissão/.test(m)) {
    return { tipo: 'permissao', codigo, mensagem };
  }
  if (e.name === 'TypeError' && /fetch|network|failed to fetch|load failed/.test(m)) {
    return { tipo: 'rede', codigo, mensagem };
  }
  // Regra de negócio recusada pelo próprio banco (raise exception / check).
  if (codigo === 'P0001' || codigo === '23514' || codigo === '23505' || codigo === '22023') {
    return { tipo: 'validacao', codigo, mensagem };
  }
  return { tipo: 'banco', codigo, mensagem };
}

const TEXTO_PARA_USUARIO: Record<Exclude<TipoDeFalha, 'validacao' | 'banco'>, string> = {
  autenticacao: 'Sua sessão expirou. Entre de novo para continuar.',
  permissao: 'Você não tem permissão para fazer isto.',
  rede: 'Sem conexão com o servidor. Confira a internet e tente de novo.',
};

let emitir = (evento: EventoDeFalha) => {
  console.error('[coffeelivre]', JSON.stringify(evento));
};

/** Só para testes: troca o destino dos eventos. */
export function _definirDestino(destino: (evento: EventoDeFalha) => void) { emitir = destino; }

/**
 * Registra a falha e devolve a mensagem para a tela. Validação do banco
 * (piso, origem, estoque) já vem escrita para o usuário e é repassada.
 */
export function registrarFalha(operacao: Operacao, erro: ErroBruto, padrao = 'Não foi possível concluir. Tente de novo.'): string {
  const c = classificarFalha(erro);
  emitir({ operacao, tipo: c.tipo, codigo: c.codigo, mensagem: c.mensagem, momento: new Date().toISOString() });
  if (c.tipo === 'validacao') return c.mensagem;
  if (c.tipo === 'banco') return c.mensagem && c.mensagem !== 'Erro desconhecido.' ? c.mensagem : padrao;
  return TEXTO_PARA_USUARIO[c.tipo];
}
