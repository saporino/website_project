// Resolução de URL de arquivos em buckets PRIVADOS do Supabase Storage.
//
// Desde a Fase D (04/09/2026) os buckets chat-media, visit-photos, delivery-pods,
// invoices, lot-documents, studio-videos e representative-docs são privados.
// Nada neles pode ser exibido por URL pública: é preciso gerar uma signed URL
// de curta duração, que respeita a RLS do usuário que a pede.
//
// O banco ainda guarda, em linhas antigas, a URL pública inteira. Por isso estas
// funções aceitam tanto o caminho do objeto quanto a URL antiga e extraem o caminho.

import { supabase } from './supabase';

/** Extrai o caminho do objeto dentro do bucket, aceitando caminho puro, URL pública ou URL assinada. */
export function storagePathFrom(bucket: string, value: string): string {
  if (!value) return value;
  for (const marker of [`/storage/v1/object/public/${bucket}/`, `/storage/v1/object/sign/${bucket}/`]) {
    const i = value.indexOf(marker);
    if (i >= 0) {
      const raw = value.slice(i + marker.length).split('?')[0];
      try { return decodeURIComponent(raw); } catch { return raw; }
    }
  }
  return value;
}

/** Gera uma signed URL para um arquivo de bucket privado. Devolve null se não for possível. */
export async function signedUrl(
  bucket: string,
  value: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!value) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePathFrom(bucket, value), expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Versão em lote: preserva a ordem e devolve null nas posições que falharem. */
export async function signedUrls(
  bucket: string,
  values: (string | null | undefined)[],
  expiresIn = 3600,
): Promise<(string | null)[]> {
  return Promise.all(values.map(v => signedUrl(bucket, v, expiresIn)));
}
