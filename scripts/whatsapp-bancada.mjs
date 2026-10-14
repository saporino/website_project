// Bancada da caixa de entrada de WhatsApp — STAGING apenas.
//
//   node scripts/whatsapp-bancada.mjs
//
// Prova, com usuários de verdade e JWT de verdade (não service role), que:
//   · quem não tem papel não vê NADA;
//   · quem atende a empresa A não vê a conversa da empresa B;
//   · número desconhecido não vira mensagem — não existe empresa padrão;
//   · reenvio do mesmo evento não duplica;
//   · contato externo existe sem ser usuário;
//   · company_id trocado é recusado pelo banco, mesmo com papel válido.
//
// Cria e apaga os próprios dados. Nenhum dado real de cliente.
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, anunciar, confirmarNoBanco } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: true });   // nunca roda em produção
anunciar(ambiente);
const admin = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

const URL = ambiente.env.VITE_SUPABASE_URL, ANON = ambiente.env.VITE_SUPABASE_ANON_KEY;
let ok = 0; const falhas = [];
const checa = (nome, cond, detalhe = '') => {
  if (cond) { ok++; console.log(`  ok    ${nome}`); }
  else { falhas.push(nome + (detalhe ? ` — ${detalhe}` : '')); console.log(`  FALHA ${nome}${detalhe ? ' — ' + detalhe : ''}`); }
};
const sql = async (q) => { const { data, error } = await admin.rpc('exec_select', { q }); if (error) throw new Error(error.message); return data; };
const lixo = [];

/** Usuário temporário, logado de verdade: devolve um client com o JWT dele. */
async function usuario(email, papel, companyId) {
  const senha = 'bancada-' + Math.random().toString(36).slice(2) + 'Aa1!';
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(`criar ${email}: ${error.message}`);
  lixo.push(() => admin.auth.admin.deleteUser(data.user.id));
  if (papel) {
    const { error: e2 } = await admin.from('user_roles')
      .insert({ user_id: data.user.id, role_code: papel, company_id: companyId, is_active: true });
    if (e2) throw new Error(`papel ${papel}: ${e2.message}`);
  }
  const cli = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e3 } = await cli.auth.signInWithPassword({ email, password: senha });
  if (e3) throw new Error(`login ${email}: ${e3.message}`);
  return { cli, id: data.user.id };
}

try {
  // O staging nasceu sem o catalogo de papeis de producao (so tem o que as migrations
  // criaram). Sem isto, testar "representante nao entra" falha na chave estrangeira em vez
  // de testar o que interessa.
  await admin.from('roles').upsert([
    { code: 'representante', label: 'Representante Comercial' },
    { code: 'promotor', label: 'Promotor' },
    { code: 'admin', label: 'Administrador' },
  ], { onConflict: 'code' });

  // ───────────────────────────────────────────────── duas empresas de mentira
  const marca = 'BANCADA-WA-' + Date.now();
  const { data: empresas, error: eEmp } = await admin.from('companies').insert([
    { name: `${marca}-A`, cnpj: '00000000000191', order_prefix: 'XA', payment_account: 'bancada_a', is_active: false },
    { name: `${marca}-B`, cnpj: '00000000000272', order_prefix: 'XB', payment_account: 'bancada_b', is_active: false },
  ]).select('id, name');
  if (eEmp) throw new Error('empresas: ' + eEmp.message);
  const [A, B] = empresas;
  // A cadeia de FKs trava em DOIS pontos com 'on delete restrict': wa_numeros segura a
  // empresa, e wa_conversas segura o numero. Apagar fora de ordem falha em silencio e
  // deixa lixo no staging - foi o que aconteceu na primeira rodada. De dentro para fora:
  const limparEmpresas = async (ids) => {
    for (const t of ['wa_mensagens', 'wa_conversas', 'wa_contatos', 'wa_numeros', 'marketing_contacts']) {
      const { error } = await admin.from(t).delete().in('company_id', ids);
      if (error) throw new Error(`${t}: ${error.message}`);
    }
    const { error } = await admin.from('companies').delete().in('id', ids);
    if (error) throw new Error(`companies: ${error.message}`);
  };
  lixo.push(() => limparEmpresas([A.id, B.id]));

  const { data: numeros, error: eNum } = await admin.from('wa_numeros').insert([
    { phone_number_id: 'PNID-A-' + Date.now(), numero_e164: '551100000001', company_id: A.id, conjunto_credencial: 'bancada_a', rotulo: 'A' },
    { phone_number_id: 'PNID-B-' + Date.now(), numero_e164: '551100000002', company_id: B.id, conjunto_credencial: 'bancada_b', rotulo: 'B' },
  ]).select('id, phone_number_id, company_id');
  if (eNum) throw new Error('numeros: ' + eNum.message);
  const nA = numeros.find(n => n.company_id === A.id), nB = numeros.find(n => n.company_id === B.id);

  const conversa = async (empresa, numero, telefone, texto) => {
    const { data: ct, error: e1 } = await admin.from('wa_contatos')
      .insert({ company_id: empresa.id, telefone_e164: telefone, nome_perfil: 'Contato de teste' }).select('id').single();
    if (e1) throw new Error('contato: ' + e1.message);
    const { data: cv, error: e2 } = await admin.from('wa_conversas')
      .insert({ company_id: empresa.id, numero_id: numero.id, contato_id: ct.id, ultima_entrada_em: new Date().toISOString() }).select('id').single();
    if (e2) throw new Error('conversa: ' + e2.message);
    const { data: ms, error: e3 } = await admin.from('wa_mensagens').insert({
      company_id: empresa.id, conversa_id: cv.id, id_externo: 'wamid.' + telefone + Date.now(),
      direcao: 'entrada', tipo: 'texto', texto, ocorrida_em: new Date().toISOString(),
    }).select('id, id_externo').single();
    if (e3) throw new Error('mensagem: ' + e3.message);
    return { contato: ct, conversa: cv, mensagem: ms };
  };

  const dadoA = await conversa(A, nA, '5511900000001', 'SEGREDO-DA-EMPRESA-A');
  const dadoB = await conversa(B, nB, '5511900000002', 'SEGREDO-DA-EMPRESA-B');

  // ───────────────────────────────────────────── 1. número → empresa, sem padrão
  console.log('\n— o numero decide a empresa, e nao existe padrao —');
  const [{ empresa_a }] = await sql(`select public.wa_empresa_do_numero('${nA.phone_number_id}')::text as empresa_a`);
  checa('numero conhecido devolve a empresa dele', empresa_a === A.id, `${empresa_a}`);
  const [{ desconhecido }] = await sql(`select coalesce(public.wa_empresa_do_numero('PNID-QUE-NAO-EXISTE')::text,'(nulo)') as desconhecido`);
  checa('numero DESCONHECIDO devolve nulo (nenhuma empresa padrao)', desconhecido === '(nulo)', desconhecido);
  await admin.from('wa_numeros').update({ ativo: false }).eq('id', nB.id);
  const [{ inativo }] = await sql(
    `select coalesce(public.wa_empresa_do_numero('${nB.phone_number_id}')::text,'(nulo)') as inativo`);
  checa('numero DESATIVADO tambem devolve nulo', inativo === '(nulo)', inativo);
  await admin.from('wa_numeros').update({ ativo: true }).eq('id', nB.id);

  // ──────────────────────────────────────────────── 2. idempotência
  console.log('\n— reenvio do mesmo evento nao duplica —');
  const { error: eDup } = await admin.from('wa_mensagens').insert({
    company_id: A.id, conversa_id: dadoA.conversa.id, id_externo: dadoA.mensagem.id_externo,
    direcao: 'entrada', tipo: 'texto', texto: 'reenvio', ocorrida_em: new Date().toISOString(),
  });
  checa('wamid repetido e recusado pelo banco', !!eDup && /duplicate|unique/i.test(eDup.message), eDup?.message?.slice(0, 60) ?? 'passou!');
  const assinatura = 'sha-' + Date.now();
  const evento = { company_id: A.id, phone_number_id: nA.phone_number_id, assinatura, corpo: { teste: true } };
  await admin.from('wa_eventos').insert(evento);
  const { error: eDup2 } = await admin.from('wa_eventos').insert(evento);
  checa('entrega repetida e identica nao vira evento novo', !!eDup2, eDup2?.message?.slice(0, 60) ?? 'passou!');

  // ────────────────────────────────── 3. coerência: company_id trocado é recusado
  console.log('\n— company_id trocado e recusado pelo banco —');
  const { error: eTroca } = await admin.from('wa_mensagens').insert({
    company_id: B.id, conversa_id: dadoA.conversa.id, id_externo: 'wamid.troca' + Date.now(),
    direcao: 'entrada', tipo: 'texto', texto: 'x', ocorrida_em: new Date().toISOString(),
  });
  checa('mensagem com empresa diferente da conversa e barrada', !!eTroca, eTroca?.message?.slice(0, 70) ?? 'passou!');
  checa('o texto da mensagem NAO aparece no erro', !/SEGREDO|'x'/.test(eTroca?.message ?? ''), eTroca?.message?.slice(0, 70));
  const { error: eConv } = await admin.from('wa_conversas').insert({
    company_id: B.id, numero_id: nA.id, contato_id: dadoA.contato.id,
  });
  checa('conversa com numero de outra empresa e barrada', !!eConv, eConv?.message?.slice(0, 70) ?? 'passou!');

  // ──────────────────────────────────────── 4. contato externo não é usuário
  console.log('\n— contato externo existe sem ser usuario —');
  const colunas = await sql(`
    select column_name from information_schema.columns
     where table_name='wa_contatos' and column_name in ('user_id','auth_id','usuario_id')`);
  checa('wa_contatos nao tem coluna de usuario', colunas.length === 0, JSON.stringify(colunas));
  const fks = await sql(`
    select conname from pg_constraint
     where conrelid='public.wa_contatos'::regclass and confrelid::regclass::text like '%users%'`);
  checa('wa_contatos nao referencia auth.users', fks.length === 0, JSON.stringify(fks));

  // ─────────────────────────────────────────────────── 5. RLS, com JWT de verdade
  console.log('\n— quem ve o que (JWT real, nao service role) —');
  const selo = Date.now();
  const semPapel = await usuario(`bancada-wa-sem-${selo}@exemplo.test`, null, null);
  // O representante comercial NAO atende o WhatsApp externo. Ele vende, lanca pedido e
  // ve a propria comissao - conversa de cliente com a empresa nao e area dele. Um papel
  // valido no sistema nao pode virar passe para esta caixa.
  const repComum = await usuario(`bancada-wa-rep-${selo}@exemplo.test`, 'representante', A.id);
  const promotor = await usuario(`bancada-wa-promo-${selo}@exemplo.test`, 'promotor', A.id);
  const atendeA = await usuario(`bancada-wa-a-${selo}@exemplo.test`, 'atendimento', A.id);
  const atendeB = await usuario(`bancada-wa-b-${selo}@exemplo.test`, 'atendimento', B.id);

  const conta = async (quem, tabela) => {
    const { data, error } = await quem.cli.from(tabela).select('id');
    return error ? -1 : (data?.length ?? 0);
  };
  for (const t of ['wa_numeros', 'wa_contatos', 'wa_conversas', 'wa_mensagens', 'wa_eventos']) {
    checa(`usuario SEM papel nao le ${t}`, (await conta(semPapel, t)) === 0);
  }
  for (const t of ['wa_contatos', 'wa_conversas', 'wa_mensagens', 'wa_eventos']) {
    checa(`REPRESENTANTE da mesma empresa nao le ${t}`, (await conta(repComum, t)) === 0);
    checa(`PROMOTOR da mesma empresa nao le ${t}`, (await conta(promotor, t)) === 0);
  }
  const { error: eRep } = await repComum.cli.from('wa_mensagens').insert({
    company_id: A.id, conversa_id: dadoA.conversa.id, id_externo: 'wamid.rep' + Date.now(),
    direcao: 'entrada', tipo: 'texto', texto: 'x', ocorrida_em: new Date().toISOString(),
  });
  checa('REPRESENTANTE nao escreve na caixa', !!eRep, eRep?.message?.slice(0, 50) ?? 'ESCREVEU!');
  const { data: msgsA } = await atendeA.cli.from('wa_mensagens').select('id, texto');
  checa('atendimento da A ve a conversa da A', (msgsA ?? []).some(m => m.texto === 'SEGREDO-DA-EMPRESA-A'));
  checa('atendimento da A NAO ve a conversa da B', !(msgsA ?? []).some(m => m.texto === 'SEGREDO-DA-EMPRESA-B'),
    JSON.stringify((msgsA ?? []).map(m => m.texto)));
  const { data: msgsB } = await atendeB.cli.from('wa_mensagens').select('id, texto');
  checa('atendimento da B ve so a conversa da B',
    (msgsB ?? []).some(m => m.texto === 'SEGREDO-DA-EMPRESA-B') && !(msgsB ?? []).some(m => m.texto === 'SEGREDO-DA-EMPRESA-A'));
  checa('atendimento NAO le o evento cru (so admin)', (await conta(atendeA, 'wa_eventos')) === 0);

  // escrita cruzada: papel na A tentando escrever na B
  const { error: eEscrita } = await atendeA.cli.from('wa_mensagens').insert({
    company_id: B.id, conversa_id: dadoB.conversa.id, id_externo: 'wamid.cruz' + Date.now(),
    direcao: 'entrada', tipo: 'texto', texto: 'invasao', ocorrida_em: new Date().toISOString(),
  });
  checa('atendimento da A nao escreve na caixa da B', !!eEscrita, eEscrita?.message?.slice(0, 60) ?? 'ESCREVEU!');
  const { error: eUpd } = await atendeA.cli.from('wa_mensagens').update({ texto: 'alterado' }).eq('id', dadoB.mensagem.id);
  const { data: depois } = await admin.from('wa_mensagens').select('texto').eq('id', dadoB.mensagem.id).single();
  checa('atendimento da A nao altera mensagem da B', depois?.texto === 'SEGREDO-DA-EMPRESA-B', `${depois?.texto} ${eUpd?.message ?? ''}`);

  // visitante sem login nenhum
  const anonimo = createClient(URL, ANON, { auth: { persistSession: false } });
  for (const t of ['wa_numeros', 'wa_contatos', 'wa_conversas', 'wa_mensagens', 'wa_eventos']) {
    const { data, error } = await anonimo.from(t).select('id');
    checa(`visitante sem login nao le ${t}`, (error != null) || (data?.length ?? 0) === 0, error?.message?.slice(0, 40));
  }

  // ─────────────────────────────────────────────── 6. estrutura e integridade
  console.log('\n— estrutura —');
  const tabelas = await sql(`
    select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and c.relname like 'wa\\_%' order by 1`);
  checa('as cinco tabelas existem', tabelas.length === 5, tabelas.map(t => t.relname).join(', '));
  checa('RLS ligada nas cinco', tabelas.every(t => t.relrowsecurity));
  const semEmpresa = await sql(`
    select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and c.relname like 'wa\\_%'
       and not exists (select 1 from information_schema.columns
                        where table_name=c.relname and column_name='company_id')`);
  checa('todas tem company_id', semEmpresa.length === 0, JSON.stringify(semEmpresa));
  const idx = await sql(`select indexname from pg_indexes where schemaname='public' and tablename like 'wa\\_%'`);
  checa('indices criados', idx.length >= 12, `${idx.length} indices`);
  const grants = await sql(`
    select table_name, privilege_type from information_schema.role_table_grants
     where grantee='anon' and table_name like 'wa\\_%'`);
  checa('anon nao tem privilegio nenhum nas cinco', grants.length === 0, JSON.stringify(grants).slice(0, 90));

} catch (e) {
  console.error('\nERRO:', e.message);
  falhas.push('excecao: ' + e.message);
} finally {
  // Engolir a falha de limpeza foi o que deixou 9 empresas de bancada no staging sem
  // ninguem ver. Uma bancada que nao consegue limpar o proprio rastro esta mentindo:
  // agora ela REPROVA e diz qual passo falhou.
  for (const f of lixo.reverse()) {
    try { await f(); }
    catch (e) { falhas.push('limpeza: ' + (e instanceof Error ? e.message : String(e))); }
  }
  console.log('\ndados de teste removidos.');
}

console.log(`\n${ok} verificacoes ok, ${falhas.length} falhas.`);
if (falhas.length) { falhas.forEach(f => console.log('  · ' + f)); process.exitCode = 1; }
