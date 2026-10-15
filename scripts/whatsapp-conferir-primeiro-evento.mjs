// Confere o PRIMEIRO evento real vindo da Meta — STAGING, só leitura.
//
//   node scripts/whatsapp-conferir-primeiro-evento.mjs
//
// Roda depois de mandar uma mensagem do número autorizado para o número de teste da Meta.
// Não escreve nada, não envia nada, não fala com a Meta. Só lê o que chegou e responde às
// cinco perguntas que importam:
//
//   1. a assinatura real da Meta foi aceita?   (é o que prova que o App Secret está certo)
//   2. a empresa foi identificada como COFICO?
//   3. a mensagem entrou UMA vez?
//   4. o histórico ficou salvo?
//   5. nada se misturou com outra empresa?
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, anunciar, confirmarNoBanco } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: false });
anunciar(ambiente);
const db = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });
await confirmarNoBanco(db, ambiente, { destrutivo: false });

const sql = async (q) => { const { data, error } = await db.rpc('exec_select', { q }); if (error) throw new Error(error.message); return data; };
let ok = 0; const falhas = [], avisos = [];
const checa = (n, c, d = '') => { if (c) { ok++; console.log(`  ok    ${n}`); } else { falhas.push(n + (d ? ` — ${d}` : '')); console.log(`  FALHA ${n}${d ? ' — ' + d : ''}`); } };
/** Telefone nunca sai inteiro, nem aqui. */
const mascarar = (t) => (t && t.length >= 8) ? t.slice(0, 4) + '•'.repeat(t.length - 8) + t.slice(-4) : '•••';

const PNID_TESTE = '1386100787926214';
// A amostra "Incoming Message" do painel da Meta usa SEMPRE estes valores ficticios. Ela
// serve para provar que a URL e a assinatura funcionam - nao para criar conversa. Sem
// reconhecer isso, o relatorio acusa falha no que e o comportamento correto.
const PNID_AMOSTRA = '123456123';

// process.exit() no Windows dispara "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)".
// Por isso o corpo vive numa funcao: sair dela e um `return`, e o processo termina sozinho.
async function conferir() {

console.log('\n— 1. chegou alguma coisa? —');
const eventos = await sql(`
  select resultado, phone_number_id, company_id is not null as tem_empresa,
         mensagens, statuses, ignorados, detalhe, recebido_em
    from wa_eventos order by recebido_em desc limit 10`);
if (eventos.length === 0) {
  console.log('\nNenhum evento recebido ainda.');
  console.log('Isso significa uma destas coisas, em ordem de probabilidade:');
  console.log('  · o webhook ainda nao foi cadastrado no painel da Meta;');
  console.log('  · o campo "messages" nao foi assinado no painel;');
  console.log('  · a mensagem foi enviada de um numero que nao esta na lista de destinatarios de teste.');
  console.log('\nNada foi gravado e nada esta errado no banco. Volte depois de mandar a mensagem.');
  return;
}
console.log(`  ${eventos.length} evento(s) recebido(s). O mais recente: ${eventos[0].recebido_em}`);

console.log('\n— 2. a assinatura REAL da Meta foi aceita? —');
// Se o App Secret estivesse errado, a funcao teria devolvido 401 e NENHUM evento existiria.
// Um evento gravado ja e a prova de que a assinatura bateu.
checa('a assinatura bateu (existe evento gravado)', eventos.length > 0);
const recusados = eventos.filter(e => e.resultado === 'assinatura_invalida');
checa('nenhum evento marcado como assinatura invalida', recusados.length === 0, `${recusados.length}`);

console.log('\n— 3. a empresa foi identificada? —');
const amostras = eventos.filter(e => e.phone_number_id === PNID_AMOSTRA);
const doTeste = eventos.filter(e => e.phone_number_id === PNID_TESTE);
const outros = eventos.filter(e => ![PNID_AMOSTRA, PNID_TESTE].includes(e.phone_number_id));

if (amostras.length) {
  console.log(`  i     ${amostras.length} evento(s) da AMOSTRA padrao da Meta (phone_number_id ${PNID_AMOSTRA}).`);
  checa('a amostra foi tratada como numero desconhecido, como deve',
    amostras.every(e => e.resultado === 'numero_desconhecido'),
    amostras.map(e => e.resultado).join(', '));
  checa('a amostra NAO foi associada a nenhuma empresa', amostras.every(e => !e.tem_empresa));
}
if (doTeste.length) {
  checa('evento do numero de teste da COFICO identificou a empresa',
    doTeste.every(e => e.tem_empresa), doTeste.map(e => e.resultado).join(', '));
} else if (!amostras.length) {
  falhas.push('nenhum evento veio do numero de teste nem da amostra padrao');
  console.log('  FALHA nenhum evento veio do numero de teste nem da amostra padrao');
} else {
  avisos.push('so chegou a amostra padrao. Para criar conversa de verdade, mande uma mensagem REAL de um numero autorizado para o numero de teste.');
}
if (outros.length) {
  falhas.push(`evento de numero inesperado: ${[...new Set(outros.map(e => e.phone_number_id))].join(', ')}`);
  console.log('  FALHA evento de numero inesperado');
}
const comErro = eventos.filter(e => e.resultado === 'erro');
if (comErro.length) avisos.push(`${comErro.length} evento(s) com resultado 'erro': ${comErro[0].detalhe ?? ''}`);

console.log('\n— 4. a mensagem entrou UMA vez? —');
const msgs = await sql(`
  select m.id_externo, m.direcao, m.tipo, m.estado, m.ocorrida_em,
         c.fantasia as empresa, c.cnpj, ct.telefone_e164, ct.nome_perfil
    from wa_mensagens m
    join companies c on c.id = m.company_id
    join wa_conversas cv on cv.id = m.conversa_id
    join wa_contatos ct on ct.id = cv.contato_id
   order by m.ocorrida_em desc limit 20`);
const soAmostra = amostras.length > 0 && doTeste.length === 0;
  if (soAmostra) {
    console.log('  i     nenhuma mensagem gravada — correto: a amostra nao tem numero cadastrado.');
    ok++;
  } else {
    checa('ao menos uma mensagem gravada', msgs.length > 0, `${msgs.length}`);
  }
const porWamid = new Map();
for (const m of msgs) porWamid.set(m.id_externo, (porWamid.get(m.id_externo) ?? 0) + 1);
const duplicadas = [...porWamid.entries()].filter(([, n]) => n > 1);
checa('nenhum wamid duplicado', duplicadas.length === 0, JSON.stringify(duplicadas));
for (const m of msgs.slice(0, 5)) {
  console.log(`    ${m.direcao.padEnd(7)} ${m.tipo.padEnd(10)} ${mascarar(m.telefone_e164)}  ${m.empresa}`);
}

console.log('\n— 5. tudo da COFICO, nada de outra empresa? —');
const empresas = [...new Set(msgs.map(m => m.cnpj))];
checa('todas as mensagens sao da COFICO', empresas.length <= 1 && (empresas[0] ?? '66006929000136') === '66006929000136',
  `CNPJs encontrados: ${empresas.join(', ')}`);
const saporino = msgs.filter(m => m.cnpj === '61109694000194');
checa('nenhuma mensagem caiu na Saporino', saporino.length === 0, `${saporino.length}`);

console.log('\n— 6. o historico ficou salvo? —');
const caixa = await sql(`
  select nome_perfil, telefone_e164, nao_lidas, janela_aberta, janela_minutos, status
    from vw_wa_caixa order by ultima_entrada_em desc nulls last limit 5`);
if (soAmostra) { console.log('  i     caixa vazia — correto: a amostra nao vira conversa.'); ok++; }
  else checa('a conversa aparece na caixa de entrada', caixa.length > 0, `${caixa.length}`);
for (const c of caixa) {
  console.log(`    ${(c.nome_perfil ?? '(sem nome)').padEnd(22)} ${mascarar(c.telefone_e164)}  ` +
    `${c.nao_lidas} nao lida(s) · janela ${c.janela_aberta ? 'aberta (' + c.janela_minutos + ' min)' : 'fechada'}`);
}

// Este teste nasceu quando NADA tinha sido enviado, afirmando "zero saidas". Enviar virou
// funcionalidade, entao a pergunta mudou: o que importa nao e SE saiu, e se saiu com ALGUEM
// por tras. Mensagem sem autor seria disparo automatico — exatamente o que a COFICO nao faz
// e o que a Meta nao quer ver.
console.log('\n— 7. toda saida tem uma pessoa por tras —');
const [env] = await sql(`select count(*)::int total,
                                count(*) filter (where enviada_por is null)::int sem_autor,
                                count(*) filter (where estado='falhou')::int falharam
                           from wa_mensagens where direcao='saida'`);
console.log(`    ${env.total} saida(s) · ${env.falharam} com falha registrada`);
checa('nenhuma saida sem autor humano', env.sem_autor === 0, `${env.sem_autor} sem autor`);

  if (avisos.length) { console.log('\navisos:'); avisos.forEach(a => console.log('  ! ' + a)); }
  console.log(`\n${ok} verificacoes ok, ${falhas.length} falhas.`);
  if (falhas.length) { falhas.forEach(f => console.log('  · ' + f)); process.exitCode = 1; }
  else if (soAmostra) console.log('\nA amostra da Meta entrou certo: ASSINATURA REAL ACEITA, tratada como numero\n'
    + 'desconhecido, sem criar conversa e sem tocar em nenhuma empresa.\n'
    + 'Falta so a mensagem REAL, de um numero autorizado para o numero de teste.');
  else console.log('\nO primeiro evento real entrou certo: assinatura aceita, empresa COFICO, sem duplicata, sem mistura.');
}

await conferir();
