// Coleta de preço de café no Mercado Livre, pela API oficial. SOMENTE LEITURA.
//
// POR QUE EXISTE. Ele precisa precificar o café dele contra o mercado, e a
// pergunta "por quanto os outros vendem?" não tinha onde ser respondida: o
// estudo de setembro virou dois HTML soltos no computador e os 200 registros
// de Mercado Livre no banco são de 15/06, de uma coleta única.
//
// COMO FUNCIONA. A busca por texto (`/sites/MLB/search?q=`) devolve 403 para a
// nossa aplicação — e isso NÃO é permissão faltando, foi restrição do próprio
// Mercado Livre (confirmado no painel: "Publicação e sincronização" já está em
// Leitura). O caminho que funciona é o do catálogo, o mesmo que a metodologia
// de setembro registrou:
//
//    /products/search?q=       -> fichas de catálogo
//    /products/{id}            -> atributos (peso, marca, tipo, unidades)
//    /products/{id}/items      -> as ofertas da ficha, com preço e vendedor
//
// O PESO É O QUE IMPORTA. Preço sozinho não compara: R$ 23,90 de 500 g e
// R$ 23,90 de 250 g são negócios opostos. Tudo vira R$/kg, e o que não tem
// peso confiável fica de fora em vez de entrar com chute.
//
// RITMO. Em setembro a coleta tomou 7 respostas 429 (excesso de chamadas).
// Aqui vai sequencial, com pausa entre chamadas e recuo progressivo no 429.
// Demora mais e chega inteiro.
//
//   node scripts/ml-coleta-cafe.mjs                 ensaio: coleta e mostra, NÃO grava
//   node scripts/ml-coleta-cafe.mjs --gravar        grava em ecommerce_price_snapshots
//   node scripts/ml-coleta-cafe.mjs --fichas 400    quantas fichas no máximo

import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------
// Credenciais do Mercado Livre — vivem fora do repositório, na máquina.
// Nenhum valor é impresso, nem gravado em lugar nenhum por este script.
// ---------------------------------------------------------------------
const ML_ENV = 'C:/Users/vlade/.mercadolivre/.env';
const lerEnv = (caminho) => {
  const o = {};
  for (const l of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m) o[m[1]] = m[2].trim();
  }
  return o;
};

const ml = lerEnv(ML_ENV);
const BASE = 'https://api.mercadolibre.com';

const GRAVAR = process.argv.includes('--gravar');
const MAX_FICHAS = Number(
  (process.argv.find(a => a.startsWith('--fichas')) || '').split(/[= ]/)[1]
  ?? process.argv[process.argv.indexOf('--fichas') + 1] ?? 300);

// O que buscar. Cobre as gramaturas que ele vende e as que concorrem:
// 250 g, 500 g, 1 kg, kits de 2/3/4 e fardos.
// Termos escolhidos para achar o que CONCORRE com o nosso: torrado e moido,
// tradicional e extraforte, nas gramaturas que vendemos. As marcas entram
// nominalmente porque buscar "cafe tradicional" devolve muita ficha morta,
// enquanto "cafe pilao" devolve a prateleira de verdade.
// VARRER TUDO. Ele foi explicito: "nao podemos tirar ninguem da pesquisa,
// temos que coletar tudo (...) nem uma marca pode passar despercebida, mesmo
// se tiver 1 pacote de cafe". Entao os termos existem para ENCONTRAR, nao
// para filtrar: marcas grandes, marcas pequenas, regionais, torrefacoes
// locais, generico. Quem some da busca some do relatorio, e isso e o que ele
// nao quer.
const TERMOS = [
  // genericos, que trazem o grosso da prateleira
  'cafe torrado e moido', 'cafe torrado e moido 500g', 'cafe em po 500g',
  'cafe tradicional 500g', 'cafe extra forte 500g', 'cafe pacote 500g',
  'cafe torrado e moido 250g', 'cafe torrado e moido 1kg', 'cafe 500g',
  'cafe moido', 'cafe em po', 'cafe torrado',
  // nacionais de massa
  'cafe pilao', 'cafe melitta', 'cafe uniao', 'cafe tres coracoes',
  'cafe caboclo', 'cafe mococa', 'cafe pele', 'cafe damasco', 'cafe bom jesus',
  'cafe santa clara', 'cafe iguacu', 'cafe do ponto', 'cafe brasileiro',
  // regionais e torrefacoes menores
  'cafe aviacao', 'cafe utam', 'cafe canecao', 'cafe carneiro', 'cafe cocari',
  'cafe zorzo', 'cafe farroupilha', 'cafe italle', 'cafe torino', 'cafe larre',
  'cafe sao braz', 'cafe fort', 'cafe seleto', 'cafe bahia', 'cafe maratá',
  'cafe gostoso', 'cafe barao', 'cafe odebrecht', 'cafe cajuba', 'cafe conilon',
  'torrefacao cafe 500g', 'cafe artesanal 500g', 'cafe da fazenda 500g',
  // kits e fardos
  'cafe kit 2 unidades 500g', 'cafe kit 3 unidades 500g', 'cafe kit 4 unidades 500g',
  'cafe fardo 10 unidades', 'cafe 10 pacotes 500g', 'cafe atacado 500g',
];


const dormir = (ms) => new Promise(r => setTimeout(r, ms));

let chamadas = 0, bloqueios = 0;

/** GET com recuo progressivo. Nunca outro verbo: esta coleta não escreve no ML. */
async function get(caminho, params) {
  const url = new URL(BASE + caminho);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, String(v));
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    chamadas++;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${ml.ML_ACCESS_TOKEN}` } });
    if (r.status === 429 || r.status >= 500) {
      bloqueios++;
      await dormir(1500 * (tentativa + 1));   // recuo: 1,5s, 3s, 4,5s
      continue;
    }
    await dormir(120);                        // ritmo base entre chamadas
    if (!r.ok) return { status: r.status, dados: null };
    return { status: r.status, dados: await r.json() };
  }
  return { status: 429, dados: null };
}

// ---------------------------------------------------------------------
// Peso: vem como TEXTO ("500 g", "1 kg"), não como número.
// ---------------------------------------------------------------------
const RE_PESO = /([0-9]+(?:[.,][0-9]+)?)\s*(kg|g)\b/i;
function pesoKg(texto) {
  const m = RE_PESO.exec(String(texto ?? ''));
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  const kg = m[2].toLowerCase() === 'g' ? n / 1000 : n;
  return kg >= 0.05 && kg <= 30 ? kg : null;
}

function daFicha(d) {
  const info = {};
  for (const a of d.attributes ?? []) {
    const vn = a.value_name;
    if (['UNIT_WEIGHT', 'NET_WEIGHT', 'WEIGHT'].includes(a.id)) {
      const k = pesoKg(vn); if (k) info.kg = k;
    } else if (a.id === 'UNITS_PER_PACK') {
      const n = parseFloat(String(vn).replace(',', '.'));
      if (n >= 1 && n <= 60) info.unidades = n;
    } else if (a.id === 'BRAND') info.marca = vn;
    else if (a.id === 'LINE') info.linha = vn;
    else if (a.id === 'INSTANT_COFFEE_TYPE') info.tipo = vn;
    else if (a.id === 'SALE_FORMAT') info.formato = vn;
    else if (a.id === 'FLAVOR') info.sabor = vn;
    else if (a.id === 'TOASTED_LEVEL') info.torra = vn;
  }
  // Rede de segurança: o título quase sempre traz o peso quando o atributo não vem.
  if (!info.kg) {
    const k = pesoKg(d.name);
    if (k) { info.kg = k; info.pesoDoTitulo = true; }
  }
  return info;
}

/** Como a embalagem se chama na prateleira — é assim que ele pensa o produto. */
function embalagem(kgUnidade, unidades) {
  const total = kgUnidade * unidades;
  if (total >= 4.5) return 'fardo 5kg+';
  if (unidades >= 2) return `kit ${unidades}x${Math.round(kgUnidade * 1000)}g`;
  if (kgUnidade >= 0.9) return '1kg';
  if (kgUnidade >= 0.45) return '500g';
  if (kgUnidade >= 0.2) return '250g';
  return `${Math.round(kgUnidade * 1000)}g`;
}

// ---------------------------------------------------------------------
async function main() {
  console.log(GRAVAR ? '== COLETA (vai gravar) ==' : '== ENSAIO (não grava) ==');
  console.log('termos:', TERMOS.length, '| teto de fichas:', MAX_FICHAS, '\n');

  // 1) fichas. DUAS FONTES, e a ordem importa.
  //
  // CAMPEOES primeiro: /highlights devolve o que o mercado REALMENTE compra.
  // O catalogo (/products/search) devolve o cadastro inteiro — milhares de
  // fichas, muitas de marca pequena e cara, muitas sem venda nenhuma. Medir
  // preco pelo catalogo deu mediana de R$ 87/kg no 500g; pelos campeoes, ~35.
  // O mesmo Pilao aparece a 57,98/kg no catalogo e a 27,80 entre os campeoes.
  // Para decidir PRECO, vale por quanto se vende, nao por quanto esta
  // cadastrado. O catalogo entra depois, para dar largura, e vai MARCADO.
  const fichas = new Map();   // id -> { termo, fonte }
  const CATEGORIA_CAFE = 'MLB247538';
  {
    const r = await get('/highlights/MLB/category/' + CATEGORIA_CAFE);
    for (const c of (r.dados?.content ?? [])) {
      if (c.id) fichas.set(c.id, { termo: 'mais vendidos', fonte: 'campeao' });
    }
    console.log('  mais vendidos da categoria café -> ' + fichas.size + ' fichas');
  }

  for (const termo of TERMOS) {
    const r = await get('/products/search', { site_id: 'MLB', q: termo, limit: 50 });
    const res = r.dados?.results ?? [];
    for (const p of res) if (p.id && !fichas.has(p.id)) fichas.set(p.id, { termo, fonte: 'catalogo' });
    console.log(`  "${termo}" -> ${res.length} fichas (acumulado: ${fichas.size})`);
    if (fichas.size >= MAX_FICHAS) break;
  }

  const lista = [...fichas.entries()].slice(0, MAX_FICHAS);
  console.log(`\nfichas a abrir: ${lista.length}\n`);

  // 2) atributos + ofertas de cada ficha
  const linhas = [];
  let semOferta = 0, semPeso = 0, n = 0;
  for (const [fid, origem] of lista) {
    const { termo, fonte } = origem;
    n++;
    if (n % 25 === 0) console.log(`  ... ${n}/${lista.length}  (ofertas: ${linhas.length})`);

    const prod = await get(`/products/${fid}`);
    if (prod.status !== 200) continue;
    const info = daFicha(prod.dados);

    const of = await get(`/products/${fid}/items`);
    if (of.status !== 200) { semOferta++; continue; }
    const ofertas = Array.isArray(of.dados) ? of.dados : (of.dados?.results ?? []);
    if (!ofertas.length) { semOferta++; continue; }

    if (!info.kg) { semPeso++; continue; }
    const unidades = info.unidades ?? 1;
    const kgTotal = info.kg * unidades;

    for (const o of ofertas) {
      if (!o.price) continue;
      linhas.push({
        ficha: fid, termo, fonte,
        titulo: prod.dados?.name ?? null,
        marca: info.marca ?? null,
        tipo: info.tipo ?? info.formato ?? null,
        torra: info.torra ?? null,
        kg_unidade: info.kg, unidades, kg_total: kgTotal,
        embalagem: embalagem(info.kg, unidades),
        preco: o.price,
        preco_antes: o.original_price ?? null,
        vendedor: o.seller_id ?? null,
        item: o.item_id ?? null,
        loja_oficial: o.official_store_id ?? null,
        rs_kg: o.price / kgTotal,
        peso_do_titulo: !!info.pesoDoTitulo,
      });
    }
  }

  console.log(`\nchamadas: ${chamadas} | bloqueios 429 tratados: ${bloqueios}`);
  console.log(`fichas sem oferta ativa: ${semOferta} | sem peso confiável: ${semPeso}`);
  console.log(`OFERTAS COM PREÇO E PESO: ${linhas.length}\n`);

  // 3) o quadro por embalagem — é assim que ele decide preço
  const porEmb = new Map();
  for (const l of linhas) {
    // A fonte entra na chave de propósito: juntar campeão com catálogo numa
    // mediana só foi o que produziu R$ 87/kg para um 500g que o mercado vende
    // a 35. Dado de origem diferente não vira média — vira linha separada.
    const chave = l.embalagem + ' [' + l.fonte + ']';
    if (!porEmb.has(chave)) porEmb.set(chave, []);
    porEmb.get(chave).push(l.rs_kg);
  }
  const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
  console.log('EMBALAGEM          n      R$/kg p25   mediana      p75');
  console.log('-'.repeat(58));
  for (const [emb, arr] of [...porEmb.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (arr.length < 5) continue;
    arr.sort((a, b) => a - b);
    console.log('%s %s %s %s %s',
      emb.padEnd(18), String(arr.length).padStart(4),
      pct(arr, 0.25).toFixed(2).padStart(12),
      pct(arr, 0.50).toFixed(2).padStart(9),
      pct(arr, 0.75).toFixed(2).padStart(8));
  }

  const arquivo = 'ml-coleta-cafe.json';
  writeFileSync(arquivo, JSON.stringify(linhas, null, 1));
  console.log(`\ndetalhe salvo em ${arquivo}`);

  if (!GRAVAR) {
    console.log('\nensaio: NADA foi gravado no banco. Rode com --gravar para guardar.');
    return;
  }

  // 4) gravar, na tabela que já existe e já tem 6.208 linhas de outras fontes
  const env = lerEnv('.env');
  const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } });
  const { data: emp } = await db.from('companies').select('id').limit(1).maybeSingle();

  const agora = new Date().toISOString();
  const registros = linhas.map(l => ({
    company_id: emp?.id ?? null,
    captured_at: agora,
    marketplace: 'mercadolivre',
    search_term: l.termo,
    listing_sku: l.item,
    title: l.titulo,
    price: l.preco,
    price_before: l.preco_antes,
    currency: 'BRL',
    weight_g: Math.round(l.kg_total * 1000),
    unit_type: l.embalagem,
    price_per_kg: l.rs_kg,
    // o peso tirado do título é menos confiável que o do atributo: fica marcado
    is_suspect: l.peso_do_titulo,
    raw: { ficha: l.ficha, fonte: l.fonte, vendedor: l.vendedor, marca: l.marca, tipo: l.tipo,
           torra: l.torra, loja_oficial: l.loja_oficial, via: 'api' },
  }));

  for (let i = 0; i < registros.length; i += 500) {
    const { error } = await db.from('ecommerce_price_snapshots').insert(registros.slice(i, i + 500));
    if (error) { console.error('FALHOU ao gravar:', error.message); process.exit(1); }
  }

  // o diário de bordo: é aqui que ele vê "o que puxei e quando"
  await db.from('marketplace_coletas').insert({
    company_id: emp?.id ?? null,
    via: 'api', marketplace: 'mercadolivre',
    rota: '/products/search + /products/{id}/items',
    termo: TERMOS.join(' | '),
    parametros: { termos: TERMOS.length, fichas: lista.length, chamadas },
    status: 200, resultado: registros.length ? 'ok' : 'vazio',
    itens: registros.length, custo_usd: null,
  });

  console.log(`\nGRAVADO: ${registros.length} ofertas em ecommerce_price_snapshots`);
  console.log('coleta registrada em marketplace_coletas');
}

main().catch(e => { console.error('FALHOU:', e.message ?? e); process.exit(1); });
