// Seller Central — quem está entrando.
//
// A identidade é o Supabase Auth de verdade. Não existe senha de
// demonstração no código nem caminho alternativo: quem entra é um usuário
// real, ligado a um vendedor por `lv_seller_users`, e é esse vínculo que a
// RLS do banco confere em cada leitura e escrita.
import { supabase } from '../../../lib/supabase';

export interface LojaDoVendedor {
  id: string;
  slug: string;
  nome: string;
  chamada: string | null;
  historia: string | null;
  especialidade: string | null;
  cidade: string | null;
  uf: string | null;
  cor: string | null;
  iniciais: string | null;
  ativa: boolean;
  is_demo: boolean;
}

export interface ContextoDoVendedor {
  email: string | null;
  sellerId: string;
  sellerNome: string;
  sellerStatus: string;
  /** Habilitação para receber vendas. Só "verificado" recebe. */
  pagamentoStatus: string;
  loja: LojaDoVendedor | null;
}

export type Contexto =
  | { tipo: 'anonimo' }
  | { tipo: 'sem_vinculo'; email: string | null }
  | { tipo: 'vendedor'; contexto: ContextoDoVendedor };

export async function carregarContexto(): Promise<Contexto> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { tipo: 'anonimo' };

  // Filtrar pelo próprio usuário importa: um administrador enxerga TODOS
  // os vínculos pela policy de admin, e sem este filtro cairia na loja do
  // primeiro vendedor da lista.
  const { data: vinculos } = await supabase
    .from('lv_seller_users').select('seller_id').eq('user_id', user.id).limit(1);
  const sellerId = (vinculos as { seller_id: string }[] | null)?.[0]?.seller_id;
  if (!sellerId) return { tipo: 'sem_vinculo', email: user.email ?? null };

  const [vendedor, loja] = await Promise.all([
    supabase.from('lv_sellers').select('id, nome_fantasia, status, pagamento_status').eq('id', sellerId).maybeSingle(),
    supabase.from('lv_stores')
      .select('id, slug, nome, chamada, historia, especialidade, cidade, uf, cor, iniciais, ativa, is_demo')
      .eq('seller_id', sellerId).order('created_at').limit(1).maybeSingle(),
  ]);

  const v = vendedor.data as { nome_fantasia: string; status: string; pagamento_status: string } | null;
  return {
    tipo: 'vendedor',
    contexto: {
      email: user.email ?? null,
      sellerId,
      sellerNome: v?.nome_fantasia ?? 'Vendedor',
      sellerStatus: v?.status ?? 'rascunho',
      pagamentoStatus: v?.pagamento_status ?? 'nao_iniciado',
      loja: (loja.data as LojaDoVendedor | null) ?? null,
    },
  };
}

/** Devolve a mensagem de erro em português, ou null quando entrou. */
export async function entrar(email: string, senha: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (!error) return null;
  if (/invalid login credentials/i.test(error.message)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(error.message)) return 'Este e-mail ainda não foi confirmado.';
  return 'Não foi possível entrar agora. Tente de novo em instantes.';
}

export async function sair() {
  await supabase.auth.signOut();
}
