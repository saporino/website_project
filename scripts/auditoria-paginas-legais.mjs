// Bancada das páginas legais da COFICO — o que a Meta e o crawler realmente recebem.
//
// Roda sobre o `dist/` depois do build (`npm run build`), SEM navegador e SEM JavaScript:
// lê o HTML cru, igual ao crawler da Meta/WhatsApp/Facebook, que não executa script.
//
//   npm run build && node scripts/auditoria-paginas-legais.mjs
//
// Também confere o roteamento do vercel.json (as três URLs chegam ao arquivo certo, e
// só no domínio da COFICO) e o sitemap.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve('dist');
const legal = JSON.parse(readFileSync(resolve('src/pages/coficobrasil/legal.json'), 'utf8'));
const vercel = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
const sitemap = readFileSync(resolve('public/sitemap-cofico.xml'), 'utf8');
const robots = readFileSync(resolve('public/robots-cofico.txt'), 'utf8');

let ok = 0, falhas = [];
const checa = (nome, condicao, detalhe = '') => {
  if (condicao) { ok++; console.log(`  ok   ${nome}`); }
  else { falhas.push(nome + (detalhe ? ` — ${detalhe}` : '')); console.log(`  FALHA ${nome}${detalhe ? ' — ' + detalhe : ''}`); }
};

if (!existsSync(DIST)) {
  console.error('dist/ não existe. Rode `npm run build` primeiro.');
  process.exitCode = 1;
} else {
  /** Tira todas as tags: sobra o texto que um leitor sem JavaScript vê. */
  const soTexto = (html) => html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&larr;/g, '<-')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();

  for (const doc of legal.documentos) {
    console.log(`\n— /${doc.slug}`);
    const arquivo = resolve(DIST, `cofico-${doc.slug}.html`);
    if (!existsSync(arquivo)) { checa(`arquivo cofico-${doc.slug}.html existe`, false); continue; }
    const html = readFileSync(arquivo, 'utf8');
    const texto = soTexto(html);

    // 1. legível sem JavaScript
    checa('o texto aparece sem executar JavaScript', texto.length > 2500, `${texto.length} caracteres`);
    checa('tem o H1 da página', html.includes(`>${doc.h1}<`));
    checa('tem a data de última atualização', texto.includes(legal.atualizado));
    const ultimoBloco = [...doc.blocos].reverse().find(b => b.p);
    // Tira a marcação (**negrito**, *ênfase*) e os curingas: no HTML eles já viraram tags/valores.
    const pedaco = soTexto(ultimoBloco.p
      .replace(/\{(\w+)\}/g, (i, k) => legal.vars[k] ?? i)
      .replace(/\*+/g, '')).slice(0, 48);
    checa('o texto vai até o ÚLTIMO bloco (não é só o cabeçalho)', texto.includes(pedaco), pedaco);

    // 2. identidade: COFICO, não Saporino
    checa('título da aba é da COFICO', new RegExp(`<title>${doc.titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</title>`).test(html));
    checa('canonical aponta para o domínio da COFICO',
      html.includes(`<link rel="canonical" href="https://www.coficobrasil.com.br/${doc.slug}" />`));
    checa('og:site_name é COFICO Brasil', html.includes('content="COFICO Brasil"'));
    checa('favicon é o da COFICO', html.includes('/icons/cofico-icon-512.png') && !html.includes('/icons/saporino-icon-512.png'));
    checa('nenhum "Saporino" no HTML', !/saporino/i.test(html.replace(/\/icons\/cofico[^"']*/g, '')));
    checa('CNPJ da COFICO presente', texto.includes(legal.vars.cnpj));
    checa('CNPJ da Saporino ausente', !html.includes('61.109.694'));
    checa('exatamente 1 og:title / 1 canonical / 1 JSON-LD',
      (html.match(/property="og:title"/g) || []).length === 1 &&
      (html.match(/rel="canonical"/g) || []).length === 1 &&
      (html.match(/application\/ld\+json/g) || []).length === 1);

    // 3. links legais relativos (funcionam na raiz do domínio E sob /coficobrasil/)
    checa('links legais são relativos', html.includes('href="privacidade"') && !html.includes('href="/privacidade"'));

    // 4. o app React continua embarcado (a página não virou HTML morto)
    checa('o app React segue no arquivo', /<script type="module"[^>]+src="\/assets\//.test(html));
  }

  console.log('\n— WhatsApp: plano, não promessa');
  const priv = legal.documentos.find(d => d.slug === 'privacidade');
  const textoPriv = priv.blocos.flatMap(b => [b.h2, b.p, b.aviso, ...(b.ul ?? [])]).filter(Boolean).join('\n');
  checa('cita a WhatsApp Business Platform', /WhatsApp Business Platform/.test(textoPriv));
  checa('não afirma que a integração já está ativa',
    !/integração (já )?(está )?(ativa|em opera[çc]ão|funcionando)/i.test(textoPriv));
  checa('SEM aviso provisório na página pública',
    !/em prepara[çc]ão|ainda não está em opera|por enquanto|provisóri/i.test(textoPriv));
  checa('SEM tarja de revisão jurídica na página pública', !/revisão jurídica/i.test(textoPriv));
  checa('as pendências jurídicas estão registradas fora da página',
    legal.documentos.every(d => Array.isArray(d.revisaoJuridica) && d.revisaoJuridica.length > 0));
  checa('cobre a operação inteira (cliente, fornecedor, rep, pedido, entrega, comissão)',
    ['cliente', 'fornecedor', 'representante', 'promotor', 'pedido', 'entrega', 'comiss']
      .every(t => textoPriv.toLowerCase().includes(t)));
  checa('explica finalidades, dados, base legal, retenção e exclusão',
    ['Quais dados tratamos', 'base legal', 'Por quanto tempo guardamos', 'exclusão']
      .every(t => textoPriv.includes(t)));
  checa('declara a análise de crédito e a autorização específica do birô',
    /limite de crédito/i.test(textoPriv) && /birô de crédito/i.test(textoPriv)
    && /Art\. 7º, X/.test(textoPriv) && /não é feita com base em autorização genérica/i.test(textoPriv));
  checa('não assume como da COFICO equipe de outra empresa',
    /vinculados à COFICO/.test(textoPriv) && /controladora nesse caso/.test(textoPriv));
  checa('separa as 4 categorias de monitoramento em campo',
    ['Localização pontual', 'Registro da visita', 'Status de presença', 'Atividade no sistema']
      .every(c => textoPriv.includes(c)));
  checa('entrega: canhoto fotografado, sem assinatura digital',
    /canhoto ou comprovante assinado/i.test(textoPriv)
    && /Não coletamos assinatura digital nem biometria/i.test(textoPriv));
  checa('não promete isolamento técnico que o sistema não tem',
    /e não uma separação técnica completa/i.test(textoPriv));
  checa('trata decisão automatizada (Art. 20)', /Art\. 20/.test(textoPriv) && /revisão por pessoa natural/i.test(textoPriv));
  checa('aponta a transferência internacional (Meta)', /transferência internacional/i.test(textoPriv));

  // Estes dois não aparecem no HTML estático: são de tempo de execução. Ficam aqui porque
  // foram achados DEPOIS do deploy, no navegador, e não podem voltar.
  console.log('\n— identidade e rodapé (regressão achada em produção)');
  const app = readFileSync(resolve('src/App.tsx'), 'utf8');
  const iDominio = app.indexOf('if (noDominioCofico()) return;');
  const iTitulo = app.indexOf("'Café Saporino — O Verdadeiro Sabor de Minas'");
  checa('o título da aba sai fora pelo DOMÍNIO da COFICO, não só pelo caminho',
    iDominio > 0 && iDominio < iTitulo,
    'sem isso, coficobrasil.com.br/ abre com o título da Saporino na aba');
  const aviso = readFileSync(resolve('src/pages/coficobrasil/CoficoCookieConsent.tsx'), 'utf8');
  checa('o aviso de cookies reserva espaço e não cobre o rodapé',
    /document\.body\.style\.paddingBottom/.test(aviso),
    'sem isso, os 3 links legais do rodapé ficam inclicáveis até alguém aceitar');

  console.log('\n— roteamento (vercel.json)');
  const rotas = vercel.routes;
  const idx = (re) => rotas.findIndex(r => re.test(r.src));
  const iCatchall = rotas.findIndex(r => r.src === '/(.*)');
  const iRaiz = idx(/^\/\(privacidade\|termos\|exclusao-de-dados\)/);
  const iSob = idx(/^\/coficobrasil\/\(privacidade/);
  checa('rota /<slug> existe e vem antes do catchall', iRaiz >= 0 && iRaiz < iCatchall);
  checa('rota /<slug> só vale no domínio da COFICO',
    iRaiz >= 0 && JSON.stringify(rotas[iRaiz].has ?? []).includes('coficobrasil'));
  checa('rota /coficobrasil/<slug> existe e vem antes do catchall', iSob >= 0 && iSob < iCatchall);
  checa('as rotas apontam para o arquivo gerado',
    rotas[iRaiz]?.dest === '/cofico-$1.html' && rotas[iSob]?.dest === '/cofico-$1.html');
  // Pegou a gente em produção: com `has`, os grupos do HOST entram na MESMA numeração dos
  // grupos do `src`. Um `(www\.)?` capturante rouba o $1 — o destino virava /cofico-www..html,
  // não existia, e a rota caía no catchall servindo o index da Saporino no domínio da COFICO.
  for (const [i, r] of rotas.entries()) {
    if (!/\$\d/.test(r.dest ?? '')) continue;
    for (const h of r.has ?? []) {
      checa(`rota ${i} (${r.src}): grupo do host é não-capturante`,
        !/\((?!\?)/.test(h.value ?? ''), `has.value = ${h.value}`);
    }
  }
  for (const doc of legal.documentos) {
    checa(`sitemap lista /${doc.slug}`, sitemap.includes(`/${doc.slug}</loc>`));
  }
  checa('robots não bloqueia as páginas legais',
    !legal.documentos.some(d => robots.includes(`Disallow: /${d.slug}`)));

  // As pendências jurídicas NÃO aparecem na página (decisão de 13/10/2026: política
  // definitiva não carrega tarja). Então elas saem aqui, toda vez que a bancada roda.
  console.log('\n— pendente de revisão jurídica (fora da página) —');
  for (const doc of legal.documentos) {
    console.log(`  /${doc.slug}`);
    for (const ponto of doc.revisaoJuridica ?? []) console.log(`    · ${ponto}`);
  }

  console.log(`\n${ok} verificações ok, ${falhas.length} falhas.`);
  if (falhas.length) { falhas.forEach(f => console.log('  · ' + f)); process.exitCode = 1; }
}
