// AUDITORIA DE ESCRITA — quem, que não é admin, consegue mudar o quê?
//
// Por que existe (09/10/2026): a auditoria anterior testou só LEITURA e deu tudo verde. Aí
// a varredura de políticas de escrita mostrou que o representante podia atualizar a própria
// linha inteira — e a bancada provou: ele se deu commission_rate 8 e ligou o bônus de
// entrega pessoal. Leitura fechada não significa escrita fechada.
//
// O que esta bancada faz:
//   1. lista toda política de INSERT/UPDATE/DELETE/ALL aberta a anon ou authenticated,
//      separando as que exigem admin/papel das que não exigem nada;
//   2. prova na prática, com usuários temporários, que um visitante, um cliente da loja e
//      um representante não mudam o que é do admin.
//
//   node scripts/auditoria-escrita.mjs
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, confirmarNoBanco, anunciar } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: true });
const env = ambiente.env;
anunciar(ambiente);
const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, semSessao);
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

let falhas = 0, criterios = 0;
const checar = (t, ok, d = '') => { criterios++; if (ok) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };

// ---------------------------------------------------------------- 1. mapa das políticas
// Uma política de escrita é "guardada" quando a condição cita admin, papel, dono da linha
// ou um estado controlado. Guarda nenhuma (`true`) em tabela de operação é o perigo.
const { data: politicas } = await admin.rpc('exec_select', {
  q: `select tablename, policyname, cmd, roles::text as roles,
             coalesce(with_check, qual, 'true') as regra
        from pg_policies
       where schemaname='public' and cmd in ('INSERT','UPDATE','DELETE','ALL')
         and (roles::text like '%anon%' or roles::text like '%authenticated%' or roles::text='{public}')
       order by tablename, cmd`,
});
// Guarda é qualquer condição: função de papel, dono da linha, subconsulta, estado. O que
// não guarda nada é a regra literal `true` — essa deixa qualquer um escrever.
const livre = r => String(r).trim().toLowerCase() === 'true';
const semGuarda = (politicas ?? []).filter(p => livre(p.regra));

// Escrita pública de propósito: formulário que o site precisa aceitar de quem não tem conta.
const ESPERADAS = new Set(['b2b_leads', 'candidaturas_representante', 'site_visits', 'network_audit_log']);
console.log('\n— escrita liberada sem condição nenhuma —');
for (const p of semGuarda) {
  const ok = ESPERADAS.has(p.tablename);
  checar(`${p.tablename} · ${p.cmd} · ${p.policyname}${ok ? ' (formulário público, esperado)' : ''}`, ok,
    ok ? '' : `regra "true" — qualquer visitante escreve`);
}
if (!semGuarda.length) console.log('  ok  nenhuma');
console.log(`  ·   ${(politicas ?? []).length - semGuarda.length} políticas de escrita com condição (papel, dono ou estado)`);

// ------------------------------------------------------------------ 2. prova na prática
const criados = [];
const semear = [];   // [tabela, id] criados por esta bancada, apagados no fim
async function usuario(rotulo) {
  const email = `aud-escrita-${crypto.randomBytes(4).toString('hex')}@coffeelivre.test`;
  const senha = crypto.randomBytes(20).toString('base64url') + 'Aa1!';
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(`${rotulo}: ${error.message}`);
  criados.push(data.user.id);
  const cli = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
  const { error: el } = await cli.auth.signInWithPassword({ email, password: senha });
  if (el) throw new Error(`${rotulo} login: ${el.message}`);
  return { cli, id: data.user.id, email };
}

let repId;
try {
  const visitante = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
  const cliente = await usuario('cliente');
  const rep = await usuario('rep');

  const { data: linhaRep, error: er } = await admin.from('representatives').insert({
    user_id: rep.id, full_name: 'Rep auditoria', email: rep.email, cpf: '00000000191',
    commission_rate: 5, has_personal_delivery: false, status: 'active',
  }).select('id').single();
  if (er) throw new Error('criar rep: ' + er.message);
  repId = linhaRep.id;

  console.log('\n— o que cada um consegue mudar —');

  // o rep não mexe no próprio dinheiro
  await rep.cli.from('representatives')
    .update({ commission_rate: 8, has_personal_delivery: true, status: 'active' }).eq('id', repId);
  const { data: dep } = await admin.from('representatives')
    .select('commission_rate, has_personal_delivery').eq('id', repId).single();
  checar('representante não muda a própria comissão nem o bônus',
    Number(dep.commission_rate) === 5 && dep.has_personal_delivery === false,
    `ficou ${dep.commission_rate}% / bônus ${dep.has_personal_delivery}`);

  // ninguém de fora mexe em preço, produto e configuração da loja.
  // Semeia o que faltar: o staging pode estar vazio, e teste que não roda engana.
  const { data: empresa } = await admin.from('companies')
    .insert({ name: 'AUDITORIA ESCRITA', fantasia: 'AUD', is_active: false }).select('id').single();
  semear.push(['companies', empresa.id]);
  const { data: produto } = await admin.from('products')
    .insert({ name: 'Produto auditoria', price: 10, company_id: empresa.id, is_active: false }).select('id').single();
  semear.push(['products', produto.id]);

  const alvos = [
    ['products', produto.id, 'price', 999],
    ['companies', empresa.id, 'name', 'HACKEADO'],
  ];
  for (const [rotulo, cli] of [['visitante', visitante], ['cliente', cliente.cli], ['representante', rep.cli]]) {
    for (const [tabela, id, campo, valor] of alvos) {
      const { data: antes } = await admin.from(tabela).select(campo).eq('id', id).single();
      await cli.from(tabela).update({ [campo]: valor }).eq('id', id);
      const { data: depois } = await admin.from(tabela).select(campo).eq('id', id).single();
      checar(`${rotulo} não altera ${tabela}.${campo}`,
        String(depois?.[campo]) === String(antes[campo]),
        `mudou de "${antes[campo]}" para "${depois?.[campo]}"`);
    }
    // e não apaga
    await cli.from('products').delete().eq('id', produto.id);
    const { data: vivo } = await admin.from('products').select('id').eq('id', produto.id).maybeSingle();
    checar(`${rotulo} não apaga produto`, !!vivo);
  }

  // ninguém apaga pedido
  const { data: ped } = await admin.from('representative_orders').select('id').limit(1).maybeSingle();
  if (ped) {
    await rep.cli.from('representative_orders').delete().eq('id', ped.id);
    const { data: aindaLa } = await admin.from('representative_orders').select('id').eq('id', ped.id).maybeSingle();
    checar('representante não apaga pedido pelo banco', !!aindaLa);
  }
} finally {
  if (repId) await admin.from('representatives').delete().eq('id', repId);
  for (const [tabela, id] of semear.reverse()) await admin.from(tabela).delete().eq('id', id);
  for (const id of criados) await admin.auth.admin.deleteUser(id);
}

console.log(`\n${criterios - falhas}/${criterios} critérios`);
process.exitCode = falhas ? 1 : 0;
