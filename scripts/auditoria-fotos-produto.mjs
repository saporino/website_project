// AUDITORIA DE FOTO DE PRODUTO — quais ainda estão com fundo?
//
// O padrão aprovado é foto sem fundo (ver a memória "Foto de produto sem fundo"). Mas isso
// só vale se for verificável: na vitrine, uma foto com fundo branco vira um retângulo sujo
// ao lado das outras, e só se descobre quando alguém repara.
//
// Esta bancada baixa cada imagem de produto e mede o canal alfa. Não opina: mede.
//
//   node scripts/auditoria-fotos-produto.mjs
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, anunciar } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: false });
anunciar(ambiente);
const admin = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

const { data: produtos, error } = await admin
  .from('products').select('name, image_url, is_active').order('name');
if (error) throw new Error(error.message);

const comFundo = [], semFoto = [], ok = [], naoAbriu = [];

for (const p of produtos ?? []) {
  if (!p.image_url) { semFoto.push(p.name); continue; }
  try {
    const r = await fetch(p.image_url);
    if (!r.ok) { naoAbriu.push(`${p.name} (HTTP ${r.status})`); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    // Conta transparência só nos CANTOS: é ali que o fundo aparece, e isso evita acusar
    // uma foto de ambiente (mesa, cozinha) que legitimamente não tem recorte.
    const canto = (x, y) => data[(y * info.width + x) * info.channels + 3];
    const cantos = [canto(2, 2), canto(info.width - 3, 2), canto(2, info.height - 3), canto(info.width - 3, info.height - 3)];
    const recortada = cantos.every(a => a < 10);
    let transp = 0;
    for (let i = 3; i < data.length; i += info.channels) if (data[i] < 10) transp++;
    const pct = (transp / (info.width * info.height) * 100).toFixed(1);

    (recortada ? ok : comFundo).push(`${p.name} — ${pct}% transparente${p.is_active ? '' : ' (inativo)'}`);
  } catch (e) {
    naoAbriu.push(`${p.name} (${e instanceof Error ? e.message : e})`);
  }
}

console.log(`\n— com fundo (aparecem como retângulo na vitrine) —`);
comFundo.length ? comFundo.forEach(x => console.log('  !!  ' + x)) : console.log('  ok  nenhuma');
console.log(`\n— sem fundo, no padrão —`);
ok.forEach(x => console.log('  ok  ' + x));
if (semFoto.length) { console.log(`\n— sem foto nenhuma —`); semFoto.forEach(x => console.log('  ·   ' + x)); }
if (naoAbriu.length) { console.log(`\n— não deu para abrir —`); naoAbriu.forEach(x => console.log('  ??  ' + x)); }

console.log(`\n${ok.length} no padrão · ${comFundo.length} com fundo · ${semFoto.length} sem foto`);
process.exitCode = comFundo.length ? 1 : 0;
