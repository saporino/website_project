// Deixa qualquer arte no formato do Instagram, sem depender do gerador acertar.
//
// Por que existe: o modelo de imagem do ChatGPT (gpt-image) só gera 1:1, 2:3 e 3:2 — 4:5,
// que é o formato do feed, não está na lista dele. Por isso a arte volta sempre torta, por
// mais detalhado que seja o pedido. Em vez de brigar com o gerador, a gente corta aqui.
//
// Receita que funciona: peça a arte em RETRATO (2:3) e deixe respiro em cima e embaixo.
// Este script tira o excesso de cima/baixo e devolve 1080 × 1350 — sem encostar nas
// laterais, que é onde o texto costuma ir.
//
//   node scripts/arte-instagram.mjs arte.png                 → feed 4:5 (1080 × 1350)
//   node scripts/arte-instagram.mjs arte.png --formato 1x1   → feed quadrado (1080 × 1080)
//   node scripts/arte-instagram.mjs arte.png --formato 9x16  → stories/reels (1080 × 1920)
//   node scripts/arte-instagram.mjs arte.png --saida pronta.jpg

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const FORMATOS = {
  '4x5':  { w: 1080, h: 1350, nome: 'feed retrato (4:5)' },
  '1x1':  { w: 1080, h: 1080, nome: 'feed quadrado (1:1)' },
  '9x16': { w: 1080, h: 1920, nome: 'stories / reels (9:16)' },
  '191x1':{ w: 1080, h:  566, nome: 'feed paisagem (1,91:1)' },
};

const args = process.argv.slice(2);
const pegar = (nome, padrao) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : padrao; };
const entrada = args.find(a => !a.startsWith('--') && !Object.values(FORMATOS).includes(a) && fs.existsSync(a));
const chave = pegar('--formato', '4x5');
const alvo = FORMATOS[chave];

if (!entrada || !alvo) {
  console.log('Uso: node scripts/arte-instagram.mjs <arquivo> [--formato 4x5|1x1|9x16|191x1] [--saida nome.jpg]');
  console.log('Formatos:', Object.entries(FORMATOS).map(([k, v]) => `${k} = ${v.w}×${v.h} (${v.nome})`).join(' · '));
  process.exit(1);
}

const img = sharp(fs.readFileSync(entrada));
const meta = await img.metadata();
const propOrigem = meta.width / meta.height;
const propAlvo = alvo.w / alvo.h;

// Quanto da arte se perde no corte — é o número que decide se dá para aproveitar ou se é
// melhor gerar de novo.
let corte;
if (Math.abs(propOrigem - propAlvo) < 0.005) {
  corte = { lado: 'nada', pct: 0 };
} else if (propOrigem > propAlvo) {
  corte = { lado: 'das laterais', pct: (1 - propAlvo / propOrigem) * 100 };
} else {
  corte = { lado: 'de cima e de baixo', pct: (1 - propOrigem / propAlvo) * 100 };
}

const semCorte = args.includes('--sem-corte');
const saida = pegar('--saida', entrada.replace(/\.(\w+)$/, `-instagram-${chave}.jpg`));
const bruto = fs.readFileSync(entrada);

if (semCorte) {
  // Nada da arte se perde: ela entra inteira e o que falta para fechar o formato é
  // preenchido com a própria imagem borrada e esticada. Em arte fotográfica (fogão a
  // lenha, mesa de madeira) a emenda some; em fundo chapado, prefira o corte.
  const fundo = await sharp(bruto)
    .resize({ width: alvo.w, height: alvo.h, fit: 'cover', position: 'centre' })
    .blur(40).modulate({ brightness: 0.92 }).toBuffer();
  const frente = await sharp(bruto)
    .resize({ width: alvo.w, height: alvo.h, fit: 'inside', withoutEnlargement: false }).toBuffer();
  await sharp(fundo).composite([{ input: frente, gravity: 'center' }])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toFile(saida);
} else {
  await sharp(bruto)
    .resize({ width: alvo.w, height: alvo.h, fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })   // 4:4:4 preserva texto fino na arte
    .toFile(saida);
}

console.log(`  origem   ${meta.width} × ${meta.height} px (proporção ${propOrigem.toFixed(3)})`);
console.log(`  destino  ${alvo.w} × ${alvo.h} px — ${alvo.nome}`);
console.log(semCorte
  ? '  corte    nenhum: a arte entrou inteira, com o fundo estendido'
  : corte.pct === 0 ? '  corte    nenhum: a proporção já batia'
  : `  corte    ${corte.pct.toFixed(1)}% ${corte.lado}`);
if (!semCorte && corte.pct > 8) {
  console.log(`  ATENÇÃO  o corte é grande. Confira em ${path.basename(saida)} se o texto e o logo`);
  console.log('           continuam inteiros. Para não perder nada, rode de novo com --sem-corte.');
}
// Na GRADE do perfil o Instagram mostra só o quadrado central da arte 4:5. É por isso que
// o conteúdo tem de caber no centro — senão a peça fica certa no feed e cortada no perfil.
if (chave === '4x5') {
  console.log(`  grade    no perfil aparece só o centro 1080 × 1080 (corta 135 px em cima e 135 embaixo):`);
  console.log('           logo, manchete e produto precisam estar dentro dessa faixa.');
}
console.log(`  pronto   ${saida}`);
