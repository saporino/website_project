// Conduz a demonstração da central de WhatsApp para a gravação do App Review da Meta.
//
//   node scripts/whatsapp-demo-gravacao.mjs            (ensaio: não envia nada)
//   node scripts/whatsapp-demo-gravacao.mjs --enviar   (envia DE VERDADE, exige autorização)
//
// Por que um script e não um roteiro escrito: a gravação precisa sair igual todas as vezes,
// sem hesitação do mouse e sem nada sensível aparecendo. Aqui cada passo é deliberado, com
// pausa para a câmera acompanhar, e o que não pode aparecer simplesmente não é aberto.
//
// Ele NÃO grava a tela — grava quem lê isto, com o gravador do Windows (Win+Alt+R). O
// script existe para que, enquanto a gravação roda, a tela faça exatamente o combinado.
//
// NUNCA roda em produção: a trava de ambiente aborta.
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, anunciar, confirmarNoBanco } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: false });
anunciar(ambiente);
const db = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });
await confirmarNoBanco(db, ambiente, { destrutivo: false });

const vaiEnviar = process.argv.includes('--enviar');
const sql = async (q) => { const { data, error } = await db.rpc('exec_select', { q }); if (error) throw new Error(error.message); return data; };
const pausa = (s) => new Promise(r => setTimeout(r, s * 1000));
const passo = (n, t) => console.log(`\n[${n}] ${t}`);
const mascarar = (t) => (t && t.length >= 8) ? t.slice(0, 4) + '•'.repeat(t.length - 8) + t.slice(-4) : '•••';

console.log(`\nmodo: ${vaiEnviar ? '*** ENVIO REAL ***' : 'ensaio (nada sai)'}`);

// ── O que a demonstração precisa encontrar pronto ────────────────────────────
passo(0, 'conferindo o cenario antes de qualquer gravacao');
const [numero] = await sql(`
  select n.phone_number_id, n.envio_habilitado, n.ativo, n.ambiente, c.fantasia empresa
    from wa_numeros n join companies c on c.id = n.company_id
   where n.phone_number_id = '1386100787926214'`);
if (!numero) { console.error('  FALTA: o numero de teste nao esta em wa_numeros.'); process.exitCode = 1; }
else console.log(`  numero de teste -> ${numero.empresa} · envio ${numero.envio_habilitado ? 'habilitado' : 'DESABILITADO'} · ${numero.ambiente}`);

const [conversa] = await sql(`
  select id, nome_perfil, telefone_e164, janela_aberta, janela_minutos, nao_lidas
    from vw_wa_caixa order by ultima_entrada_em desc nulls last limit 1`);
if (!conversa) {
  console.error('\n  FALTA: nenhuma conversa. Mande uma mensagem do celular para o numero de teste');
  console.error('  ANTES de gravar - a demonstracao precisa de uma conversa recebida de verdade.');
  process.exitCode = 1;
} else {
  console.log(`  conversa: ${conversa.nome_perfil} · ${mascarar(conversa.telefone_e164)}`);
  console.log(`  janela: ${conversa.janela_aberta ? `aberta, ${conversa.janela_minutos} min` : 'FECHADA'}`);
  if (!conversa.janela_aberta) {
    console.error('\n  A janela de 24h esta FECHADA. Mande uma mensagem nova do celular antes de gravar:');
    console.error('  fora da janela o envio e recusado, e a gravacao mostraria uma recusa.');
    process.exitCode = 1;
  }
}

const temToken = (await sql(`select 1 as x`)) && true;   // o segredo vive na funcao, não aqui
console.log('\n  obs.: se WHATSAPP_COFICO_TOKEN nao estiver configurado, o envio sai SIMULADO');
console.log('        e NAO serve para a gravacao do App Review.');

if (process.exitCode === 1) {
  console.error('\nCenario incompleto. Resolva os pontos acima e rode de novo.');
} else {
  // ── O roteiro, passo a passo, com pausa para a camera ──────────────────────
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(' COMECE A GRAVAR AGORA (Win+Alt+R). O roteiro comeca em 10s.');
  console.log('──────────────────────────────────────────────────────────────');
  await pausa(10);

  passo(1, 'MOSTRE a central autenticada — http://localhost:5174/repco/whatsapp');
  console.log('    Deixe visivel: o nome da empresa (COFICO), a lista de conversas e');
  console.log('    o indicador da janela de 24 horas. NAO abra Configuracoes nem o painel');
  console.log('    de outra empresa.');
  await pausa(12);

  passo(2, 'ABRA a conversa do contato de teste');
  console.log('    Mostre o historico recebido e o nome do atendente responsavel.');
  await pausa(10);

  passo(3, 'DIGITE a resposta no campo, devagar, para a camera ler');
  const texto = `Ola! Esta e uma mensagem de demonstracao enviada pela central de atendimento do RepCo (COFICO Brasil). ${new Date().toLocaleString('pt-BR')}`;
  console.log(`    Sugestao de texto:\n      ${texto}`);
  await pausa(14);

  if (vaiEnviar) {
    passo(4, 'ENVIE — clique em Enviar na tela. (Este script NAO envia por voce.)');
    console.log('    O envio tem de partir da INTERFACE, nao de um script: e isso que a Meta');
    console.log('    precisa ver. O script so conduz a gravacao.');
  } else {
    passo(4, 'ENSAIO: nao clique em Enviar. Rode com --enviar quando for valendo.');
  }
  await pausa(12);

  passo(5, 'MOSTRE a mensagem aparecendo na conversa, com o selo de estado');
  console.log('    enviada -> entregue -> lida, conforme a Meta confirmar.');
  await pausa(12);

  passo(6, 'VIRE a camera para o CELULAR e mostre a mesma mensagem chegando');
  console.log('    Esta e a parte que a Meta mais olha: a mensagem saindo do sistema');
  console.log('    e chegando no WhatsApp do destinatario.');
  await pausa(18);

  passo(7, 'RESPONDA do celular e mostre a resposta chegando na central sozinha');
  console.log('    Prova o recebimento por webhook, sem recarregar a pagina.');
  await pausa(20);

  console.log('\nFIM. Pare a gravacao (Win+Alt+R).');
}

// ── O que ficou registrado, para conferir depois da gravacao ─────────────────
const [resumo] = await sql(`
  select (select count(*)::int from wa_mensagens where direcao='entrada') recebidas,
         (select count(*)::int from wa_mensagens where direcao='saida') enviadas,
         (select count(*)::int from wa_mensagens where id_externo like 'wamid.SIMULADO.%') simuladas`);
console.log(`\nno banco agora: ${resumo.recebidas} recebida(s) · ${resumo.enviadas} enviada(s) · ${resumo.simuladas} simulada(s)`);
if (resumo.simuladas > 0) {
  console.log('ATENCAO: ha mensagem SIMULADA no historico. Apague antes de gravar, ou o video');
  console.log('mostra como real algo que nunca saiu.');
}
