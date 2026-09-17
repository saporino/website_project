// Coffee LiVRE — OAuth do vendedor no Mercado Pago (documentação oficial, 14/09/2026).
//
//   autorização: https://auth.mercadopago.com.br/authorization
//     ?client_id&response_type=code&platform_id=mp&redirect_uri&state&code_challenge&code_challenge_method=S256
//   troca:       POST https://api.mercadopago.com/oauth/token
//     grant_type=authorization_code, client_id, client_secret, code, redirect_uri, code_verifier
//     (test_token=true gera credenciais de teste)
//   renovação:   mesmo endpoint, grant_type=refresh_token — o refresh_token também é renovado
//   resposta:    access_token, refresh_token, user_id, public_key, expires_in, scope, live_mode
//   validade:    access_token de 180 dias; o `code` vale 10 minutos

export const URL_AUTORIZACAO = 'https://auth.mercadopago.com.br/authorization';
export const URL_TOKEN = 'https://api.mercadopago.com/oauth/token';

/**
 * Caminho canônico do retorno do OAuth, igual ao Redirect URL cadastrado na aplicação
 * COFFEE LIVRE MARKETPLACE. O Mercado Pago recusa a autorização se o redirect_uri
 * enviado não for exatamente o cadastrado, então a função confere antes de mandar
 * o vendedor para lá — erro de configuração aparece aqui, não na tela do vendedor.
 */
export const ROTA_CALLBACK = '/coffeelivre/vendedor/mp/callback';

export function redirectUriValida(uri: string | undefined): boolean {
  if (!uri) return false;
  let u: URL;
  try { u = new URL(uri); } catch { return false; }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return false;
  return u.pathname === ROTA_CALLBACK && !u.search && !u.hash;
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function gerarAleatorio(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return b64url(b);
}

export async function sha256Base64Url(texto: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return b64url(new Uint8Array(d));
}

export async function sha256Hex(texto: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(d)).map(x => x.toString(16).padStart(2, '0')).join('');
}

export function urlDeAutorizacao(p: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string {
  const q = new URLSearchParams({
    client_id: p.clientId, response_type: 'code', platform_id: 'mp', redirect_uri: p.redirectUri,
    state: p.state, code_challenge: p.codeChallenge, code_challenge_method: 'S256',
  });
  return `${URL_AUTORIZACAO}?${q.toString()}`;
}

export function corpoDaTroca(p: { clientId: string; clientSecret: string; code: string; redirectUri: string; verifier: string | null; teste: boolean }) {
  const corpo: Record<string, string> = {
    grant_type: 'authorization_code', client_id: p.clientId, client_secret: p.clientSecret, code: p.code, redirect_uri: p.redirectUri,
  };
  if (p.verifier) corpo.code_verifier = p.verifier;
  if (p.teste) corpo.test_token = 'true';
  return corpo;
}

export function corpoDaRenovacao(p: { clientId: string; clientSecret: string; refreshToken: string }) {
  return { grant_type: 'refresh_token', client_id: p.clientId, client_secret: p.clientSecret, refresh_token: p.refreshToken };
}

export interface TokensDoVendedor {
  accessToken: string;
  refreshToken: string | null;
  mpUserId: string | null;
  publicKey: string | null;
  escopos: string[];
  expiraEm: string | null;
  liveMode: boolean | null;
}

/** Normaliza a resposta de /oauth/token sem nunca devolvê-la inteira para log. */
export function normalizarTokens(r: Record<string, unknown>, agora = Date.now()): TokensDoVendedor {
  const access = typeof r.access_token === 'string' ? r.access_token : '';
  if (!access) throw new Error('Resposta do OAuth sem access_token.');
  const expira = typeof r.expires_in === 'number' ? new Date(agora + r.expires_in * 1000).toISOString() : null;
  const escopo = typeof r.scope === 'string' ? r.scope.split(/[\s,]+/).filter(Boolean) : [];
  return {
    accessToken: access,
    refreshToken: typeof r.refresh_token === 'string' ? r.refresh_token : null,
    mpUserId: r.user_id != null ? String(r.user_id) : null,
    publicKey: typeof r.public_key === 'string' ? r.public_key : null,
    escopos: escopo,
    expiraEm: expira,
    liveMode: typeof r.live_mode === 'boolean' ? r.live_mode : null,
  };
}
