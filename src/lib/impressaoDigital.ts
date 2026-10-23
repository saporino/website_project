/**
 * Impressão digital de um arquivo: SHA-256 dos bytes, em hexadecimal.
 *
 * Serve para reconhecer a MESMA arte subida de novo, mesmo com outro nome —
 * "foto (1).png" e "foto.png" com os mesmos bytes dão o mesmo hash, e dois
 * arquivos chamados "post.png" com conteúdos diferentes dão hashes diferentes.
 *
 * Roda no navegador, antes do upload, para a repetição ser descoberta sem
 * gastar banda. `crypto.subtle` só existe em contexto seguro (https ou
 * localhost); fora disso devolve null, e quem chama trata a ausência como
 * "não sei dizer" — nunca como "é novo".
 */
export async function impressaoDigital(arquivo: Blob): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  try {
    const bytes = await arquivo.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Arquivo que não dá para ler por inteiro (muito grande para a memória,
    // permissão negada) não impede o envio: só não ganha impressão digital.
    return null;
  }
}
