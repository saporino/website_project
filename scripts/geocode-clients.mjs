// Backfill de geocodificação dos clientes do RepCo (Camada 1 — mapa de vendas por região).
// Preenche representative_clients.lat/lng usando uma cascata GRATUITA:
//   1) CEP        -> BrasilAPI CEP v2 (coordenadas oficiais quando disponíveis)
//   2) Endereço   -> Nominatim/OSM (endereco_completo)
//   3) Município  -> Nominatim/OSM (centroide "municipio, UF, Brasil")
// Idempotente: só processa quem está sem coordenada (lat IS NULL). Re-rodar só re-tenta falhas.
// NÃO altera a tela /repco/inteligencia nem as views vw_repco_*; só preenche colunas do cliente.
//
// Uso:  node scripts/geocode-clients.mjs
// Requer no .env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- carrega .env (parse simples) ---
const env = {};
for (const line of readFileSync(join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPA_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SERVICE_KEY) { console.error('Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env'); process.exit(1); }

const UA = 'cafesaporino-geocoder/1.0 (sac@cafesaporino.com.br)'; // atribuição/User-Agent p/ Nominatim
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sqlStr = (v) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

// Nominatim devolve o estado por extenso ("São Paulo"); normalizamos para a sigla (UF).
const STATE_UF = {
  'acre':'AC','alagoas':'AL','amapa':'AP','amazonas':'AM','bahia':'BA','ceara':'CE',
  'distrito federal':'DF','espirito santo':'ES','goias':'GO','maranhao':'MA','mato grosso':'MT',
  'mato grosso do sul':'MS','minas gerais':'MG','para':'PA','paraiba':'PB','parana':'PR',
  'pernambuco':'PE','piaui':'PI','rio de janeiro':'RJ','rio grande do norte':'RN',
  'rio grande do sul':'RS','rondonia':'RO','roraima':'RR','santa catarina':'SC',
  'sao paulo':'SP','sergipe':'SE','tocantins':'TO',
};
function toUf(state) {
  if (!state) return null;
  const s = String(state).trim();
  if (s.length === 2) return s.toUpperCase();
  const norm = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return STATE_UF[norm] || null;
}

// --- RPCs do Supabase ---
async function rpc(fn, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}
const execSelect = (q) => rpc('exec_select', { q }).then(res => res?.value ?? res ?? []);
const execMigration = (q) => rpc('exec_migration', { q });

// --- geocoders ---
async function geocodeCep(cep) {
  const clean = String(cep).replace(/\D/g, '');
  if (clean.length !== 8) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${clean}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const d = await r.json();
    const c = d?.location?.coordinates;
    if (c?.latitude && c?.longitude) {
      return { lat: Number(c.latitude), lng: Number(c.longitude), municipio: d.city || null, uf: toUf(d.state) };
    }
  } catch { /* ignora */ }
  return null;
}

async function nominatim(query) {
  await sleep(1100); // limite Nominatim: ~1 req/seg
  try {
    const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=1&q=${encodeURIComponent(query)}`;
    const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } });
    if (!r.ok) return null;
    const arr = await r.json();
    if (!arr?.length) return null;
    const hit = arr[0];
    const a = hit.address || {};
    return {
      lat: Number(hit.lat), lng: Number(hit.lon),
      municipio: a.city || a.town || a.village || a.municipality || null,
      uf: toUf(a.state),
    };
  } catch { return null; }
}

// --- cascata por cliente ---
async function geocodeClient(c) {
  if (c.cep && String(c.cep).replace(/\D/g, '').length === 8) {
    const r = await geocodeCep(c.cep);
    if (r) return { ...r, level: 'cep' };
  }
  if (c.endereco_completo && c.endereco_completo.trim().length > 5) {
    const r = await nominatim(`${c.endereco_completo}, Brasil`);
    if (r) return { ...r, level: 'endereco' };
  }
  if (c.municipio && c.uf) {
    const r = await nominatim(`${c.municipio}, ${c.uf}, Brasil`);
    if (r) return { ...r, level: 'municipio' };
  }
  return null;
}

// --- main ---
const rows = await execSelect(
  `select id, razao_social, cep, municipio, uf, endereco_completo from public.representative_clients where lat is null order by created_at`
);
console.log(`Clientes sem coordenada: ${rows.length}`);

const tally = { cep: 0, endereco: 0, municipio: 0, failed: 0 };
for (const c of rows) {
  const res = await geocodeClient(c);
  if (res) {
    const muni = (c.municipio == null || c.municipio === '') ? sqlStr(res.municipio) : 'municipio';
    const uf = (c.uf == null || c.uf === '') ? sqlStr(res.uf) : 'uf';
    await execMigration(
      `update public.representative_clients
         set lat = ${res.lat}, lng = ${res.lng},
             municipio = coalesce(${muni}, municipio),
             uf = coalesce(${uf}, uf),
             geocode_status = 'success', geocoded_at = now()
       where id = ${sqlStr(c.id)}`
    );
    tally[res.level]++;
    console.log(`  OK [${res.level}] ${c.razao_social} -> ${res.lat.toFixed(5)}, ${res.lng.toFixed(5)}`);
  } else {
    await execMigration(
      `update public.representative_clients set geocode_status = 'failed' where id = ${sqlStr(c.id)}`
    );
    tally.failed++;
    console.log(`  FALHOU ${c.razao_social} (sem CEP/endereço/município geocodificável)`);
  }
}

console.log('\nResumo:');
console.log(`  por CEP:        ${tally.cep}`);
console.log(`  por endereço:   ${tally.endereco}`);
console.log(`  por município:  ${tally.municipio}`);
console.log(`  falhas:         ${tally.failed}`);
console.log(`  total tratado:  ${rows.length}`);
