// Coffee LiVRE — convite de uso único que vira conta própria.
//
// acao (admin, com JWT de admin):
//   "criar"     { nome, empresa?, email, dias }  gera código, envia por e-mail, devolve o código uma vez
//   "reenviar"  { convite_id }                    código NOVO para o mesmo convite (o anterior morre)
// acao (pública):
//   "perdi"     { email }         se houver convite pendente para o e-mail, manda um código NOVO.
//                                 Resposta sempre igual: não revela quem foi convidado.
//   "validar"   { codigo }        diz se o código serve (e devolve nome/empresa/e-mail do convite)
//   "cadastrar" { codigo, senha, nome, empresa?, telefone?, cargo? }  cria a conta com o e-mail
//                                 do convite e consome o código
//   "vincular"  { codigo }        (logado) quem já tinha conta com o e-mail do convite usa o código
//
// O código nunca é gravado: só o hash (igual a public.lv_normalizar_codigo).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { identidade } from '../_shared/brandEmail.ts';
import { VALIDADES_DIAS, emailDoConvite, emailValido, gerarCodigo, hashDoCodigo } from '../_shared/lvConvite.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const SITE_PADRAO = 'https://www.coficobrasil.com.br';

function servico(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
}

async function usuarioDaRequisicao(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const cli = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data } = await cli.auth.getUser();
  if (!data.user) return null;
  const { data: adm } = await cli.rpc('is_admin');
  return { user: data.user, admin: adm === true };
}

/** Site para o botão do e-mail: o domínio de onde veio o pedido, se for nosso; senão o da COFICO. */
function siteDe(req: Request): string {
  const o = req.headers.get('origin') ?? '';
  return /^https:\/\/(www\.)?coficobrasil\.com\.br$/i.test(o) || /^http:\/\/localhost(:\d+)?$/i.test(o) ? o : SITE_PADRAO;
}

async function enviarEmail(para: string, assunto: string, html: string): Promise<string | null> {
  const chave = Deno.env.get('RESEND_API_KEY');
  if (!chave) return 'RESEND_API_KEY ausente';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: identidade('CO').remetente, to: [para], subject: assunto, html }),
  });
  return r.ok ? null : `Resend ${r.status}`;
}

/** Novo código para um convite (novo ou substituindo o anterior) + e-mail. Devolve o código. */
async function emitir(db: SupabaseClient, req: Request, dados: { nome: string; empresa: string | null; email: string; dias: number; criadoPor: string | null; substitui?: string | null }) {
  const codigo = gerarCodigo();
  const expira = new Date(Date.now() + dados.dias * 86400000).toISOString();
  // Um convite pendente por e-mail: o anterior (se houver) é substituído.
  const { data: anteriores } = await db.from('lv_convites').select('id').eq('email', dados.email).eq('status', 'pendente');
  const { data: novo, error } = await db.from('lv_convites').insert({
    nome: dados.nome, empresa: dados.empresa, email: dados.email, code_hash: await hashDoCodigo(codigo),
    expires_at: expira, created_by: dados.criadoPor,
  }).select('id').single();
  if (error) throw new Error('Não foi possível criar o convite: ' + error.message);
  if (anteriores?.length) {
    await db.from('lv_convites').update({ status: 'substituido', substituido_por: novo.id }).in('id', anteriores.map(a => a.id));
  }
  const email = emailDoConvite(identidade('CO'), {
    nome: dados.nome, codigo, link: `${siteDe(req)}/coffeelivre`, expiraEm: expira, reenvio: !!anteriores?.length,
  });
  const erroEnvio = await enviarEmail(dados.email, email.assunto, email.html);
  await db.from('lv_convites').update({
    enviado_em: erroEnvio ? null : new Date().toISOString(), envios: erroEnvio ? 0 : 1, envio_erro: erroEnvio,
  }).eq('id', novo.id);
  return { id: novo.id, codigo, expira, enviado: !erroEnvio, erro_envio: erroEnvio };
}

/** Convite pendente e dentro da validade para este código. */
async function conviteDoCodigo(db: SupabaseClient, codigo: string) {
  if (!codigo || codigo.trim().length < 6) return { convite: null, motivo: 'invalido' as const };
  const { data } = await db.from('lv_convites').select('*').eq('code_hash', await hashDoCodigo(codigo)).maybeSingle();
  if (!data) return { convite: null, motivo: 'invalido' as const };
  if (data.status === 'usado') return { convite: null, motivo: 'usado' as const };
  if (data.status !== 'pendente') return { convite: null, motivo: 'invalido' as const };
  if (new Date(data.expires_at) < new Date()) return { convite: null, motivo: 'expirado' as const };
  return { convite: data, motivo: null };
}

async function consumir(db: SupabaseClient, conviteId: string, userId: string, perfil: { nome: string; empresa: string | null; email: string; telefone: string | null; cargo: string | null }) {
  // Consome só se ainda estiver pendente: duas abas ao mesmo tempo não usam o mesmo código.
  const { data: ok } = await db.from('lv_convites').update({ status: 'usado', usado_em: new Date().toISOString(), user_id: userId })
    .eq('id', conviteId).eq('status', 'pendente').select('id');
  if (!ok?.length) throw Object.assign(new Error('Este código acabou de ser usado.'), { codigo: 'usado' });
  const { error } = await db.from('lv_convidados').upsert({ user_id: userId, convite_id: conviteId, ...perfil, bloqueado: false });
  if (error) throw new Error('Não foi possível gravar o cadastro: ' + error.message);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const corpo = await req.json().catch(() => ({})) as Record<string, string | number | null>;
    const acao = String(corpo.acao ?? '');
    const db = servico();
    const txt = (k: string, max = 120) => (typeof corpo[k] === 'string' ? (corpo[k] as string).trim().slice(0, max) : '') || null;

    if (acao === 'criar' || acao === 'reenviar') {
      const quem = await usuarioDaRequisicao(req);
      if (!quem?.admin) return json({ erro: 'Sem permissão.' }, 403);
      if (acao === 'reenviar') {
        const { data: c } = await db.from('lv_convites').select('*').eq('id', String(corpo.convite_id ?? '')).maybeSingle();
        if (!c || c.status !== 'pendente') return json({ erro: 'Só convite aguardando cadastro pode ser reenviado.' }, 400);
        const dias = Math.max(1, Math.round((new Date(c.expires_at).getTime() - new Date(c.created_at).getTime()) / 86400000));
        return json(await emitir(db, req, { nome: c.nome, empresa: c.empresa, email: c.email, dias, criadoPor: quem.user.id }));
      }
      const nome = txt('nome'); const email = txt('email', 200)?.toLowerCase() ?? '';
      const dias = Number(corpo.dias);
      if (!nome) return json({ erro: 'Informe o nome de quem vai receber o convite.' }, 400);
      if (!emailValido(email)) return json({ erro: 'Informe um e-mail válido.' }, 400);
      if (!(VALIDADES_DIAS as readonly number[]).includes(dias)) return json({ erro: 'Validade deve ser 1 ou 7 dias.' }, 400);
      return json(await emitir(db, req, { nome, empresa: txt('empresa'), email, dias, criadoPor: quem.user.id }));
    }

    if (acao === 'perdi') {
      const email = txt('email', 200)?.toLowerCase() ?? '';
      const resposta = { ok: true, mensagem: 'Se houver um convite para este e-mail, enviamos um código novo. Confira a caixa de entrada e o spam.' };
      if (!emailValido(email)) return json(resposta);
      const { data: c } = await db.from('lv_convites').select('*').eq('email', email).eq('status', 'pendente')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!c) return json(resposta);
      // Freio contra abuso: no máximo um reenvio a cada 2 minutos por e-mail.
      if (Date.now() - new Date(c.created_at).getTime() < 120000) return json(resposta);
      const dias = Math.max(1, Math.round((new Date(c.expires_at).getTime() - new Date(c.created_at).getTime()) / 86400000));
      await emitir(db, req, { nome: c.nome, empresa: c.empresa, email: c.email, dias, criadoPor: null });
      return json(resposta);
    }

    if (acao === 'validar') {
      const { convite, motivo } = await conviteDoCodigo(db, String(corpo.codigo ?? ''));
      if (!convite) return json({ ok: false, motivo });
      const { data: existe } = await db.rpc('lv_email_tem_conta', { p_email: convite.email });
      return json({ ok: true, nome: convite.nome, empresa: convite.empresa, email: convite.email, ja_tem_conta: existe === true });
    }

    if (acao === 'cadastrar') {
      const { convite, motivo } = await conviteDoCodigo(db, String(corpo.codigo ?? ''));
      if (!convite) return json({ ok: false, motivo }, 400);
      const senha = typeof corpo.senha === 'string' ? corpo.senha : '';
      if (senha.length < 8) return json({ ok: false, motivo: 'senha_curta', erro: 'A senha precisa ter pelo menos 8 caracteres.' }, 400);
      const nome = txt('nome') ?? convite.nome;
      const { data: criado, error } = await db.auth.admin.createUser({
        email: convite.email, password: senha, email_confirm: true, user_metadata: { full_name: nome, origem: 'coffeelivre-convite' },
      });
      if (error || !criado.user) {
        const jaExiste = /already|registered|exists/i.test(error?.message ?? '');
        return json({ ok: false, motivo: jaExiste ? 'email_ja_tem_conta' : 'erro', erro: jaExiste ? 'Este e-mail já tem conta. Entre com a sua senha para usar o convite.' : 'Não foi possível criar a conta.' }, 400);
      }
      await consumir(db, convite.id, criado.user.id, {
        nome, empresa: txt('empresa') ?? convite.empresa, email: convite.email, telefone: txt('telefone', 30), cargo: txt('cargo'),
      });
      return json({ ok: true, email: convite.email });
    }

    if (acao === 'vincular') {
      const quem = await usuarioDaRequisicao(req);
      if (!quem) return json({ ok: false, motivo: 'sem_sessao' }, 401);
      const { convite, motivo } = await conviteDoCodigo(db, String(corpo.codigo ?? ''));
      if (!convite) return json({ ok: false, motivo }, 400);
      if ((quem.user.email ?? '').toLowerCase() !== convite.email) {
        return json({ ok: false, motivo: 'outro_email', erro: 'Este convite é para outro e-mail.' }, 403);
      }
      await consumir(db, convite.id, quem.user.id, {
        nome: txt('nome') ?? convite.nome, empresa: txt('empresa') ?? convite.empresa, email: convite.email,
        telefone: txt('telefone', 30), cargo: txt('cargo'),
      });
      return json({ ok: true });
    }

    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    const codigo = (e as { codigo?: string }).codigo;
    return json({ ok: false, motivo: codigo ?? 'erro', erro: e instanceof Error ? e.message : 'Erro.' }, codigo ? 409 : 500);
  }
});
