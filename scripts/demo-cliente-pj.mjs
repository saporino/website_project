// Convite de DEMONSTRACAO do portal do cliente PJ, em producao.
//
//   node scripts/demo-cliente-pj.mjs            cria o convite DEMO01
//   node scripts/demo-cliente-pj.mjs limpar     apaga a conta e o convite
//
// Nao cria ficha nem senha: quem faz o cadastro e o proprio Vlademir, pelo
// fluxo publicado. A senha nunca passa por aqui.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env={}; for(const l of readFileSync('.env','utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/); if(m)env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'');}
const db=createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const EMAIL='demo.cliente@coficobrasil.com.br';
const CODIGO='DEMO01';

if (process.argv[2]==='limpar') {
  const {data:us}=await db.auth.admin.listUsers({perPage:1000});
  for(const u of us.users.filter(x=>x.email===EMAIL)){
    const {data:f}=await db.from('representative_clients').select('id').eq('user_id',u.id);
    for(const x of (f??[])){ await db.from('cliente_pj_decisoes').delete().eq('cliente_id',x.id); await db.from('cliente_marcas').delete().eq('cliente_id',x.id); }
    await db.from('representative_clients').delete().eq('user_id',u.id);
    await db.from('user_roles').delete().eq('user_id',u.id);
    await db.auth.admin.deleteUser(u.id);
  }
  await db.from('repco_invite_codes').delete().eq('code',CODIGO);
  const {count}=await db.from('representative_clients').select('id',{count:'exact',head:true});
  console.log('demonstracao removida. fichas de cliente: '+count);
  process.exit(0);
}

// 1. O admin dele mistura permissoes?
const {data:us}=await db.auth.admin.listUsers({perPage:1000});
const admins=[]; 
for (const u of us.users) {
  const {data:r}=await db.from('user_roles').select('role_code').eq('user_id',u.id).eq('is_active',true);
  const papeis=(r??[]).map(x=>x.role_code);
  if (papeis.includes('admin')) {
    const {data:f}=await db.from('representative_clients').select('id').eq('user_id',u.id);
    admins.push({email:u.email, papeis, fichaPJ:(f??[]).length});
  }
}
console.log('ADMINS em producao:');
for (const a of admins) console.log(`  ${a.email} · papeis: ${a.papeis.join(', ')} · ficha PJ propria: ${a.fichaPJ}`);

// 2. O convite de demonstracao, pelo gerador que ja existe.
await db.from('repco_invite_codes').delete().eq('code',CODIGO);
const {error}=await db.from('repco_invite_codes').insert({
  code: CODIGO,
  note: `DEMONSTRACAO - cliente de teste <${EMAIL}>`,
  role_code: 'cliente_pj',
  expires_at: new Date(Date.now()+7*864e5).toISOString(),
});
console.log('\n' + (error ? 'ERRO: '+error.message : `convite de demonstracao criado: ${CODIGO} (vale 7 dias, uso unico, preso a ${EMAIL})`));
