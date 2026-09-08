import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
export async function sel(q){const r=await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/exec_select`,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({q})});const t=await r.text();try{return JSON.parse(t)}catch{return t}}
export async function mig(q){const r=await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/exec_migration`,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({q})});return r.status+' '+await r.text()}
if(process.argv[2]) console.log(JSON.stringify(await sel(process.argv[2]),null,1));
