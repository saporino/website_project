// O app do Instagram aceita conta de TERCEIRO, ou so as nossas?
//
//   node scripts/diagnostico-instagram-app.mjs
//
// Por que existe: um app da Meta em modo Desenvolvimento so autoriza contas que
// tenham funcao no proprio app. Descobrir isso com o cliente do outro lado da
// linha e a pior hora possivel. Isto responde antes.
//
// SO LE. Nao publica nada, nao conecta nada, nao toca em conta de ninguem.
// As chaves ficam neste processo e nunca sao impressas.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const env = {};
for (const l of readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const APP_ID = env.INSTAGRAM_APP_ID || env.VITE_INSTAGRAM_APP_ID || env.META_APP_ID;
const APP_SECRET = env.INSTAGRAM_APP_SECRET || env.META_APP_SECRET;

if (!APP_ID || !APP_SECRET) {
  console.log('\nAs chaves do app do Instagram nao estao no .env local.');
  console.log('Elas vivem nos secrets do Supabase (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET),');
  console.log('que e onde devem estar mesmo — a Edge Function le de la.');
  console.log('\nPara conferir o modo do app sem elas aqui, o caminho e o painel da Meta:');
  console.log('  developers.facebook.com → seu app → topo da pagina');
  console.log('  O seletor mostra "Em desenvolvimento" ou "Ativo" (Live).');
  process.exit(0);
}

const appToken = APP_ID + '|' + APP_SECRET;
const graph = async (caminho) => {
  const r = await fetch('https://graph.facebook.com/v21.0/' + caminho +
    (caminho.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(appToken));
  return r.json();
};

console.log('\n— o app —');
const app = await graph(APP_ID + '?fields=name,link,app_type');
if (app.error) { console.log('  erro: ' + app.error.message); process.exit(1); }
console.log('  nome: ' + app.name);

console.log('\n— quem tem funcao no app (administradores, testadores) —');
const roles = await graph(APP_ID + '/roles');
if (roles.error) console.log('  nao consegui ler: ' + roles.error.message);
else {
  const n = (roles.data ?? []).length;
  console.log('  ' + n + ' pessoa(s) com funcao.');
  console.log('  Em modo Desenvolvimento, SO estas contas conseguem autorizar.');
}

console.log('\n— o que isto significa para o cliente —');
console.log('  Se o app estiver em Desenvolvimento: o cliente clica em Autorizar e DA ERRO,');
console.log('  a menos que o Instagram dele esteja na lista acima como testador.');
console.log('  Se estiver Ativo (Live) com a permissao aprovada: qualquer conta comercial autoriza.');
console.log('\n  O modo em si aparece no topo do painel: developers.facebook.com → seu app.');
