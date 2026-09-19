// B2B Prospecção — carga inicial com o que já existe no banco, cruzado por CNPJ.
//
// Ordem (a primeira fonte dá a base; as seguintes só completam o vazio):
//   1. Receita (prospects_b2b, SP): ativas da cadeia do café + supermercados/hiper + atacado de alimentos
//   2. Google/Apify (prospect_leads)
//   3. Formulário "Para Seu Negócio" (b2b_leads)
//   4. Clientes do RepCo (representative_clients) → também viram vínculo ATIVO com a empresa do grupo + contato do comprador
//
// Idempotente: rodar de novo não duplica (b2b_mesclar junta por CNPJ / nome+cidade).
//   node scripts/b2b-carga-inicial.mjs                        staging
//   COFFEELIVRE_CONFIRMO_PRODUCAO=rsvoazrkxtdrcjnatzcm node scripts/b2b-carga-inicial.mjs --producao

import { createClient } from '@supabase/supabase-js';
import { escolherAmbiente, confirmarNoBanco, anunciar } from './_ambiente.mjs';
import { normalizarLinha, normalizarTelefone } from '../src/lib/b2b/normalizar.ts';

const ambiente = escolherAmbiente({ destrutivo: false });
anunciar(ambiente);
const db = createClient(ambiente.env.VITE_SUPABASE_URL, ambiente.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
await confirmarNoBanco(db, ambiente, { destrutivo: false });

const CNAES = ['1081301', '1081302', '1082100', '0134200', '4621400', '4637101', '4639701', '4711301', '4711302'];
const LOTE = 400;
const soma = { novas: 0, completadas: 0, iguais: 0, invalidas: 0 };

async function mesclar(fonte, linhas) {
  const r = { novas: 0, completadas: 0, iguais: 0, invalidas: 0 };
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { data, error } = await db.rpc('b2b_mesclar', { p_fonte: fonte, p_linhas: linhas.slice(i, i + LOTE), p_arquivo: 'carga inicial' });
    if (error) throw new Error(`${fonte}, lote ${i / LOTE + 1}: ${error.message}`);
    for (const k of Object.keys(r)) { r[k] += data[k]; soma[k] += data[k]; }
  }
  console.log(`${fonte.padEnd(28)} linhas ${String(linhas.length).padStart(6)} · novas ${r.novas} · completadas ${r.completadas} · iguais ${r.iguais} · inválidas ${r.invalidas}`);
}

const validas = brutas => brutas.map(b => normalizarLinha(b)).filter(n => n.valida).map(n => n.linha);

// 1. Receita (SP)
{
  const brutas = [];
  const COLS = 'cnpj, razao_social, nome_fantasia, cnae_principal, cnae_descricao, situacao_cadastral, data_inicio_atividade, tipo_logradouro, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone, email';
  // Sem ORDER BY: com ordenação o planejador troca o índice de CNAE pela varredura da tabela (759 mil)
  // e estoura o tempo. Em vez de paginar, lê fatias pelo início do CNPJ, pequenas o bastante (< 1000).
  async function fatia(cnae, prefixo) {
    const { data, error } = await db.from('prospects_b2b').select(COLS)
      .eq('cnae_principal', cnae).eq('situacao_cadastral', '02').like('cnpj', `${prefixo}%`).limit(1000);
    if (error) throw new Error(`prospects_b2b (${cnae}, ${prefixo}): ` + error.message);
    if (data.length === 1000) {
      const partes = [];
      for (let d = 0; d <= 9; d++) partes.push(...await fatia(cnae, `${prefixo}${d}`));
      return partes;
    }
    return data;
  }
  for (const cnae of CNAES) {
    const data = [];
    for (let p = 0; p <= 99; p++) data.push(...await fatia(cnae, String(p).padStart(2, '0')));
    for (const p of data) brutas.push({
      cnpj: p.cnpj, razao_social: p.razao_social, nome_fantasia: p.nome_fantasia, cnae_principal: p.cnae_principal,
      cnae_descricao: p.cnae_descricao, situacao_cadastral: p.situacao_cadastral, data_abertura: p.data_inicio_atividade,
      logradouro: [p.tipo_logradouro, p.logradouro].filter(Boolean).join(' '), numero: p.numero, complemento: p.complemento,
      bairro: p.bairro, municipio: p.municipio, uf: p.uf, cep: p.cep, telefone: p.telefone, email: p.email,
    });
    process.stdout.write(`\rReceita: ${brutas.length} lidas…`);
  }
  process.stdout.write('\n');
  await mesclar('Receita Federal (SP)', validas(brutas));
}

// 2. Google / Apify
{
  const { data, error } = await db.from('prospect_leads')
    .select('company_name, trade_name, cnpj, rf_cnpj, segment, category, address, number, complement, district, city, state, zip_code, lat, lng, phone, whatsapp, email, website');
  if (error) throw new Error('prospect_leads: ' + error.message);
  await mesclar('Google (Apify)', validas(data.map(p => ({
    cnpj: p.cnpj ?? p.rf_cnpj, razao_social: p.company_name, nome_fantasia: p.trade_name ?? p.company_name,
    tipo: p.category || p.segment, logradouro: p.address, numero: p.number, complemento: p.complement, bairro: p.district,
    municipio: p.city, uf: p.state, cep: p.zip_code, telefone: p.phone, whatsapp: p.whatsapp, email: p.email, site: p.website,
  }))));
}

// 3. Formulário do site
{
  const { data, error } = await db.from('b2b_leads').select('nome, empresa, telefone, email, site, redes_sociais, cidade, uf, descricao');
  if (error) throw new Error('b2b_leads: ' + error.message);
  await mesclar('Formulário do site', validas(data.map(l => ({
    razao_social: l.empresa ?? l.nome, nome_fantasia: l.empresa, municipio: l.cidade, uf: l.uf, telefone: l.telefone,
    email: l.email, site: l.site, instagram: l.redes_sociais, notas: l.descricao ? `Formulário do site: ${l.descricao}` : null,
  }))));
}

// 4. Clientes do RepCo → ficha + vínculo ativo + contato do comprador
{
  const { data, error } = await db.from('representative_clients')
    .select('id, cnpj, razao_social, nome_fantasia, inscricao_estadual, municipio, uf, cep, email_comprador, nome_comprador, whatsapp_comprador, company_id, status, is_active_client, segment');
  if (error) throw new Error('representative_clients: ' + error.message);
  const comCnpj = data.filter(c => c.cnpj);
  await mesclar('Clientes RepCo', validas(comCnpj.map(c => ({
    cnpj: c.cnpj, razao_social: c.razao_social, nome_fantasia: c.nome_fantasia, inscricao_estadual: c.inscricao_estadual,
    municipio: c.municipio, uf: c.uf, cep: c.cep, email: c.email_comprador, whatsapp: c.whatsapp_comprador, tipo: c.segment,
  }))));
  let vinculos = 0, contatos = 0;
  for (const c of comCnpj) {
    const cnpj = normalizarLinha({ cnpj: c.cnpj }).linha.cnpj;
    if (!cnpj) continue;
    const { data: e } = await db.from('b2b_empresas').select('id').eq('cnpj', cnpj).maybeSingle();
    if (!e) continue;
    const ativo = c.is_active_client !== false && c.status !== 'inactive';
    const { error: ev } = await db.from('b2b_vinculos').upsert({
      empresa_id: e.id, destino: 'cliente_empresa', company_id: c.company_id, representative_client_id: c.id,
      etapa: ativo ? 'ativo' : 'inativo',
    }, { onConflict: 'empresa_id,destino,company_id', ignoreDuplicates: true });
    if (!ev) vinculos++;
    if (c.nome_comprador || c.email_comprador || c.whatsapp_comprador) {
      const { count } = await db.from('b2b_contatos').select('id', { count: 'exact', head: true }).eq('empresa_id', e.id).eq('funcao', 'comprador');
      if (!count) {
        const tel = normalizarTelefone(c.whatsapp_comprador);
        await db.from('b2b_contatos').insert({ empresa_id: e.id, funcao: 'comprador', nome: c.nome_comprador, email: c.email_comprador, telefone: tel, whatsapp: tel });
        contatos++;
      }
    }
  }
  console.log(`vínculos de cliente ativos/inativos: ${vinculos} · contatos de comprador: ${contatos} · clientes sem CNPJ ignorados: ${data.length - comCnpj.length}`);
}

const { count: total } = await db.from('b2b_empresas').select('id', { count: 'exact', head: true });
const { count: ativos } = await db.from('b2b_empresas').select('id', { count: 'exact', head: true }).eq('ativo', true);
console.log(`\nTotal: novas ${soma.novas} · completadas ${soma.completadas} · iguais ${soma.iguais} · inválidas ${soma.invalidas}`);
console.log(`B2B Prospecção agora tem ${total} empresas (${ativos} ativas).`);
