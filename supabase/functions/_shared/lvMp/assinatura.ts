// Coffee LiVRE — assinatura das notificações do Mercado Pago (x-signature).
//
// Documentação oficial (14/09/2026): header `x-signature` com `ts` e `v1`; manifest
// `id:[data.id];request-id:[x-request-id];ts:[ts];` — data.id alfanumérico em
// minúsculas; campo ausente sai do manifest; HMAC-SHA256 em hexadecimal com a chave
// secreta. Por segurança aceitamos também a grafia sem o ";" final (divergência já
// vista na integração da Saporino). Fail closed: sem assinatura válida, rejeita.

export function lerCabecalhoDeAssinatura(xSignature: string | null): { ts: string; v1: string } | null {
  if (!xSignature) return null;
  const partes: Record<string, string> = {};
  for (const p of xSignature.split(',')) {
    const i = p.indexOf('=');
    if (i > 0) partes[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  return partes.ts && partes.v1 ? { ts: partes.ts, v1: partes.v1 } : null;
}

export function manifestos(dataId: string | null, requestId: string | null, ts: string): string[] {
  let base = '';
  if (dataId) base += `id:${/[a-z]/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) base += `request-id:${requestId};`;
  base += `ts:${ts};`;
  return [base, base.slice(0, -1)];
}

async function hmacHex(segredo: string, mensagem: string): Promise<string> {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const assinatura = await crypto.subtle.sign('HMAC', chave, enc.encode(mensagem));
  return Array.from(new Uint8Array(assinatura)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function assinaturaValida(opts: {
  xSignature: string | null; requestId: string | null; dataId: string | null; segredo: string | null | undefined;
}): Promise<boolean> {
  if (!opts.segredo) return false;
  const cab = lerCabecalhoDeAssinatura(opts.xSignature);
  if (!cab) return false;
  for (const m of manifestos(opts.dataId, opts.requestId, cab.ts)) {
    if (iguais(await hmacHex(opts.segredo, m), cab.v1.toLowerCase())) return true;
  }
  return false;
}

/** Para testes e para o mock: gera o header x-signature como o Mercado Pago faria. */
export async function assinar(segredo: string, dataId: string, requestId: string, ts: string): Promise<string> {
  const v1 = await hmacHex(segredo, manifestos(dataId, requestId, ts)[0]);
  return `ts=${ts},v1=${v1}`;
}
