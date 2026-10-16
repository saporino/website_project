// Prova, com sessao de verdade, se um cliente comum consegue virar ADMIN sozinho.
//
//   node scripts/auditoria-escalada-de-privilegio.mjs
//
// Por que esta bancada existe: `is_admin()` le `user_profiles.is_admin`, e a policy
// "Users fully manage profile" e FOR ALL USING (auth.uid() = id) SEM WITH CHECK.
// Se isso for o que parece, qualquer pessoa cadastrada escreve `is_admin = true`
// na propria linha e ganha o sistema inteiro. Abrir o cadastro PF ao publico sem
// fechar isso seria entregar a chave junto com a porta.
//
// STAGING, sempre. Cria um usuario temporario e apaga no fim.
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { escolherAmbiente, anunciar, confirmarNoBanco } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: true });
anunciar(ambiente);
const env = ambiente.env;
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

let ok = 0; const falhas = [];
const checa = (n, c, d = '') => { if (c) { ok++; console.log(`  ok    ${n}`); } else { falhas.push(n + (d ? ` — ${d}` : '')); console.log(`  FALHA ${n}${d ? ' — ' + d : ''}`); } };

const EMAIL = `escalada-${Date.now()}@teste.local`;
const SENHA = crypto.randomBytes(18).toString('base64url');   // nunca impressa
let uid = null;

async function rodar() {
  console.log('\n— preparo: um cliente comum, como qualquer um que se cadastra —');
  const { data: criado, error: eCria } = await admin.auth.admin.createUser({
    email: EMAIL, password: SENHA, email_confirm: true,
  });
  if (eCria) throw new Error('nao criou usuario: ' + eCria.message);
  uid = criado.user.id;
  console.log(`  usuario temporario criado (${EMAIL})`);

  // O gatilho handle_new_user cria o perfil. Confere que nasce SEM admin.
  const { data: p0 } = await admin.from('user_profiles').select('is_admin, phone, full_name').eq('id', uid).maybeSingle();
  checa('o perfil nasce com is_admin = false', p0?.is_admin !== true, JSON.stringify(p0));

  console.log('\n— a sessao real desse cliente —');
  const comoCliente = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: eLogin } = await comoCliente.auth.signInWithPassword({ email: EMAIL, password: SENHA });
  if (eLogin) throw new Error('nao logou: ' + eLogin.message);
  console.log('  logado com JWT de verdade (sem service role)');

  console.log('\n— A PERGUNTA: ele consegue se promover a admin? —');
  const { error: eUp } = await comoCliente.from('user_profiles')
    .update({ is_admin: true }).eq('id', uid);

  // Le pelo lado do servico: o que vale e o que ficou gravado, nao o que a API respondeu.
  const { data: p1 } = await admin.from('user_profiles').select('is_admin').eq('id', uid).maybeSingle();
  const virouAdmin = p1?.is_admin === true;

  checa('o banco RECUSA o cliente virar admin', !virouAdmin,
    virouAdmin ? 'ESCALADA DE PRIVILEGIO CONFIRMADA' : (eUp?.message ?? ''));

  if (virouAdmin) {
    console.log('\n  >>> um cliente comum acabou de virar ADMIN do sistema inteiro.');
    console.log('  >>> a partir daqui is_admin() devolve true para ele em TODA policy.');
    // Mostra o alcance, sem tocar em nada: ele agora enxerga o que e de admin.
    const { count } = await comoCliente.from('representative_clients').select('id', { count: 'exact', head: true });
    console.log(`  >>> ja consegue listar representative_clients: ${count ?? '?'} ficha(s).`);
    // Desfaz imediatamente.
    await admin.from('user_profiles').update({ is_admin: false }).eq('id', uid);
    console.log('  >>> desfeito na hora (is_admin volta a false).');
  }

  console.log('\n— o telefone do cadastro e mesmo perdido? —');
  const { data: criado2 } = await admin.auth.admin.createUser({
    email: `fone-${Date.now()}@teste.local`, password: crypto.randomBytes(18).toString('base64url'),
    email_confirm: true, user_metadata: { full_name: 'Teste Fone', phone: '11999990000' },
  });
  const uid2 = criado2.user.id;
  const { data: p2 } = await admin.from('user_profiles').select('full_name, phone').eq('id', uid2).maybeSingle();
  checa('o celular informado no cadastro chega ao perfil', !!p2?.phone,
    `gravado: ${JSON.stringify(p2)}`);
  await admin.auth.admin.deleteUser(uid2);
}

try { await rodar(); } finally {
  if (uid) { await admin.auth.admin.deleteUser(uid); console.log('\nlimpeza: usuarios temporarios apagados.'); }
}
console.log(`\n${ok} ok, ${falhas.length} falha(s).`);
if (falhas.length) { falhas.forEach(f => console.log('  · ' + f)); process.exitCode = 1; }
