// Extrai o áudio de um vídeo NO NAVEGADOR (Web Audio API), reduzindo para
// 16 kHz mono WAV — formato ideal e minúsculo para o Whisper. Sem dependência externa.
// Usado quando o vídeo passa do limite de 25 MB da API de transcrição.

function encodeWav(buffer: AudioBuffer): Blob {
  const ch = buffer.getChannelData(0); // mono (renderizado com 1 canal)
  const sampleRate = buffer.sampleRate;
  const bytes = new ArrayBuffer(44 + ch.length * 2);
  const view = new DataView(bytes);
  const w = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); view.setUint32(4, 36 + ch.length * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  w(36, 'data'); view.setUint32(40, ch.length * 2, true);
  let off = 44;
  for (let i = 0; i < ch.length; i++) { const s = Math.max(-1, Math.min(1, ch[i])); view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2; }
  return new Blob([view], { type: 'audio/wav' });
}

export async function extractAudioWav(file: File): Promise<Blob> {
  const arrayBuf = await file.arrayBuffer();
  const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ac = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await ac.decodeAudioData(arrayBuf);
  } finally {
    ac.close();
  }
  if (!decoded || decoded.duration === 0) throw new Error('Não foi possível ler o áudio deste vídeo.');
  // downsample para 16 kHz mono
  const targetRate = 16000;
  const length = Math.max(1, Math.ceil(decoded.duration * targetRate));
  const off = new OfflineAudioContext(1, length, targetRate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return encodeWav(rendered);
}
