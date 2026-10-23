// A MINIATURA DO STUDIO CARREGA — E SÓ PARA QUEM PODE VER A PEÇA.
//
// As artes não apareciam na lista: a TABELA `studio_videos` libera por
// organização, o STORAGE exigia `is_admin()`. Quem tinha a organização e não
// era admin via 45 cards e nenhuma arte — e `createSignedUrls` não levanta erro,
// só devolve entradas sem URL, então a tela ficava muda.
//
// Afrouxar leitura de storage é mudança de segurança, e por isso esta bancada
// testa os TRÊS lados. Não basta provar que voltou a carregar; é preciso provar
// que não carrega para quem não devia.
//
//   node scripts/auditoria-miniatura-studio.mjs

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, confirmarNoBanco, anunciar } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: true });
const env = ambiente.env;
anunciar(ambiente);
const ns = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, ns);
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

const MARCA = 'teste-thumb-studio';
let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };

async function limpar() {
  const { data: vs } = await admin.from('studio_videos').select('id,storage_path').like('filename', `${MARCA}%`);
  for (const v of vs ?? []) if (v.storage_path) await admin.storage.from('studio-videos').remove([v.storage_path]);
  await admin.from('studio_videos').delete().like('filename', `${MARCA}%`);
  for (let p = 1; p <= 20; p++) {
    const { data: u } = await admin.auth.admin.listUsers({ page: p, perPage: 200 });
    for (const x of (u?.users ?? []).filter(x => x.email?.startsWith(MARCA))) {
      await admin.from('user_roles').delete().eq('user_id', x.id);
      await admin.auth.admin.deleteUser(x.id);
    }
    if (!u?.users || u.users.length < 200) break;
  }
  await admin.from('companies').delete().like('name', `${MARCA}%`);
}
await limpar();

const criarPessoa = async (sufixo, { ehAdmin = false } = {}) => {
  const email = `${MARCA}-${sufixo}@coffeelivre.test`;
  const senha = crypto.randomBytes(20).toString('base64url') + 'Aa1!';
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(error.message);
  await admin.from('user_profiles').upsert({ id: u.user.id, full_name: `${sufixo} ${MARCA}` });
  // O papel vive em `user_roles` — `user_profiles.is_admin` NÃO é o que
  // `is_admin()` consulta.
  if (ehAdmin) await admin.from('user_roles').insert({ user_id: u.user.id, role_code: 'admin', is_active: true });
  const cli = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, ns);
  const { error: el } = await cli.auth.signInWithPassword({ email, password: senha });
  if (el) throw new Error(el.message);
  return { id: u.user.id, cli };
};

try {
  const { data: empresa } = await admin.from('companies')
    .insert({ name: `${MARCA} Empresa`, fantasia: MARCA, is_active: true, sort_order: 9 }).select('id').single();

  // Uma arte de verdade no bucket (PNG 1×1), como o Studio grava.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  const caminho = `${empresa.id}/${Date.now()}_${MARCA}.png`;
  const { error: eUp } = await admin.storage.from('studio-videos').upload(caminho, png, { contentType: 'image/png' });
  if (eUp) throw new Error('upload: ' + eUp.message);

  const { data: org } = await admin.from('studio_organizations')
    .insert({ name: `${MARCA} Org`, company_id: empresa.id }).select('id').single()
    .then(r => r, () => ({ data: null }));

  const { data: video, error: eV } = await admin.from('studio_videos').insert({
    filename: `${MARCA} arte.png`, storage_path: caminho, status: 'done',
    media_type: 'image', company_id: empresa.id,
    ...(org?.id ? { organization_id: org.id } : {}),
  }).select('id, organization_id').single();
  if (eV) throw new Error('studio_videos: ' + eV.message);

  const assina = async (cli) => {
    const { data, error } = await cli.storage.from('studio-videos').createSignedUrl(caminho, 600);
    return { url: data?.signedUrl ?? null, erro: error?.message ?? null };
  };

  // ── 1. admin ──────────────────────────────────────────────────────────────
  console.log('\n1. Quem é admin vê a arte');
  const adm = await criarPessoa('admin', { ehAdmin: true });
  const rAdm = await assina(adm.cli);
  checar('admin consegue assinar a URL da arte', !!rAdm.url, rAdm.erro ?? '');
  if (rAdm.url) {
    const resp = await fetch(rAdm.url);
    checar('e a URL entrega a imagem de verdade', resp.ok && (resp.headers.get('content-type') ?? '').startsWith('image/'),
      `HTTP ${resp.status}`);
  }

  // ── 2. estranho ───────────────────────────────────────────────────────────
  console.log('\n2. Quem não tem nada a ver com a peça NÃO vê');
  const estranho = await criarPessoa('estranho');
  const rEst = await assina(estranho.cli);
  checar('usuário sem papel e sem organização NÃO assina a URL', !rEst.url,
    rEst.url ? 'ASSINOU — isto é um furo de isolamento' : '');

  const { data: vistos } = await estranho.cli.from('studio_videos').select('id').eq('id', video.id);
  checar('e também não enxerga o registro na tabela', (vistos ?? []).length === 0,
    `viu ${(vistos ?? []).length}`);

  // ── 3. a regra é a mesma dos dois lados ───────────────────────────────────
  console.log('\n3. Tabela e storage concordam');
  const mesmaResposta = async (cli, quem) => {
    const { data: linhas } = await cli.from('studio_videos').select('id').eq('id', video.id);
    const veLinha = (linhas ?? []).length > 0;
    const veArquivo = !!(await assina(cli)).url;
    checar(`${quem}: vê a linha (${veLinha}) e vê o arquivo (${veArquivo}) — iguais`, veLinha === veArquivo,
      'a tabela e o storage discordam, que é exatamente o defeito original');
  };
  await mesmaResposta(adm.cli, 'admin');
  await mesmaResposta(estranho.cli, 'estranho');

  // ── 4. escrever continua sendo só de admin ────────────────────────────────
  console.log('\n4. Ler não virou escrever');
  const { error: eEscrita } = await estranho.cli.storage.from('studio-videos')
    .upload(`${empresa.id}/${MARCA}-invasor.png`, png, { contentType: 'image/png' });
  checar('estranho NÃO consegue subir arquivo no bucket do Studio', !!eEscrita,
    eEscrita ? '' : 'SUBIU — furo de escrita');
  const { error: eDel } = await estranho.cli.storage.from('studio-videos').remove([caminho]);
  const { data: aindaLa } = await admin.storage.from('studio-videos').createSignedUrl(caminho, 60);
  checar('e não consegue apagar a arte de ninguém', !!aindaLa?.signedUrl,
    eDel ? '' : 'o arquivo sumiu');
} catch (e) {
  falhas++;
  console.log('\n  !!  erro inesperado: ' + e.message);
} finally {
  await limpar();
}

console.log(`\n${criterios - falhas}/${criterios} critérios${falhas ? ` — ${falhas} FALHA(S)` : ' — tudo certo'}`);
process.exit(falhas ? 1 : 0);
