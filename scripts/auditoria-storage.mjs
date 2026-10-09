// AUDITORIA DE STORAGE — quem alcança documento de cliente?
//
// Por que existe (09/10/2026): as auditorias de tabela davam verde, mas arquivo não passa
// por política de tabela — passa pela política do storage. E lá a regra de três buckets era
// só "está logado": um cliente da loja recém-cadastrado LISTAVA, BAIXAVA e SUBIA canhoto de
// entrega assinado por cliente B2B e foto de dentro da loja do cliente.
//
// A bancada prova os dois lados, que é o que importa numa trava:
//   • quem NÃO é do campo não alcança nada;
//   • quem É do campo (representante, promotor) continua trabalhando.
//
//   node scripts/auditoria-storage.mjs
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

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const usuarios = [], limpar = [], arquivos = [];

async function entrar(rotulo) {
  const email = `aud-storage-${rotulo}-${crypto.randomBytes(4).toString('hex')}@coffeelivre.test`;
  const senha = crypto.randomBytes(20).toString('base64url') + 'Aa1!';
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(`${rotulo}: ${error.message}`);
  usuarios.push(data.user.id);
  const cli = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
  const { error: el } = await cli.auth.signInWithPassword({ email, password: senha });
  if (el) throw new Error(`${rotulo} login: ${el.message}`);
  return { cli, id: data.user.id, email };
}

/** Sobe um arquivo pelo admin, para existir algo que os outros tentem alcançar. */
async function plantar(bucket, caminho) {
  const { error } = await admin.storage.from(bucket).upload(caminho, PNG, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`plantar ${bucket}/${caminho}: ${error.message}`);
  arquivos.push([bucket, caminho]);
}

try {
  const loja = await entrar('loja');
  const rep = await entrar('rep');
  const promo = await entrar('promotor');

  const { data: linhaRep, error: er } = await admin.from('representatives').insert({
    user_id: rep.id, full_name: 'Rep storage', email: rep.email,
    cpf: String(Math.floor(Math.random() * 1e11)).padStart(11, '0'), commission_rate: 5, status: 'active',
  }).select('id').single();
  if (er) throw new Error('rep: ' + er.message);
  limpar.push(['representatives', linhaRep.id]);

  const { data: linhaPromo, error: ep } = await admin.from('promoters')
    .insert({ user_id: promo.id, full_name: 'Promotor storage' }).select('id').single();
  if (ep) throw new Error('promotor: ' + ep.message);
  limpar.push(['promoters', linhaPromo.id]);

  // Arquivos nas pastas que o próprio código usa.
  await plantar('delivery-pods', `auditoria/${Date.now()}-canhoto.png`);
  await plantar('visit-photos', `promoter/${linhaPromo.id}/aud/foto.png`);
  await plantar('visit-photos', `visits/${linhaRep.id}/aud/foto.png`);
  await plantar('invoices', `auditoria/${Date.now()}-nota.png`);

  const alcanca = async (cli, bucket, caminho) => {
    const { data } = await cli.storage.from(bucket).download(caminho);
    return !!data;
  };
  const consegueSubir = async (cli, bucket, pasta) => {
    const nome = `${pasta}/intruso-${crypto.randomBytes(3).toString('hex')}.png`;
    const { error } = await cli.storage.from(bucket).upload(nome, PNG, { contentType: 'image/png' });
    if (!error) arquivos.push([bucket, nome]);
    return !error;
  };

  console.log('\n— cliente da loja não alcança documento de campo —');
  for (const [bucket, caminho] of arquivos.slice()) {
    checar(`não baixa de ${bucket}`, !(await alcanca(loja.cli, bucket, caminho)));
  }
  for (const bucket of ['delivery-pods', 'visit-photos', 'invoices']) {
    checar(`não sobe em ${bucket}`, !(await consegueSubir(loja.cli, bucket, 'auditoria')));
  }

  console.log('\n— mas quem é do campo continua trabalhando —');
  checar('promotor baixa a foto da própria visita',
    await alcanca(promo.cli, 'visit-photos', `promoter/${linhaPromo.id}/aud/foto.png`));
  checar('promotor sobe foto na própria pasta',
    await consegueSubir(promo.cli, 'visit-photos', `promoter/${linhaPromo.id}/aud`));
  checar('promotor NÃO alcança a pasta do representante',
    !(await alcanca(promo.cli, 'visit-photos', `visits/${linhaRep.id}/aud/foto.png`)));

  checar('representante baixa a foto da própria visita',
    await alcanca(rep.cli, 'visit-photos', `visits/${linhaRep.id}/aud/foto.png`));
  checar('representante sobe prova de entrega',
    await consegueSubir(rep.cli, 'delivery-pods', 'auditoria'));
  checar('representante sobe comprovante em invoices',
    await consegueSubir(rep.cli, 'invoices', 'auditoria'));
} finally {
  for (const [bucket, caminho] of arquivos) await admin.storage.from(bucket).remove([caminho]);
  for (const [tabela, id] of limpar.reverse()) await admin.from(tabela).delete().eq('id', id);
  for (const id of usuarios) await admin.auth.admin.deleteUser(id);
}

console.log(`\n${criterios - falhas}/${criterios} critérios`);
process.exitCode = falhas ? 1 : 0;
