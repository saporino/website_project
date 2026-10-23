import { describe, it, expect } from 'vitest';
import { impressaoDigital } from './impressaoDigital';

describe('impressaoDigital — reconhece a arte pelo conteúdo, não pelo nome', () => {
  it('o mesmo conteúdo dá o mesmo hash, ainda que o nome mude', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    const a = new File([bytes], 'post.png', { type: 'image/png' });
    const b = new File([bytes], 'post (1).png', { type: 'image/png' });
    expect(await impressaoDigital(a)).toBe(await impressaoDigital(b));
  });

  it('conteúdos diferentes dão hashes diferentes, ainda que o nome seja igual', async () => {
    const a = new File([new Uint8Array([1, 2, 3])], 'post.png', { type: 'image/png' });
    const b = new File([new Uint8Array([1, 2, 4])], 'post.png', { type: 'image/png' });
    expect(await impressaoDigital(a)).not.toBe(await impressaoDigital(b));
  });

  it('devolve SHA-256 em hex: 64 caracteres', async () => {
    const h = await impressaoDigital(new Blob(['café']));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('um byte trocado muda o hash inteiro', async () => {
    const a = await impressaoDigital(new Blob(['tropeiro paulista']));
    const b = await impressaoDigital(new Blob(['tropeiro paulistb']));
    expect(a).not.toBe(b);
  });
});
