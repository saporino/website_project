// Sobe os documentos que a COFICO entrega ao cliente PJ.
//
//   node scripts/publicar-documentos-fornecedor.mjs              (staging)
//   node scripts/publicar-documentos-fornecedor.mjs --producao   (produção)
//
// O bucket e PRIVADO. Quem baixa e decidido por policy no storage, nao por
// botao escondido na tela -- arquivo tem URL, e esconder botao nao protege URL.
//
// Os arquivos sao os PDFs que o Vlademir ja usa no dia a dia: a ficha de dados
// cadastrais COMERCIAL (sem CPF de socio nem dados bancarios) e a ficha tecnica
// do Tropeiro Paulista Tradicional.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const PRODUCAO = process.argv.includes('--producao');
const arquivo = PRODUCAO ? '.env' : '.env.staging';

const env = {};
for (const l of readFileSync(path.join(RAIZ, arquivo), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const ref = (env.VITE_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)?.[1];
console.log(`\nbanco: ${ref} (${PRODUCAO ? 'PRODUCAO' : 'staging'})\n`);

const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = 'documentos-fornecedor';
const ORIGEM = 'C:/Users/vlade/OneDrive/Documents/.SAPORINO/.RepCo Vendedores';

// CNPJ da Cafe Saporino Ltda — a empresa que fatura a marca.
const CNPJ_SAPORINO = '61109694000194';

const DOCS = [
  {
    arquivo: 'Ficha_Dados_Cadastrais_Cafe_Saporino-COMERCIAL.pdf',
    destino: 'saporino/ficha-dados-cadastrais-comercial.pdf',
    titulo: 'Ficha de dados cadastrais — Café Saporino Ltda.',
    descricao: 'Dados da empresa para abrir o cadastro de fornecedor no seu sistema. Versão comercial: sem CPF de sócios nem dados bancários detalhados.',
    tipo: 'cadastral',
    marca: null,
    ordem: 1,
  },
  {
    arquivo: 'Ficha_Tecnica_Tropeiro_Paulista_Tradicional.pdf',
    pasta: 'C:/Users/vlade/OneDrive/Documents/.CAFE TROPEIRO PAULISTA/TP-TR-500G/PROJETO_Bruno_TP_TR500g',
    destino: 'tropeiro-paulista/ficha-tecnica-tradicional.pdf',
    titulo: 'Ficha técnica — Tropeiro Paulista Tradicional 500g',
    descricao: 'Composição, modo de preparo, conservação e dados do produto.',
    tipo: 'ficha_tecnica',
    marca: 'Tropeiro Paulista',
    ordem: 2,
  },
];

async function garantirBucket() {
  const r = await fetch(`${env.VITE_SUPABASE_URL}/storage/v1/bucket`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  const existentes = await r.json();
  if (Array.isArray(existentes) && existentes.some(b => b.name === BUCKET)) {
    const b = existentes.find(x => x.name === BUCKET);
    if (b.public) throw new Error(`O bucket ${BUCKET} esta PUBLICO. Abortado: documento de fornecedor nao fica aberto.`);
    console.log(`  bucket ${BUCKET} ja existe (privado)`);
    return;
  }
  const c = await fetch(`${env.VITE_SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: BUCKET, public: false, file_size_limit: 20971520, allowed_mime_types: ['application/pdf'] }),
  });
  if (!c.ok) throw new Error('nao criou o bucket: ' + (await c.text()).slice(0, 200));
  console.log(`  bucket ${BUCKET} criado (privado, so PDF, ate 20 MB)`);
}

async function empresaSaporino() {
  const { data } = await db.from('companies').select('id, name').eq('cnpj', CNPJ_SAPORINO).maybeSingle();
  if (!data) console.log('  aviso: Cafe Saporino Ltda nao esta em `companies` neste banco; documento fica sem company_id.');
  return data?.id ?? null;
}

async function rodar() {
  await garantirBucket();
  const companyId = await empresaSaporino();

  for (const d of DOCS) {
    const origem = path.join(d.pasta ?? ORIGEM, d.arquivo);
    if (!existsSync(origem)) {
      console.log(`  PULADO  ${d.arquivo} — nao achei em ${d.pasta ?? ORIGEM}`);
      continue;
    }
    const bytes = readFileSync(origem);
    const kb = (statSync(origem).size / 1024).toFixed(0);

    const { error: eUp } = await db.storage.from(BUCKET)
      .upload(d.destino, bytes, { contentType: 'application/pdf', upsert: true });
    if (eUp) { console.log(`  FALHOU  ${d.arquivo}: ${eUp.message}`); continue; }

    // Sempre 'comercial': sao os dois que o Vlademir mandou justamente para o
    // cliente baixar. Documento restrito entra por outro caminho, com liberacao.
    const { error: eDb } = await db.from('documentos_fornecedor').upsert({
      company_id: companyId,
      marca: d.marca,
      titulo: d.titulo,
      descricao: d.descricao,
      tipo: d.tipo,
      visibilidade: 'comercial',
      arquivo_path: d.destino,
      arquivo_nome: d.arquivo,
      tamanho_bytes: statSync(origem).size,
      ordem: d.ordem,
      ativo: true,
    }, { onConflict: 'arquivo_path' });
    if (eDb) { console.log(`  FALHOU no banco ${d.arquivo}: ${eDb.message}`); continue; }

    console.log(`  ok      ${d.titulo} (${kb} KB)`);
  }

  const { data: lista } = await db.from('documentos_fornecedor').select('titulo, visibilidade, ativo');
  console.log(`\n${(lista ?? []).length} documento(s) cadastrado(s):`);
  for (const l of lista ?? []) console.log(`  · ${l.titulo} — ${l.visibilidade}${l.ativo ? '' : ' (inativo)'}`);
}

await rodar();
