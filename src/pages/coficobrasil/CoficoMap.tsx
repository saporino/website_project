// Mapa de cobertura — SVG inline, SEM biblioteca, desenho próprio.
// Contorno neutro em cinza, APENAS o Estado de São Paulo preenchido em vermelho (cofico.DEFAULT).
// Pins (quadrados, border-radius 0) só nas âncoras principais; Várzea destacada como CD.
// A informação de cobertura completa vive em TEXTO (na página), não só no desenho — acessibilidade.

const W = 760, H = 560, PAD = 44;
// Projeção simples lat/lng → x/y (esquemático, não cartográfico).
const B = { lngMin: -53.3, lngMax: -43.9, latMin: -25.5, latMax: -19.6 };
const px = (lng: number) => PAD + ((lng - B.lngMin) / (B.lngMax - B.lngMin)) * (W - 2 * PAD);
const py = (lat: number) => PAD + ((B.latMax - lat) / (B.latMax - B.latMin)) * (H - 2 * PAD);

// Contorno aproximado do Estado de São Paulo (esquemático).
const SP_BORDER: [number, number][] = [
  [-50.9, -20.15], [-49.0, -20.05], [-47.6, -19.95], [-46.6, -20.5], [-46.0, -21.3],
  [-44.9, -22.35], [-44.2, -22.95], [-45.4, -23.4], [-45.9, -23.75], [-46.7, -24.05],
  [-47.9, -24.85], [-48.6, -25.2], [-49.7, -24.1], [-50.8, -24.05], [-52.1, -23.1],
  [-53.1, -22.5], [-52.9, -21.5], [-51.9, -20.6], [-50.9, -20.15],
];
const spPath = SP_BORDER.map(([lng, lat], i) => `${i ? 'L' : 'M'}${px(lng).toFixed(1)},${py(lat).toFixed(1)}`).join(' ') + ' Z';

type Pin = { name: string; lat: number; lng: number; hub?: boolean; anchor?: 'start' | 'middle' | 'end'; dy?: number };
const PINS: Pin[] = [
  { name: 'Várzea Paulista', lat: -23.21, lng: -46.83, hub: true, anchor: 'end', dy: -14 },
  { name: 'São Paulo', lat: -23.55, lng: -46.63, anchor: 'start', dy: 18 },
  { name: 'Santos', lat: -23.96, lng: -46.33, anchor: 'start', dy: 16 },
  { name: 'Campinas', lat: -22.90, lng: -47.06, anchor: 'end', dy: -8 },
  { name: 'Sorocaba', lat: -23.50, lng: -47.46, anchor: 'end', dy: 14 },
  { name: 'Ribeirão Preto', lat: -21.17, lng: -47.81, anchor: 'middle', dy: -12 },
  { name: 'São José do Rio Preto', lat: -20.82, lng: -49.38, anchor: 'middle', dy: -12 },
  { name: 'Bauru', lat: -22.31, lng: -49.06, anchor: 'middle', dy: 20 },
  { name: 'São José dos Campos', lat: -23.18, lng: -45.88, anchor: 'start', dy: -10 },
];

export default function CoficoMap() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
      aria-label="Mapa esquemático do Estado de São Paulo com o centro de distribuição em Várzea Paulista e as principais cidades atendidas.">
      {/* fundo neutro (contexto) */}
      <rect x="0" y="0" width={W} height={H} fill="#f5f5f4" />
      {/* Estado de São Paulo em vermelho */}
      <path d={spPath} fill="#FF3131" stroke="#E02020" strokeWidth="2" strokeLinejoin="round" />
      <text x={px(-49.5)} y={py(-22.2)} textAnchor="middle" className="fill-white" fontSize="20" fontWeight="700" opacity="0.9">São Paulo</text>

      {PINS.map((p) => {
        const x = px(p.lng), y = py(p.lat);
        const s = p.hub ? 15 : 11;
        return (
          <g key={p.name}>
            <title>{p.hub ? `${p.name} — Centro de Distribuição` : p.name}</title>
            {/* pin quadrado, border-radius 0 */}
            <rect x={x - s / 2} y={y - s / 2} width={s} height={s} fill={p.hub ? '#111827' : '#ffffff'} stroke={p.hub ? '#ffffff' : '#111827'} strokeWidth="2" />
            <rect x={x - (s - 6) / 2} y={y - (s - 6) / 2} width={s - 6} height={s - 6} fill={p.hub ? '#ffffff' : '#111827'} />
            <text x={x} y={y + (p.dy ?? -12)} textAnchor={p.anchor ?? 'middle'} fontSize={p.hub ? '13' : '12'}
              fontWeight={p.hub ? '700' : '600'} className="fill-neutral-900">{p.name}</text>
            {p.hub && (
              <text x={x} y={y + (p.dy ?? -14) + 15} textAnchor={p.anchor ?? 'end'} fontSize="11" className="fill-neutral-500">Centro de Distribuição</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
