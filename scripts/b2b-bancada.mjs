// B2B Prospecção — bancada no STAGING, com JWT real de admin, de usuário comum e anônimo.
//
// Prova o que a tela promete: uma ficha por CNPJ, fonte nova completa e nunca sobrescreve,
// proveniência por campo, junção de quem vem sem CNPJ pela chave de nome, CNPJ inválido
// recusado, "ativo" pelo vínculo, e nada disso visível para quem não é admin.
//
// Tudo leva a marca `teste-b2b` e é apagado no fim.
//   node scripts/b2b-bancada.mjs

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, confirmarNoBanco, anunciar } from './_ambiente.mjs';
import { normalizarLinha } from '../src/lib/b2b/normalizar.ts';

const ambiente = escolherAmbiente({ destrutivo: true });
const env = ambiente.env;
anunciar(ambiente);
const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, semSessao);
const anonimo = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

const MARCA = 'teste-b2b';
let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };
const secao = t => console.log(`\n=== ${t} ===`);

// CNPJs válidos só de teste (dígitos verificadores corretos).
const CNPJ_A = '11222333000181';
const CNPJ_B = '44555666000139';

async function usuario(rotulo, ehAdmin) {
  const email = `${MARCA}-${rotulo}@coffeelivre.test`;
  const senha = crypto.randomBytes(24).toString('base64url') + 'Aa1!';
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw new Error(`usuário ${rotulo}: ${error.message}`);
  if (ehAdmin) await admin.from('user_profiles').upsert({ id: data.user.id, full_name: `Admin ${MARCA}`, is_admin: true });
  const cliente = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, semSessao);
  const { error: el } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (el) throw new Error(`entrar ${rotulo}: ${el.message}`);
  return { id: data.user.id, cliente };
}

async function limpar() {
  await admin.from('b2b_empresas').delete().or(`cnpj.in.(${CNPJ_A},${CNPJ_B},19131243000197),chave_nome.like.%${MARCA}%,fontes.cs.{${MARCA}-1}`);
  await admin.from('b2b_importacoes').delete().or(`fonte.like.${MARCA}%,fonte.eq.x`);
  for (let p = 1; p <= 20; p++) {
    const { data } = await admin.auth.admin.listUsers({ page: p, perPage: 200 });
    for (const u of (data?.users ?? []).filter(x => x.email?.startsWith(MARCA))) await admin.auth.admin.deleteUser(u.id);
    if (!data?.users || data.users.length < 200) break;
  }
}

const linha = bruta => normalizarLinha(bruta).linha;
const ficha = async cnpj => (await admin.from('b2b_empresas').select('*').eq('cnpj', cnpj).maybeSingle()).data;

try {
  secao('PREPARANDO');
  await limpar();
  const adm = await usuario('admin', true);
  const comum = await usuario('comum', false);
  checar('admin e usuário comum temporários', !!adm.id && !!comum.id);

  secao('MESCLA POR CNPJ');
  const r1 = await adm.cliente.rpc('b2b_mesclar', { p_fonte: `${MARCA}-1`, p_linhas: [
    linha({ cnpj: CNPJ_A, razao_social: 'TORREFACAO TESTE B2B LTDA', nome_fantasia: 'Café Teste', uf: 'SP', municipio: 'Campinas', cnae_principal: '1081302' }),
  ] });
  checar('fonte 1: empresa nova', r1.data?.novas === 1, JSON.stringify(r1));
  let a = await ficha(CNPJ_A);
  checar('ficha criada com tipo pelo CNAE (torrefação) e fonte registrada', a?.tipo === 'torrefacao' && a?.fontes?.includes(`${MARCA}-1`));

  const r2 = await adm.cliente.rpc('b2b_mesclar', { p_fonte: `${MARCA}-2`, p_linhas: [
    linha({ cnpj: '11.222.333/0001-81', nome_fantasia: 'OUTRO NOME QUE NÃO PODE ENTRAR', telefone: '(19) 99999-0000', site: 'teste.com.br', marcas: 'Marca A · Marca B' }),
  ] });
  a = await ficha(CNPJ_A);
  checar('fonte 2 com o mesmo CNPJ (mascarado): completa, não cria outra', r2.data?.completadas === 1 && r2.data?.novas === 0, JSON.stringify(r2));
  checar('nome fantasia existente NÃO foi sobrescrito', a?.nome_fantasia === 'Café Teste', `(veio ${a?.nome_fantasia})`);
  checar('telefone, WhatsApp, site e marcas completados', a?.telefone === '19999990000' && a?.whatsapp === '19999990000'
    && a?.site === 'https://teste.com.br' && a?.marcas?.length === 2);
  checar('proveniência: telefone veio da fonte 2, razão social da fonte 1',
    a?.proveniencia?.telefone?.fonte === `${MARCA}-2` && a?.proveniencia?.razao_social?.fonte === `${MARCA}-1`);
  checar('as duas fontes registradas na ficha', a?.fontes?.length === 2);

  const r3 = await adm.cliente.rpc('b2b_mesclar', { p_fonte: `${MARCA}-2`, p_linhas: [linha({ cnpj: CNPJ_A, telefone: '19999990000' })] });
  checar('repetir a mesma informação não muda nada (iguais)', r3.data?.iguais === 1, JSON.stringify(r3));

  secao('SEM CNPJ E CNPJ INVÁLIDO');
  const r4 = await adm.cliente.rpc('b2b_mesclar', { p_fonte: `${MARCA}-3`, p_linhas: [
    linha({ razao_social: 'Café Teste Ltda', municipio: 'CAMPINAS', uf: 'São Paulo', email: 'compras@teste.com.br' }),
    linha({ cnpj: '11222333000100', razao_social: 'CNPJ errado' }),
  ] });
  a = await ficha(CNPJ_A);
  checar('linha sem CNPJ, mesmo nome e cidade: completa a ficha existente', r4.data?.completadas === 1 && a?.email === 'compras@teste.com.br', JSON.stringify(r4));
  checar('CNPJ com dígito errado é recusado (inválida), sem criar ficha', r4.data?.invalidas === 1);

  secao('ATIVO PELO VÍNCULO');
  // Destino sem empresa do grupo: o staging não tem a tabela companies populada.
  const { data: v, error: ev } = await adm.cliente.from('b2b_vinculos').insert({ empresa_id: a.id, destino: 'coffeelivre_comprador', etapa: 'ativo' }).select('id').single();
  a = await ficha(CNPJ_A);
  checar('vínculo ativo: empresa vai para Ativos', !ev && a?.ativo === true, ev?.message ?? '');
  await adm.cliente.from('b2b_vinculos').update({ etapa: 'inativo' }).eq('id', v.id);
  a = await ficha(CNPJ_A);
  checar('vínculo inativo: empresa volta para Não ativos, e continua no B2B', a?.ativo === false && !!a?.id);
  const dup = await adm.cliente.from('b2b_vinculos').insert({ empresa_id: a.id, destino: 'coffeelivre_comprador' });
  checar('o mesmo vínculo não duplica', !!dup.error);
  const { error: ec } = await adm.cliente.from('b2b_contatos').insert({ empresa_id: a.id, funcao: 'comprador', nome: 'Compras Teste', email: 'c@teste.com.br' });
  checar('contato com função cadastrado', !ec, ec?.message ?? '');

  secao('CONTAGEM POR UF');
  await adm.cliente.rpc('b2b_mesclar', { p_fonte: `${MARCA}-1`, p_linhas: [linha({ cnpj: CNPJ_B, razao_social: `OUTRA ${MARCA} SA`, uf: 'SP', municipio: 'Santos' })] });
  const { data: cont } = await adm.cliente.rpc('b2b_contagem', { p_busca: 'Café Teste' });
  const sp = Number(cont?.find(c => c.uf === 'SP')?.n ?? 0);
  checar('contagem por estado com busca de texto conta só quem casa (não todo CNPJ)', sp === 1, JSON.stringify(cont));

  secao('IMPORTAÇÃO POR ARQUIVO');
  const { data: imp, error: eimp } = await adm.cliente.rpc('b2b_importacao_iniciar', {
    p_fonte: `${MARCA}-arquivo`, p_arquivo: `${MARCA}.csv`, p_hash: 'abc123', p_tamanho: 1234, p_linhas: 2,
  });
  checar('importação aberta para o arquivo', !eimp && !!imp, eimp?.message ?? '');
  await adm.cliente.rpc('b2b_mesclar', { p_fonte: `${MARCA}-arquivo`, p_linhas: [linha({ cnpj: CNPJ_A, instagram: '@cafeteste' })], p_importacao: imp });
  await adm.cliente.rpc('b2b_mesclar', { p_fonte: `${MARCA}-arquivo`, p_linhas: [linha({ cnpj: CNPJ_A, bairro: 'Centro' })], p_importacao: imp });
  await adm.cliente.rpc('b2b_importacao_concluir', { p_importacao: imp });
  const { data: regs } = await admin.from('b2b_importacoes').select('*').eq('arquivo_hash', 'abc123');
  checar('dois lotes somam numa única linha de importação, com impressão digital e data de conclusão',
    regs?.length === 1 && regs[0].completadas === 2 && !!regs[0].concluida_em && regs[0].arquivo === `${MARCA}.csv`, JSON.stringify(regs));

  secao('DIVERGÊNCIAS');
  a = await ficha(CNPJ_A);
  const { data: anteriores } = await admin.from('b2b_divergencias').select('campo, valor_novo').eq('empresa_id', a.id).eq('status', 'aberta');
  checar('o nome fantasia diferente da fonte 2 já tinha ficado registrado como divergência',
    anteriores?.some(d => d.campo === 'nome_fantasia' && d.valor_novo.includes('OUTRO NOME')), JSON.stringify(anteriores));
  const antes = a.divergencias_abertas;
  const d1 = await adm.cliente.rpc('b2b_mesclar', { p_fonte: `${MARCA}-abic`, p_linhas: [linha({ cnpj: CNPJ_A, telefone: '(19) 3333-4444', email: 'outro@teste.com.br', razao_social: 'Torrefação Teste B2B Ltda.' })] });
  a = await ficha(CNPJ_A);
  checar('valor diferente não sobrescreve e vira divergência (telefone e e-mail)',
    d1.data?.divergencias === 2 && a?.telefone === '19999990000' && a?.email === 'compras@teste.com.br' && a?.divergencias_abertas === antes + 2,
    JSON.stringify({ r: d1.data, telefone: a?.telefone, email: a?.email, abertas: a?.divergencias_abertas }));
  checar('mesma razão social escrita de outro jeito (acento, ponto, caixa) não é divergência', d1.data?.divergencias === 2);
  const d2 = await adm.cliente.rpc('b2b_mesclar', { p_fonte: `${MARCA}-abic`, p_linhas: [linha({ cnpj: CNPJ_A, telefone: '(19) 3333-4444' })] });
  checar('a mesma divergência não se repete', d2.data?.divergencias === 0);
  const { data: divs } = await adm.cliente.from('b2b_divergencias').select('id, campo').eq('empresa_id', a.id).eq('status', 'aberta');
  const divTel = divs.find(d => d.campo === 'telefone');
  const divEmail = divs.find(d => d.campo === 'email');
  const lidoDivComum = await comum.cliente.from('b2b_divergencias').select('id').eq('empresa_id', a.id);
  checar('usuário comum não enxerga divergências', (lidoDivComum.data ?? []).length === 0);
  const resolveComum = await comum.cliente.rpc('b2b_divergencia_resolver', { p_divergencia: divTel.id, p_acao: 'trocar' });
  checar('usuário comum não resolve divergência', !!resolveComum.error);
  await adm.cliente.rpc('b2b_divergencia_resolver', { p_divergencia: divTel.id, p_acao: 'virou_contato' });
  const { data: contatoNovo } = await admin.from('b2b_contatos').select('telefone, observacao').eq('empresa_id', a.id).eq('telefone', '1933334444');
  a = await ficha(CNPJ_A);
  checar('"guardar os dois": telefone novo virou contato, o da ficha ficou', contatoNovo?.length === 1 && a.telefone === '19999990000');
  await adm.cliente.rpc('b2b_divergencia_resolver', { p_divergencia: divEmail.id, p_acao: 'trocar' });
  a = await ficha(CNPJ_A);
  checar('"usar o novo": e-mail trocado, com a fonte registrada, e sem divergência aberta',
    a.email === 'outro@teste.com.br' && a.proveniencia?.email?.fonte === `${MARCA}-abic` && a.divergencias_abertas === antes,
    JSON.stringify({ email: a.email, prov: a.proveniencia?.email, abertas: a.divergencias_abertas }));
  const repetir = await adm.cliente.rpc('b2b_divergencia_resolver', { p_divergencia: divEmail.id, p_acao: 'mantido' });
  checar('divergência já resolvida não é resolvida de novo', !!repetir.error);

  secao('ACESSO');
  const lidoComum = await comum.cliente.from('b2b_empresas').select('id').eq('cnpj', CNPJ_A);
  checar('usuário comum não enxerga nenhuma ficha', (lidoComum.data ?? []).length === 0);
  const CNPJ_C = '19131243000197';
  const mescComum = await comum.cliente.rpc('b2b_mesclar', { p_fonte: `${MARCA}-x`, p_linhas: [linha({ cnpj: CNPJ_C, razao_social: 'X', uf: 'SP', municipio: 'X' })] });
  checar('usuário comum não consegue importar', !!mescComum.error && !(await ficha(CNPJ_C)));
  const insComum = await comum.cliente.from('b2b_empresas').insert({ cnpj: CNPJ_C, razao_social: 'X' });
  checar('usuário comum não consegue inserir', !!insComum.error && !(await ficha(CNPJ_C)));
  const impComum = await comum.cliente.rpc('b2b_importacao_iniciar', { p_fonte: 'x', p_arquivo: 'x', p_hash: 'x', p_tamanho: 1, p_linhas: 1 });
  checar('usuário comum não abre importação', !!impComum.error);
  const lidoAnon = await anonimo.from('b2b_empresas').select('id').limit(1);
  checar('anônimo não enxerga nada', !!lidoAnon.error || (lidoAnon.data ?? []).length === 0);
  const contatosComum = await comum.cliente.from('b2b_contatos').select('id');
  checar('usuário comum não enxerga contatos', (contatosComum.data ?? []).length === 0);
} catch (e) {
  falhas++;
  console.log('  !!  bancada interrompida: ' + (e instanceof Error ? e.message : e));
} finally {
  secao('LIMPEZA');
  await limpar();
  const sobra = await ficha(CNPJ_A);
  checar('fichas, importações e usuários de teste removidos', !sobra);
  console.log(`\n${criterios} critérios · ${falhas ? `${falhas} FALHARAM` : 'TODOS OS CRITÉRIOS PASSARAM'}`);
  process.exit(falhas ? 1 : 0);
}
