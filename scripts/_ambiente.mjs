// Coffee LiVRE — de que banco estamos falando?
//
// Toda bancada que escreve no banco passa por aqui ANTES de criar o
// primeiro cliente do Supabase. As regras:
//
//   1. O padrão é STAGING (`.env.staging`). Produção (`.env`) só com a flag
//      `--producao` E a variável `COFFEELIVRE_CONFIRMO_PRODUCAO=<ref de produção>`
//      — duas coisas digitadas de propósito, nunca um padrão.
//   2. O ref do projeto é conferido em três lugares que precisam concordar:
//      a URL, o ref declarado no arquivo e o ref gravado DENTRO das chaves
//      (JWT). Uma chave de outro projeto colada no arquivo errado aborta.
//   3. Comando destrutivo nunca roda no ref de produção, com ou sem flag.
//   4. E não basta o arquivo dizer "staging": o próprio banco precisa dizer.
//      A tabela `ambiente_do_banco` (migration 20260913160000) guarda nome e
//      ref; ela é marcada pelo script de reconstrução do staging. Banco sem
//      marca, marcado como produção ou com o ref de outro projeto → aborta.
//
// O nome do projeto no painel do Supabase não entra em nenhuma decisão.

import fs from 'node:fs';
import path from 'node:path';

export const REF_PRODUCAO = 'rsvoazrkxtdrcjnatzcm';
const RAIZ = path.resolve(import.meta.dirname, '..');

function lerArquivo(nome) {
  const arquivo = path.join(RAIZ, nome);
  if (!fs.existsSync(arquivo)) {
    throw new Error(`${nome} não existe. Veja docs/marketplace/RAIO_X_OPERACIONAL_COFFEE_LIVRE.md §17.1.11 (ambientes).`);
  }
  return Object.fromEntries(
    fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)
      .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
}

function refDaChave(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')).ref ?? null;
  } catch {
    return null;
  }
}

function abortar(motivo) {
  console.error(`\nABORTADO — trava de ambiente: ${motivo}\n`);
  process.exit(2);
}

/**
 * Escolhe e confere o ambiente pelo arquivo. Síncrono: roda antes de qualquer conexão.
 * @param {{ destrutivo: boolean, argv?: string[] }} opcoes
 */
export function escolherAmbiente({ destrutivo, argv = process.argv }) {
  const pediuProducao = argv.includes('--producao');
  const nomeDoArquivo = pediuProducao ? '.env' : '.env.staging';
  let env;
  try { env = lerArquivo(nomeDoArquivo); } catch (e) { abortar(e.message); }

  const url = env.VITE_SUPABASE_URL ?? '';
  const refUrl = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url)?.[1];
  if (!refUrl) abortar(`URL do Supabase inválida em ${nomeDoArquivo}.`);

  const producao = refUrl === REF_PRODUCAO;
  if (pediuProducao !== producao) {
    abortar(pediuProducao
      ? `--producao foi pedido, mas ${nomeDoArquivo} aponta para ${refUrl}.`
      : `${nomeDoArquivo} aponta para PRODUÇÃO (${refUrl}). O staging precisa ser outro projeto.`);
  }
  if (!producao && env.SUPABASE_PROJECT_REF !== refUrl) {
    abortar(`SUPABASE_PROJECT_REF (${env.SUPABASE_PROJECT_REF}) não bate com a URL (${refUrl}).`);
  }
  for (const chave of ['VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const ref = refDaChave(env[chave] ?? '');
    if (ref !== refUrl) abortar(`${chave} pertence a outro projeto (${ref ?? 'ilegível'}), não a ${refUrl}.`);
  }

  if (producao) {
    if (destrutivo) abortar('este comando apaga ou cria dados de teste e NUNCA roda em produção.');
    if (process.env.COFFEELIVRE_CONFIRMO_PRODUCAO !== REF_PRODUCAO) {
      abortar(`para produção, defina COFFEELIVRE_CONFIRMO_PRODUCAO=${REF_PRODUCAO} além de --producao.`);
    }
  }

  return { env, ref: refUrl, nome: producao ? 'producao' : 'staging', arquivo: nomeDoArquivo };
}

/**
 * Segunda metade da trava: pergunta ao próprio banco quem ele é.
 * @param {import('@supabase/supabase-js').SupabaseClient} admin cliente com service role
 */
export async function confirmarNoBanco(admin, ambiente, { destrutivo }) {
  const { data, error } = await admin.from('ambiente_do_banco').select('nome, project_ref').eq('id', 1).maybeSingle();
  if (error) abortar(`não foi possível ler a marca do banco (${error.message}).`);
  if (!destrutivo) {
    if (data && data.project_ref !== ambiente.ref) abortar(`o banco diz ser ${data.project_ref}, a URL diz ${ambiente.ref}.`);
    return;
  }
  if (!data) abortar('o banco não tem marca de ambiente. Só um banco marcado como staging aceita a bancada destrutiva.');
  if (data.nome !== 'staging') abortar(`o banco se declara "${data.nome}".`);
  if (data.project_ref !== ambiente.ref || data.project_ref === REF_PRODUCAO) {
    abortar(`a marca do banco (${data.project_ref}) não é deste projeto (${ambiente.ref}).`);
  }
}

export function anunciar(ambiente) {
  const faixa = ambiente.nome === 'producao' ? '█ PRODUÇÃO █' : 'staging';
  console.log(`ambiente: ${faixa} · projeto ${ambiente.ref} · ${ambiente.arquivo}`);
}
