// Aplica uma migration pelo RPC exec_migration.
// Uso: node scripts/aplicar-migration.mjs supabase/migrations/<arquivo>.sql
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(RAIZ, '.env'), 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const arquivo = process.argv[2];
if (!arquivo) { console.error('Informe o caminho da migration.'); process.exit(1); }

const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { error } = await db.rpc('exec_migration', { q: fs.readFileSync(path.join(RAIZ, arquivo), 'utf8') });
console.log(error ? 'ERRO: ' + error.message : 'aplicada: ' + path.basename(arquivo));
if (error) process.exitCode = 1;
