// AUDITORIA DE ACESSO — o que um visitante e um cliente cadastrado conseguem ler?
//
// Pergunta do Vlademir (05/10/2026): "se o público começar a entrar na Saporino e se
// cadastrar, alguém de fora consegue ver o RepCo?" Esta bancada responde com teste, não
// com opinião: entra como anônimo e como usuário comum recém-criado e tenta ler as tabelas
// que guardam dinheiro, cliente e comissão.
//
// Nada é escrito no banco além do usuário temporário, que é apagado no fim.
//   node scripts/auditoria-acesso-publico.mjs
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, confirmarNoBanco, anunciar } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: true });
const env = ambiente.env;
anunciar(ambiente);
const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, semSessao);
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

// O que NUNCA pode vazar para fora do painel.
const SIGILOSAS = [
  ['representative_orders', 'pedidos do RepCo'],
  ['representative_clients', 'clientes dos representantes'],
  ['representatives', 'cadastro dos representantes (CPF, comissão)'],
  ['representative_commissions', 'comissão por pedido'],
  ['representative_commission_payouts', 'pagamentos de comissão'],
  ['representative_order_installments', 'boletos e parcelas'],
  ['price_lists', 'tabela de preço B2B'],
  ['green_coffee_lots', 'custo do café verde'],
  ['embalagem_custos', 'custo de embalagem (interno)'],
  ['embalagem_pedidos', 'pedidos de embalagem do site'],
  ['orders', 'pedidos da loja'],
  // user_profiles fica fora da lista cega: a pessoa PRECISA ler a própria linha. O teste
  // dela é logo abaixo, e cobra que ela não leia a de ninguém mais.
  ['prospects_b2b', 'base de prospecção'],
  ['studio_social_connections', 'tokens das redes sociais'],
  ['studio_campaigns', 'campanhas do Studio'],
  ['notifications', 'notificações do admin'],
  ['lot_documents', 'documentos de lote'],
  ['delivery_proofs', 'comprovantes de entrega'],
];

let falhas = 0, criterios = 0;
const checar = (t, ok, d = '') => { criterios++; if (ok) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };

async function sondar(cli, rotulo) {
  console.log(`\n=== ${rotulo} ===`);
  for (const [tabela, oque] of SIGILOSAS) {
    const { data, error } = await cli.from(tabela).select('*').limit(1);
    const vazou = !error && Array.isArray(data) && data.length > 0;
    checar(`${rotulo} não lê ${tabela} (${oque})`, !vazou,
      vazou ? `LEU ${data.length} linha(s): ${Object.keys(data[0]).slice(0, 6).join(', ')}` : '');
  }
}

// 1) visitante sem login
const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
await sondar(anon, 'Visitante (sem login)');

// 2) cliente que se cadastrou na loja: usuário comum, sem is_admin e sem representante
const email = `auditoria-acesso-${crypto.randomBytes(5).toString('hex')}@coffeelivre.test`;
const senha = crypto.randomBytes(24).toString('base64url') + 'Aa1!';
const { data: criado, error: ec } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
if (ec) throw new Error(ec.message);
try {
  const cli = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
  const { error: el } = await cli.auth.signInWithPassword({ email, password: senha });
  if (el) throw new Error(el.message);
  await sondar(cli, 'Cliente cadastrado');

  // user_profiles tem de deixar ler A PRÓPRIA linha e só ela — é assim que o painel sabe
  // o nome de quem entrou. Ler a de outros seria vazamento de cadastro.
  const { data: perfis } = await cli.from('user_profiles').select('id, full_name, is_admin').limit(50);
  const deOutros = (perfis ?? []).filter(p => p.id !== criado.user.id);
  checar('Cliente cadastrado lê só o próprio perfil', deOutros.length === 0,
    `leu ${deOutros.length} perfil(is) de outras pessoas`);

  // as funções que decidem quem é quem têm de dizer "não" para ele
  const { data: ehAdmin } = await cli.rpc('is_admin');
  checar('Cliente cadastrado não é admin', ehAdmin !== true, `is_admin devolveu ${ehAdmin}`);
  const { data: repId } = await cli.rpc('my_rep_id');
  checar('Cliente cadastrado não é representante', !repId, `my_rep_id devolveu ${repId}`);
} finally {
  await admin.auth.admin.deleteUser(criado.user.id);
}

console.log(`\n${criterios - falhas}/${criterios} critérios`);
process.exit(falhas ? 1 : 0);
