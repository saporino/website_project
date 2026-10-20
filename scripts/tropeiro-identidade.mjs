// Grava a identidade oficial do Café Tropeiro Paulista no Studio.
//
// POR QUE ESTE SCRIPT EXISTE. Ele pediu três peças de "bom dia" do Tropeiro e
// recebeu foto genérica de café com uma tarja de legenda. No banco, a marca
// tinha três adjetivos no lugar das cores — 'preto', 'dourado', 'creme' — e
// nenhum ativo oficial. "Dourado" o modelo lê como marrom de fazenda, e foi
// exatamente o que saiu. A embalagem real é amarelo #FDD112.
//
// O que entra aqui veio do briefing que ele escreveu como diretor de arte, e
// dos arquivos oficiais da marca que estão no OneDrive do projeto. Nada é
// inventado: cor que ele não deu, não existe neste arquivo.
//
//   node scripts/tropeiro-identidade.mjs           (confere e mostra o que fará)
//   node scripts/tropeiro-identidade.mjs --gravar  (grava)

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const env = {};
for (const l of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const GRAVAR = process.argv.includes('--gravar');
const RAIZ = 'C:/Users/vlade/OneDrive/Documents/.CAFE TROPEIRO PAULISTA/TP-TR-500G';

// A FRENTE é o ativo oficial da geração: é ela que entra na cena, e ela já
// carrega o logotipo. O logo solto entra como segundo ativo, para quando a peça
// pedir a marca aplicada em xícara, avental ou vitrine.
const ARQUIVOS = [
  { papel: 'oficial', arquivo: `${RAIZ}/FRENTE-TROPEIRO PAULISTA-TR-500G-MOCKUP ORIGINAL.png` },
  { papel: 'oficial', arquivo: `${RAIZ}/TROPEIRO PAULISTA-LOGO-TR-ORIGINAL.png` },
];

// ---------------------------------------------------------------------
// A identidade, como ele a escreveu
// ---------------------------------------------------------------------
const VISUAL = {
  // As cores que ele deu, em hex. Era isto que faltava: adjetivo não é cor.
  palette: {
    principal: '#FDD112',
    apoio: '#F5C61F',
    luz: '#FDDC42',
    sombra: '#E5A708',
    marrom: '#57250C',
  },
  brand_colors: ['#FDD112', '#57250C'],
  color_rules: [
    'O amarelo #FDD112 é a base visual da peça, não um detalhe.',
    'Evitar amarelo alaranjado fora do padrão.',
    'O marrom #57250C serve de contraste, tipografia, detalhe e apoio.',
    'A arte transmite calor, acolhimento e presença de marca.',
  ],
  themes: ['tradição', 'café de verdade', 'brasilidade', 'proximidade', 'orgulho regional'],
  scenarios: [
    'cozinha de casa', 'mesa de café da manhã', 'balcão de padaria',
    'cafeteria', 'mercearia', 'fazenda ou campo com bom gosto',
    'cena acolhedora do dia a dia brasileiro',
  ],
  // Ele escreveu isto depois de ver a peça que saiu — que era exatamente um
  // saco de estopa com grãos espalhados.
  avoid: [
    'repetir saco de estopa e grãos espalhados sem necessidade',
    'poluição visual e excesso de elementos aleatórios',
    'cenário artificial',
    'composição exagerada sem propósito',
    'visual genérico de banco de imagens',
  ],
  people: {
    use: [
      'brasileiros de aparência real', 'homens e mulheres com cara de povo',
      'classe trabalhadora', 'pessoas simpáticas, calorosas e críveis',
    ],
    avoid: ['aparência de modelo de banco de imagem artificial'],
    nota: 'Personagem que represente a marca conversa com o universo tropeiro: rústico elegante, brasileiro, acolhedor.',
  },
  style: ['forte', 'limpo', 'bem resolvido', 'moderno sem perder tradição', 'caloroso', 'realista'],
  persona_tropeiro:
    'O personagem da marca é o tropeiro do logotipo oficial: brasileiro, realista, trabalhador. ' +
    'Quando aparecer, deve ser coerente com esse personagem de referência — não um gaúcho, não um cowboy, não um figurante genérico.',
  coffee_must_look_real: true,
};

const COMPOSICAO = {
  prioridades: ['marca legível', 'mensagem clara', 'visual forte', 'ativo oficial preservado', 'estética coerente'],
  // Formato: o Studio gera 4:5, que é o retrato máximo que o Instagram aceita
  // SEM cortar. O briefing pedia 2:3, que o Instagram corta — a área segura
  // abaixo é dele, e vale igual.
  area_segura: 'Conteúdo importante dentro dos 80% centrais da altura; 10% de cima e 10% de baixo só fundo; elementos a pelo menos 8% das bordas laterais.',
  legibilidade: 'Texto grande e legível no celular. Manchete em no máximo duas linhas quando possível.',
  logo: 'Não repetir o logotipo sem necessidade. Embalagem com presença clara e valorizada, sem deformação.',
};

const COPY = {
  tom: ['forte', 'simples', 'caloroso', 'popular com elegância', 'marcante'],
  frases_possiveis: [
    'bom dia', 'café de verdade', 'tradição em cada xícara', 'força para o dia',
    'café que aproxima', 'café que acolhe', 'café do povo', 'sabor brasileiro',
  ],
  // Regra explícita dele: "Tradicional" é o nome da linha na embalagem, não um
  // slogan para repetir em toda peça.
  nunca: [
    'Usar a palavra "Tradicional" automaticamente em toda peça; só quando fizer sentido com a embalagem oficial.',
    'Transformar "Tradicional" em slogan recorrente da marca.',
  ],
};

// A REGRA ACIMA DAS REGRAS, que ele confirmou por último.
//
// Sem ela, o modelo resolve conflito improvisando — e improviso em cima de
// ativo oficial é exatamente como embalagem inventada nasce. Preservar a marca
// vence entregar a peça.
const REGRA_MAXIMA =
  'Se uma criação exigir violar qualquer um destes guardrails para ser produzida, PRESERVE A MARCA em vez de improvisar. ' +
  'É preferível entregar uma composição mais simples, ou sem o elemento problemático, a entregar uma peça que descaracterize a marca. ' +
  'Nenhum ativo oficial pode ser "melhorado", reinterpretado ou recriado por IA.';

const PROIBICOES = [
  'Criar outro logotipo Tropeiro Paulista.',
  'Alterar, recriar, simplificar, modernizar ou redesenhar o logotipo oficial.',
  'Trocar a tipografia, o símbolo, as proporções ou as cores do logotipo.',
  'Alterar, reinterpretar ou redesenhar a arte da embalagem oficial.',
  'Trocar textos da embalagem ou inventar novo layout de pacote.',
  'Distorcer a embalagem.',
  'Trocar o amarelo principal por tom inadequado.',
  'Descaracterizar a marca.',
];

async function main() {
  const { data: marca, error: eM } = await db.from('studio_brand_profiles')
    .select('id, name, company_id, organization_id, guardrails, ativo_oficial_path')
    .eq('name', 'Café Tropeiro Paulista').single();
  if (eM) throw eM;
  console.log('marca:', marca.name, marca.id);

  for (const a of ARQUIVOS) {
    if (!existsSync(a.arquivo)) throw new Error(`arquivo nao encontrado: ${a.arquivo}`);
  }

  if (!GRAVAR) {
    console.log('\n[ensaio] seria gravado:');
    console.log('  ativos:', ARQUIVOS.map(a => basename(a.arquivo)).join(' | '));
    console.log('  paleta:', JSON.stringify(VISUAL.palette));
    console.log('  guardrails: visual_rules, composition_rules, copy_rules.frases, prohibitions');
    console.log('\nrode com --gravar para aplicar.');
    return;
  }

  // ---- os ativos oficiais ----
  const caminhos = [];
  for (const a of ARQUIVOS) {
    const nome = basename(a.arquivo).replace(/[^\w.-]/g, '_');
    const caminho = `${marca.company_id}/ref-oficial-${nome}`;
    const bytes = readFileSync(a.arquivo);
    const { error: eUp } = await db.storage.from('studio-videos')
      .upload(caminho, bytes, { contentType: 'image/png', upsert: true });
    if (eUp) throw eUp;

    // O ativo precisa ter dono: é essa linha que impede a embalagem de uma
    // marca entrar na peça de outra.
    const { error: eReg } = await db.from('studio_reference_assets').upsert({
      path: caminho, company_id: marca.company_id,
      organization_id: marca.organization_id,
      brand_id: marca.id, brand_mode: 'perfil', brand_name: marca.name,
      filename: basename(a.arquivo), mime: 'image/png', size_bytes: bytes.length,
    }, { onConflict: 'path' });
    if (eReg) throw eReg;

    caminhos.push(caminho);
    console.log('ativo registrado:', caminho);
  }

  // ---- a identidade ----
  const g = marca.guardrails ?? {};
  const novas = {
    ...g,
    version: 2,
    visual_rules: { ...(g.visual_rules ?? {}), ...VISUAL },
    composition_rules: COMPOSICAO,
    copy_rules: {
      ...(g.copy_rules ?? {}),
      tom_de_voz: COPY.tom,
      frases_possiveis: COPY.frases_possiveis,
      nunca: COPY.nunca,
    },
    regra_maxima: REGRA_MAXIMA,
    prohibitions: PROIBICOES,
    asset_rules: {
      ...(g.asset_rules ?? {}),
      logo: { official_only: true, never_recreate: true, fonte: 'ativo oficial anexado' },
      package: {
        official_only: true, never_recreate: true,
        if_official_asset_unavailable: 'do_not_use_package',
        fonte: 'ativo oficial anexado',
      },
    },
  };

  const { error: eU } = await db.from('studio_brand_profiles').update({
    guardrails: novas,
    ativo_oficial_path: caminhos[0],   // a FRENTE da embalagem
    colors: VISUAL.palette,
  }).eq('id', marca.id);
  if (eU) throw eU;

  const { data: conf } = await db.from('studio_brand_profiles')
    .select('ativo_oficial_path, colors').eq('id', marca.id).single();
  console.log('\nGRAVADO.');
  console.log('  embalagem oficial:', conf.ativo_oficial_path);
  console.log('  cores:', JSON.stringify(conf.colors));
}

main().catch(e => { console.error('FALHOU:', e.message ?? e); process.exit(1); });
