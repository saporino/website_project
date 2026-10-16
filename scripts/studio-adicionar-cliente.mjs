// Cria a aba de um CLIENTE no Studio e devolve o link de autorizacao.
//
//   node scripts/studio-adicionar-cliente.mjs --nome "Fino Paladar" --instagram fino.paladar.representa --producao
//   node scripts/studio-adicionar-cliente.mjs --listar --producao
//
// O link e o unico jeito legitimo de ligar a conta: o DONO dela clica em
// autorizar na tela do Instagram. Nao existe comando que pule isso, e e bom
// que nao exista -- e o que impede qualquer um de postar no perfil dos outros.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const arg = (n, d = null) => {
  const i = process.argv.indexOf('--' + n);
  return i >= 0 ? (process.argv[i + 1] ?? true) : d;
};
const PRODUCAO = process.argv.includes('--producao');

const env = {};
for (const l of readFileSync(path.join(RAIZ, PRODUCAO ? '.env' : '.env.staging'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const ref = (env.VITE_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)?.[1];
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
console.log(`\nbanco: ${ref} (${PRODUCAO ? 'PRODUCAO' : 'staging'})`);

const CNPJ_COFICO = '66006929000136';

function linkDe(brandId) {
  return `${env.VITE_SUPABASE_URL}/functions/v1/instagram-oauth?start=1&brand=${brandId}`;
}

if (process.argv.includes('--listar')) {
  const { data } = await db.from('studio_brand_profiles')
    .select('id, name, tipo, cliente_nome, ativa_no_studio').order('tipo').order('ordem');
  console.log('\nNOSSAS MARCAS:');
  for (const b of (data ?? []).filter(x => x.tipo === 'propria')) console.log('  · ' + b.name);
  const cli = (data ?? []).filter(x => x.tipo === 'cliente');
  console.log(`\nCLIENTES (${cli.length}):`);
  for (const b of cli) console.log(`  · ${b.name}${b.cliente_nome ? ' — ' + b.cliente_nome : ''}\n    link: ${linkDe(b.id)}`);
  process.exit(0);
}

const nome = arg('nome');
const instagram = String(arg('instagram', '')).replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
if (!nome) { console.log('\nFalta --nome "Nome do cliente".'); process.exit(1); }

// A marca do cliente nasce sob a COFICO: e ela que presta o servico.
const { data: cofico } = await db.from('companies').select('id, name').eq('cnpj', CNPJ_COFICO).maybeSingle();
if (!cofico) { console.log('\nNao achei a COFICO em `companies`.'); process.exit(1); }

const { data: existente } = await db.from('studio_brand_profiles')
  .select('id, tipo').eq('name', nome).maybeSingle();

let brandId;
if (existente) {
  brandId = existente.id;
  await db.from('studio_brand_profiles').update({
    tipo: 'cliente', cliente_nome: nome,
    cliente_contato: instagram ? '@' + instagram : null,
  }).eq('id', brandId);
  console.log(`\n  marca "${nome}" ja existia — marcada como CLIENTE.`);
} else {
  const { data: ultima } = await db.from('studio_brand_profiles')
    .select('ordem').order('ordem', { ascending: false }).limit(1).maybeSingle();
  const { data: nova, error } = await db.from('studio_brand_profiles').insert({
    company_id: cofico.id,
    name: nome,
    tipo: 'cliente',
    cliente_nome: nome,
    cliente_contato: instagram ? '@' + instagram : null,
    cliente_desde: new Date().toISOString().slice(0, 10),
    is_primary: false,
    ativa_no_studio: true,
    ordem: (ultima?.ordem ?? 0) + 1,
    notes: `Conta gerenciada pela COFICO como serviço. Instagram: @${instagram || '—'}`,
  }).select('id').single();
  if (error) { console.log('\nnao criou: ' + error.message); process.exit(1); }
  brandId = nova.id;
  console.log(`\n  marca "${nome}" criada como CLIENTE, sob ${cofico.name}.`);
}

console.log('\n' + '='.repeat(64));
console.log('LINK PARA MANDAR AO CLIENTE:\n');
console.log(linkDe(brandId));
console.log('\n' + '='.repeat(64));
console.log(`
Ele abre esse link, entra com a conta ${instagram ? '@' + instagram : 'dele'} e clica em
Autorizar. A conta cai na aba "${nome}" do Studio. Voce nunca ve a senha dele.

ANTES DE MANDAR, confira o modo do app:
  developers.facebook.com -> seu app -> seletor no topo
  "Em desenvolvimento" = so contas com funcao no app conseguem autorizar;
  "Ativo" (Live)       = qualquer conta comercial autoriza.

Se estiver em desenvolvimento, adicione o Instagram dele como TESTADOR antes
(Funcoes -> Testadores), senao ele clica, da erro, e voce fica na posicao ruim.
`);
