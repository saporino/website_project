// Gera os SEEDS do Coffee LiVRE a partir de produção, em dois arquivos:
//
//   supabase/seeds/coffeelivre_referencia.sql  catálogo e parâmetros: categorias,
//       atributos, planos, tarifas da calculadora, premissas. Sem isto o site não funciona.
//   supabase/seeds/coffeelivre_demo.sql        a demonstração ESTÁVEL: vendedores, lojas,
//       produtos, variantes, lotes, QR, escadas e empresas B2B marcados `is_demo`.
//
// Dado de teste (marca `teste-`, criado e apagado pelas bancadas) não é seed e fica
// fora. Também ficam fora: códigos de acesso, candidaturas de vendedor, vínculos de
// usuário e histórico de preço.
//
// NENHUM DADO PESSOAL: antes de gravar, toda linha de vendedor, loja e empresa
// passa por uma checagem (e-mail só de domínio de teste, sem CNPJ, sem telefone,
// is_demo verdadeiro). Qualquer coisa fora disso aborta a geração.
//
// Só lê produção. Uso: node scripts/staging/gerar-seeds.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { REF_PRODUCAO } from '../_ambiente.mjs';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const PASTA = path.join(RAIZ, 'supabase', 'seeds');
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
if (!env.VITE_SUPABASE_URL?.includes(REF_PRODUCAO)) throw new Error('.env não aponta para produção.');
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function linhas(sql) {
  const { data, error } = await db.rpc('exec_select', { q: sql });
  if (error) throw new Error(`${error.message}\n${sql}`);
  return data ?? [];
}

const LOJAS_DEMO = `select s.id from lv_stores s where s.is_demo and s.slug not like 'teste-%'`;
const PRODUTOS_DEMO = `select p.id from lv_products p where p.store_id in (${LOJAS_DEMO})`;

const REFERENCIA = [
  ['lv_attributes', 'select * from lv_attributes order by ordem, chave'],
  ['lv_categories', 'select * from lv_categories order by parent_id nulls first, ordem, slug'],
  ['lv_category_attributes', 'select * from lv_category_attributes order by category_id, ordem'],
  ['lv_plans', 'select * from lv_plans order by ordem'],
  ['lv_settings', 'select key, value, updated_at, null::uuid as updated_by from lv_settings order by key'],
  ['lv_simulacao_premissas', 'select * from lv_simulacao_premissas order by chave'],
  ['lv_tarifas_simulacao', 'select id, plataforma, modalidade, componente, cenario, percentual_bps, valor_cents, valor_micros, minimo_cents, preco_min_cents, preco_max_cents, peso_sobre, peso_min_g, peso_max_g, confiabilidade, natureza, rotulo, fonte, fonte_url, verificado_em, vigencia_inicio, vigencia_fim, observacao, ordem, ativo, created_at, updated_at, null::uuid as updated_by, modelo from lv_tarifas_simulacao order by plataforma, ordem, id'],
];

const DEMO = [
  ['lv_sellers', `select * from lv_sellers where id in (select seller_id from lv_stores where id in (${LOJAS_DEMO})) order by nome_fantasia`],
  ['lv_stores', `select * from lv_stores where id in (${LOJAS_DEMO}) order by ordem, slug`],
  ['lv_products', `select * from lv_products where id in (${PRODUTOS_DEMO}) order by slug`],
  ['lv_product_variants', `select * from lv_product_variants where product_id in (${PRODUTOS_DEMO}) order by product_id, ordem`],
  ['lv_product_attributes', `select * from lv_product_attributes where product_id in (${PRODUTOS_DEMO}) order by product_id, attribute_id`],
  ['lv_price_tiers', `select * from lv_price_tiers where product_id in (${PRODUTOS_DEMO}) order by product_id, min_qty`],
  ['lv_product_images', `select * from lv_product_images where product_id in (${PRODUTOS_DEMO}) order by product_id, ordem`],
  ['lv_inventory_lots', `select * from lv_inventory_lots where product_id in (${PRODUTOS_DEMO}) order by product_id, lote`],
  ['lv_qr_codes', `select * from lv_qr_codes where product_id in (${PRODUTOS_DEMO}) order by codigo`],
  ['lv_b2b_empresas', `select * from lv_b2b_empresas where is_demo and nome not like 'teste-%' order by nome`],
  ['lv_b2b_solicitacoes', `select * from lv_b2b_solicitacoes where is_demo and empresa_id in
     (select id from lv_b2b_empresas where is_demo and nome not like 'teste-%') order by created_at, id`],
];

// Só domínios que não entregam e-mail: TLD reservado .test/.teste ou example.*.
const EMAIL_DE_TESTE = /@([a-z0-9-]+\.)*([a-z0-9-]+\.(test|teste)|example\.(com|org|net))$/i;
function conferirSemDadoPessoal(tabela, linha) {
  const problemas = [];
  if (linha.email && !EMAIL_DE_TESTE.test(linha.email)) problemas.push(`e-mail ${linha.email}`);
  if (linha.cnpj) problemas.push('CNPJ preenchido');
  if (linha.telefone) problemas.push('telefone preenchido');
  if (linha.is_demo !== true) problemas.push('linha sem is_demo');
  if (problemas.length) {
    throw new Error(`ABORTADO: ${tabela} ${linha.id ?? ''} parece ter dado real (${problemas.join(', ')}). Nada foi gravado.`);
  }
}

async function montar(titulo, tabelas, conferir) {
  const blocos = [];
  const contagem = {};
  for (const [tabela, sql] of tabelas) {
    const dados = await linhas(sql);
    contagem[tabela] = dados.length;
    if (conferir) for (const l of dados) conferir(tabela, l);
    if (!dados.length) continue;
    const json = JSON.stringify(dados);
    if (json.includes('$seed$')) throw new Error(`delimitador dentro dos dados de ${tabela}`);
    blocos.push(`-- ${tabela}: ${dados.length}
insert into public.${tabela}
  select * from jsonb_populate_recordset(null::public.${tabela}, $seed$${json}$seed$::jsonb)
  on conflict do nothing;`);
  }
  // Triggers de usuário desligados só durante a carga: os ids vêm prontos e o
  // trigger que cria variante padrão + QR geraria duplicatas. FKs continuam valendo.
  const nomes = tabelas.filter(([t]) => contagem[t]).map(([t]) => t);
  return { contagem, sql: `-- ${titulo}
-- Gerado por scripts/staging/gerar-seeds.mjs a partir de produção. Não editar à mão.
-- Idempotente: pode rodar de novo sem duplicar (on conflict do nothing).
-- Contagem: ${JSON.stringify(contagem)}

${nomes.map(t => `alter table public.${t} disable trigger user;`).join('\n')}

${blocos.join('\n\n')}

${nomes.map(t => `alter table public.${t} enable trigger user;`).join('\n')}
` };
}

// Tudo é montado e conferido antes de gravar qualquer arquivo.
const referencia = await montar('SEED DE REFERÊNCIA do Coffee LiVRE (catálogo e parâmetros)', REFERENCIA, null);
const demo = await montar('SEED DE DEMONSTRAÇÃO do Coffee LiVRE (dados fictícios, is_demo)', DEMO, (tabela, linha) => {
  if (['lv_sellers', 'lv_stores', 'lv_b2b_empresas'].includes(tabela)) conferirSemDadoPessoal(tabela, linha);
});
fs.mkdirSync(PASTA, { recursive: true });
fs.writeFileSync(path.join(PASTA, 'coffeelivre_referencia.sql'), referencia.sql);
fs.writeFileSync(path.join(PASTA, 'coffeelivre_demo.sql'), demo.sql);
console.log('referência', referencia.contagem);
console.log('demonstração', demo.contagem);
