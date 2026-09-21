// Studio — uma aba por marca. Bancada no STAGING, com JWT real de admin e de usuário comum.
//
// Prova o que a migration 20260921100000 promete:
//   • as marcas novas nascem (Tropeiro, Serrão, Café do Amor na Saporino; Coffee LiVRE na COFICO)
//     com guardrails e na ordem das abas;
//   • o Tropeiro Tradicional deixa de ser "produto futuro" na Saporino (Extra Forte continua);
//   • conexão é por MARCA: duas marcas da mesma empresa têm Instagram próprio, e a mesma marca
//     não ganha duas conexões da mesma rede;
//   • campanha guarda a marca e o publicador acha a conta pela marca (studio_marca_principal
//     como reserva para campanha antiga);
//   • a lista de abas que a tela lê (perfil + empresa) sai para o admin e não sai para usuário comum.
//
// O staging não tem as empresas reais: a bancada cria Saporino/COFICO de teste, roda o bloco
// de marcas da migration e apaga tudo no fim.
//   node scripts/studio-marcas-bancada.mjs

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, confirmarNoBanco, anunciar } from './_ambiente.mjs';

const ambiente = escolherAmbiente({ destrutivo: true });
const env = ambiente.env;
anunciar(ambiente);
const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, semSessao);
await confirmarNoBanco(admin, ambiente, { destrutivo: true });

const MARCA = 'teste-studio-marcas';
let falhas = 0, criterios = 0;
const checar = (t, c, d = '') => { criterios++; if (c) console.log('  ok  ' + t); else { falhas++; console.log(`  !!  ${t} ${d}`); } };
const secao = t => console.log(`\n=== ${t} ===`);

const MIGRATION = path.resolve(import.meta.dirname, '../supabase/migrations/20260921100000_studio_marca_por_aba.sql');
const texto = fs.readFileSync(MIGRATION, 'utf8');
const blocoDasMarcas = texto.slice(texto.indexOf('do $$'), texto.indexOf('end $$;') + 'end $$;'.length);

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

let empresas = [];
async function limpar() {
  const { data } = await admin.from('companies').select('id').in('name', ['Café Saporino Ltda', 'V. Medeiros de Santi Ltda']);
  const ids = (data ?? []).map(c => c.id);
  if (ids.length) {
    await admin.from('studio_campaigns').delete().in('company_id', ids);
    await admin.from('studio_social_connections').delete().in('company_id', ids);
    await admin.from('studio_brand_profiles').delete().in('company_id', ids);
    await admin.from('studio_organizations').delete().in('company_id', ids);
    await admin.from('companies').delete().in('id', ids);
  }
  for (let p = 1; p <= 20; p++) {
    const { data: u } = await admin.auth.admin.listUsers({ page: p, perPage: 200 });
    for (const x of (u?.users ?? []).filter(x => x.email?.startsWith(MARCA))) await admin.auth.admin.deleteUser(x.id);
    if (!u?.users || u.users.length < 200) break;
  }
}

const marcas = async () => (await admin.from('studio_brand_profiles').select('*').in('company_id', empresas.map(e => e.id)).order('ordem')).data ?? [];

try {
  secao('PREPARANDO');
  await limpar();
  const { data: emp, error: eEmp } = await admin.from('companies').insert([
    { name: 'Café Saporino Ltda', fantasia: 'CAFE SAPORINO', is_active: true, studio_enabled: true, is_operator: false, sort_order: 1 },
    { name: 'V. Medeiros de Santi Ltda', fantasia: 'COFICO BRASIL', is_active: true, studio_enabled: true, is_operator: true, sort_order: 2 },
  ]).select('id, name');
  if (eEmp) throw new Error('empresas: ' + eEmp.message);
  empresas = emp;
  const [sap, cof] = [emp.find(e => e.name.startsWith('Café')), emp.find(e => e.name.startsWith('V.'))];
  const { data: orgs, error: eOrg } = await admin.from('studio_organizations').insert([
    { name: `Saporino ${MARCA}`, slug: `${MARCA}-sap`, company_id: sap.id, plan: 'interno', status: 'ativa' },
    { name: `COFICO ${MARCA}`, slug: `${MARCA}-cof`, company_id: cof.id, plan: 'interno', status: 'ativa' },
  ]).select('id, company_id');
  if (eOrg) throw new Error('organizações: ' + eOrg.message);
  const orgDe = id => orgs.find(o => o.company_id === id).id;
  const { error: eBr } = await admin.from('studio_brand_profiles').insert([
    { company_id: sap.id, organization_id: orgDe(sap.id), name: 'Café Saporino', is_primary: true, guardrails: {
      future_products: [{ name: 'Tropeiro Paulista Tradicional', usable_in_content: false }, { name: 'Tropeiro Paulista Extra Forte', usable_in_content: false }, { name: 'Cafe Serrao', usable_in_content: false }] } },
    { company_id: cof.id, organization_id: orgDe(cof.id), name: 'COFICO Brasil', is_primary: true, guardrails: {} },
  ]);
  if (eBr) throw new Error('marcas principais: ' + eBr.message);
  const adm = await usuario('admin', true);
  const comum = await usuario('comum', false);
  checar('empresas, organizações, marcas principais e usuários de teste', !!adm.id && !!comum.id);

  secao('MARCAS NOVAS (bloco da migration)');
  const { error: eMig } = await admin.rpc('exec_migration', { q: blocoDasMarcas });
  checar('bloco de marcas roda sem erro', !eMig, eMig?.message);
  const { error: eMig2 } = await admin.rpc('exec_migration', { q: blocoDasMarcas });
  checar('rodar de novo não duplica nada (idempotente)', !eMig2 && (await marcas()).length === 6, eMig2?.message);
  const lista = await marcas();
  checar('abas na ordem: Saporino, Tropeiro, Serrão, Café do Amor, COFICO, Coffee LiVRE',
    lista.map(m => m.name).join('|') === 'Café Saporino|Café Tropeiro Paulista|Café Serrão|Café do Amor|COFICO Brasil|Coffee LiVRE', lista.map(m => m.name).join('|'));
  const por = n => lista.find(m => m.name === n);
  const tropeiro = por('Café Tropeiro Paulista'), serrao = por('Café Serrão'), livre = por('Coffee LiVRE'), saporino = por('Café Saporino'), cofico = por('COFICO Brasil');
  checar('submarcas na Saporino, Coffee LiVRE na COFICO, só as principais são is_primary',
    [tropeiro, serrao, por('Café do Amor')].every(m => m.company_id === sap.id && !m.is_primary) && livre.company_id === cof.id && !livre.is_primary && saporino.is_primary && cofico.is_primary);
  checar('marcas novas herdam a organização da empresa', [tropeiro, serrao, livre].every(m => m.organization_id === orgDe(m.company_id)));
  const gT = tropeiro.guardrails;
  checar('Tropeiro: claims do cadastro (100% Arábica, 500 g, torra média-escura) e Extra Forte como futuro',
    JSON.stringify(gT.approved_product_claims).includes('100% Arábica') && JSON.stringify(gT.approved_product_claims).includes('Torra média-escura')
      && gT.future_products?.[0]?.name === 'Café Tropeiro Paulista Extra Forte' && gT.brand_identity?.instagram === '@cafetropeiropaulista');
  checar('Tropeiro: divergência de torra (bio x cadastro) marcada para aprovação manual',
    (gT.requires_manual_approval ?? []).some(t => t.includes('média-escura')));
  checar('Serrão: sem claim de produto até ter ficha técnica',
    Object.keys(serrao.guardrails.approved_product_claims ?? {}).length === 0 && serrao.guardrails.brand_identity?.instagram === '@cafe.serrao');
  checar('Coffee LiVRE: sai na própria conta e na COFICO',
    JSON.stringify(livre.guardrails.publishing_rules?.allowed_accounts) === JSON.stringify(['@coffeelivre', '@coficobrasil']));
  const gS = saporino.guardrails;
  checar('Saporino: Tropeiro Tradicional e Serrão saem de "futuro"; Extra Forte continua',
    (gS.future_products ?? []).map(f => f.name).join('|') === 'Tropeiro Paulista Extra Forte', JSON.stringify(gS.future_products));
  checar('Saporino: submarcas registradas, Tropeiro Tradicional liberado na conta dela por escolha',
    gS.sub_brands?.approved_in_saporino_account?.[0] === 'Café Tropeiro Paulista Tradicional' && gS.sub_brands?.brands?.length === 3);

  secao('CONEXÕES POR MARCA');
  const c1 = await adm.cliente.from('studio_social_connections').upsert({ brand_id: saporino.id, company_id: sap.id, platform: 'instagram', account_name: '@cafesaporino-teste', status: 'connected', access_token: 'x' }, { onConflict: 'brand_id,platform' });
  const c2 = await adm.cliente.from('studio_social_connections').upsert({ brand_id: tropeiro.id, company_id: sap.id, platform: 'instagram', account_name: '@tropeiro-teste', status: 'connected', access_token: 'y' }, { onConflict: 'brand_id,platform' });
  checar('Saporino e Tropeiro (mesma empresa) têm cada uma o seu Instagram', !c1.error && !c2.error, c1.error?.message || c2.error?.message);
  const c3 = await adm.cliente.from('studio_social_connections').upsert({ brand_id: tropeiro.id, company_id: sap.id, platform: 'instagram', account_name: '@tropeiro-novo', status: 'connected', access_token: 'z' }, { onConflict: 'brand_id,platform' });
  const { data: ct } = await admin.from('studio_social_connections').select('account_name').eq('brand_id', tropeiro.id);
  checar('reconectar a mesma marca troca a conta, sem duplicar', !c3.error && ct.length === 1 && ct[0].account_name === '@tropeiro-novo', c3.error?.message);
  const c4 = await admin.from('studio_social_connections').insert({ brand_id: tropeiro.id, company_id: sap.id, platform: 'instagram', status: 'connected' });
  checar('banco recusa 2ª conexão da mesma rede para a mesma marca', !!c4.error);

  secao('CAMPANHA LEVA A MARCA DA CONTA');
  const { data: camp, error: eC } = await adm.cliente.from('studio_campaigns').insert([
    { title: `${MARCA} tropeiro`, platform: 'instagram', status: 'draft', company_id: sap.id, brand_id: tropeiro.id, content: 'x' },
    { title: `${MARCA} cofico`, platform: 'instagram', status: 'draft', company_id: cof.id, brand_id: cofico.id, content: 'x' },
  ]).select('id, brand_id');
  checar('uma campanha por conta de destino, cada uma com a sua marca', !eC && camp.length === 2 && new Set(camp.map(c => c.brand_id)).size === 2, eC?.message);
  const { data: vistaTropeiro } = await adm.cliente.from('studio_campaigns').select('id').eq('brand_id', tropeiro.id);
  checar('aba Tropeiro lista só a campanha dela', vistaTropeiro?.length === 1);
  const { data: principal } = await admin.rpc('studio_marca_principal', { p_company: sap.id });
  checar('campanha antiga sem marca publica na principal da empresa (nunca numa submarca)', principal === saporino.id);
  const { data: conn } = await admin.from('studio_social_connections').select('account_name').eq('brand_id', camp.find(c => c.brand_id === tropeiro.id).brand_id).eq('platform', 'instagram').maybeSingle();
  checar('publicador acha a conta do Tropeiro pela marca da campanha', conn?.account_name === '@tropeiro-novo');

  secao('A LISTA DE ABAS (o que a tela lê)');
  const consulta = c => c.from('studio_brand_profiles')
    .select('id, name, company_id, is_primary, ordem, logo_url, ativa_no_studio, companies!inner(is_active, studio_enabled, is_operator, logo_url, sort_order)')
    .eq('ativa_no_studio', true).eq('companies.is_active', true).eq('companies.studio_enabled', true).in('company_id', empresas.map(e => e.id));
  const { data: abasAdmin, error: eAbas } = await consulta(adm.cliente);
  checar('admin vê as 6 abas com a empresa junto', !eAbas && abasAdmin?.length === 6 && abasAdmin.every(a => a.companies), eAbas?.message);
  checar('COFICO marcada como operadora (conta que aceita todas as marcas)', abasAdmin?.find(a => a.name === 'COFICO Brasil')?.companies?.is_operator === true);
  const { data: abasComum } = await consulta(comum.cliente);
  checar('usuário comum não vê marca nenhuma', (abasComum ?? []).length === 0);
  const { data: connComum } = await comum.cliente.from('studio_social_connections').select('id').in('company_id', empresas.map(e => e.id));
  checar('usuário comum não vê conexões (tokens)', (connComum ?? []).length === 0);
  await admin.from('studio_brand_profiles').update({ ativa_no_studio: false }).eq('id', serrao.id);
  const { data: semSerrao } = await consulta(adm.cliente);
  checar('marca desligada (ativa_no_studio=false) some das abas', semSerrao?.length === 5 && !semSerrao.some(a => a.id === serrao.id));
} catch (e) {
  falhas++;
  console.log('\n  !!  erro inesperado: ' + e.message);
} finally {
  secao('LIMPANDO');
  await limpar();
  console.log('  dados de teste apagados');
}

console.log(`\n${criterios - falhas}/${criterios} critérios${falhas ? ` — ${falhas} FALHA(S)` : ' — tudo certo'}`);
process.exit(falhas ? 1 : 0);
