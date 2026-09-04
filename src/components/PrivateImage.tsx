// Imagem hospedada em bucket PRIVADO do Supabase Storage (Fase D, 04/09/2026).
// Recebe o caminho do objeto (ou uma URL pública antiga) e resolve uma signed URL
// de curta duração antes de exibir.

import { useEffect, useState } from 'react';
import { signedUrl } from '../lib/storageUrl';

interface Props {
  bucket: string;
  value: string | null | undefined;
  alt?: string;
  className?: string;
  /** Segundos de validade da signed URL. Padrão: 1 hora. */
  expiresIn?: number;
}

export default function PrivateImage({ bucket, value, alt = '', className, expiresIn = 3600 }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setUrl(null);
    if (!value) return;
    signedUrl(bucket, value, expiresIn).then(u => {
      if (!alive) return;
      if (u) setUrl(u); else setFailed(true);
    });
    return () => { alive = false; };
  }, [bucket, value, expiresIn]);

  if (!value) return null;
  if (failed) return <p className="text-xs text-gray-400">imagem indisponível</p>;
  if (!url) return <div className={`bg-gray-100 animate-pulse rounded-lg ${className ?? ''}`} style={{ minHeight: 64 }} />;
  return <img src={url} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}
