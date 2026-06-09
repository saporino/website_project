import type { CSSProperties } from 'react';

// Estilo do botao do banner — proporcional a largura do banner (unidades cqw),
// para manter o mesmo tamanho relativo no site e no preview do admin.
// Requer um ancestral com `container-type: inline-size`.
export const bannerButtonStyle = (x: number, y: number, scale: number): CSSProperties => ({
  left: `${x}%`,
  top: `${y}%`,
  transform: 'translate(-50%, -50%)',
  fontSize: `${1.6 * scale}cqw`,
  padding: `${0.55 * scale}cqw ${1.8 * scale}cqw`,
  lineHeight: 1.1,
});
