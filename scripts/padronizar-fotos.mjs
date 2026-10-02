// Padroniza foto de produto para a vitrine: todas do mesmo tamanho e com a mesma margem.
//
// Por que existe: as embalagens chegam com sobra de fundo diferente em cada arquivo. Na
// mesma fileira de cards, uma aparece maior que a outra mesmo com o quadro igual — foi o
// que aconteceu com o coador M.
//
// O que faz, em cada arquivo:
//   1. recorta a sobra (fundo branco OU transparente);
//   2. coloca num quadrado, com a MESMA margem para todas;
//   3. grava em WebP, fundo transparente.
//
//   node scripts/padronizar-fotos.mjs public/cofico/coador-cabo-plastico-*.webp
//   node scripts/padronizar-fotos.mjs --lado 1000 --ocupa 0.86 arquivo1.webp arquivo2.png

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const valor = (nome, padrao) => {
  const i = args.indexOf(nome);
  return i >= 0 ? Number(args[i + 1]) : padrao;
};
const LADO = valor('--lado', 1000);          // largura final
const ALTURA = valor('--altura', LADO);      // altura final (padrão: quadrado; retrato p/ pacote alto)
const OCUPA = valor('--ocupa', 0.86);        // quanto do quadro o produto ocupa (margem igual para todos)
const arquivos = args.filter(a => !a.startsWith('--') && !/^\d+(\.\d+)?$/.test(a));

if (!arquivos.length) {
  console.log('Diga quais arquivos padronizar. Ex.: node scripts/padronizar-fotos.mjs public/cofico/coador-*.webp');
  process.exit(1);
}

for (const arquivo of arquivos) {
  if (!fs.existsSync(arquivo)) { console.log(`  !!  ${arquivo}: não encontrei`); continue; }
  // Lê para a memória antes de mexer: no OneDrive, o arquivo aberto trava a gravação.
  const original = fs.readFileSync(arquivo);
  const meta = await sharp(original).metadata();

  // 1. recorta a sobra. `trim` usa o canto superior esquerdo como referência: serve tanto
  //    para fundo branco quanto para transparente.
  const recortada = await sharp(original).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = recortada.info;

  // 2. redimensiona para ocupar sempre a mesma fração do quadro e centraliza
  const redimensionada = await sharp(recortada.data)
    .resize({ width: Math.round(LADO * OCUPA), height: Math.round(ALTURA * OCUPA), fit: 'inside', withoutEnlargement: false })
    .toBuffer();

  const saida = arquivo.replace(/\.(webp|png|jpe?g)$/i, '.webp');
  const final = await sharp({
    create: { width: LADO, height: ALTURA, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: redimensionada, gravity: 'center' }])
    .webp({ quality: 88 })
    .toBuffer();

  fs.writeFileSync(saida, final);
  const depois = await sharp(final).metadata();
  console.log(`  ok  ${path.basename(saida)}: ${meta.width}×${meta.height} → recorte ${w}×${h} → ${depois.width}×${depois.height}`);
}
