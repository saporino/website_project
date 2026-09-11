// Coffee LiVRE — as ilustrações da home.
//
// No HTML oficial elas nascem de funções que devolvem string e entram por
// innerHTML. Aqui viram componentes que produzem EXATAMENTE o mesmo SVG, com
// os atributos hifenizados convertidos para camelCase do JSX:
//   stroke-width -> strokeWidth, stop-color -> stopColor, text-anchor ->
//   textAnchor, stroke-linecap -> strokeLinecap, font-family -> fontFamily.
// Nenhum dangerouslySetInnerHTML.

export type TipoPacote = 'grao' | 'moido' | 'caps' | 'drip';

interface PropsPacote {
  cor: string;
  fita: string;
  rotulo: string;
  tipo: TipoPacote;
  /** art.bags acrescenta width/height ao <svg> aninhado. */
  width?: number;
  height?: number;
}

/**
 * Miolo do pacote, sem o <svg> em volta.
 *
 * Existe porque as artes "kit" e "crate" do HTML removem a tag <svg> do
 * resultado (replace(/<svg[^>]*>|<\/svg>/g,'')) e reaproveitam só o conteúdo
 * dentro de um <g> com transform.
 */
export function MioloDoPacote({ cor, fita, rotulo, tipo }: Omit<PropsPacote, 'width' | 'height'>) {
  if (tipo === 'caps') {
    return (
      <>
        <rect x="14" y="30" width="92" height="104" rx="8" fill={cor} />
        <rect x="14" y="30" width="92" height="18" rx="8" fill={fita} />
        <rect x="24" y="62" width="72" height="44" rx="5" fill="#fff" />
        {[0, 1, 2].map(i => (
          <g key={i} transform={`translate(${34 + i * 22} 76)`}>
            <circle r="8" fill={cor} />
            <circle r="4" fill={fita} />
          </g>
        ))}
        <text x="60" y="101" fontSize="7.5" textAnchor="middle" fontFamily="Arial" fontWeight="700" fill={cor}>{rotulo}</text>
        <text x="60" y="124" fontSize="8" textAnchor="middle" fontFamily="Arial" fontWeight="700" fill="#fff">10 CÁPSULAS</text>
      </>
    );
  }
  if (tipo === 'drip') {
    return (
      <>
        <rect x="22" y="18" width="76" height="120" rx="6" fill={cor} />
        <path d="M36 50h48l-8 42H44z" fill="#fff" opacity=".95" />
        <path d="M40 56h40M43 66h34M46 76h28" stroke={fita} strokeWidth="2" />
        <rect x="30" y="100" width="60" height="22" rx="3" fill={fita} />
        <text x="60" y="115" fontSize="8" textAnchor="middle" fontFamily="Arial" fontWeight="700" fill={cor}>{rotulo}</text>
        <text x="60" y="36" fontSize="8" textAnchor="middle" fontFamily="Arial" fontWeight="700" fill="#fff">10 SACHÊS</text>
      </>
    );
  }
  const grao = tipo !== 'moido';
  return (
    <>
      <path d="M24 16h72l6 18v100a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V34z" fill={cor} />
      <path d="M24 16h72l2 6H22z" fill="rgba(0,0,0,.18)" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
        <rect key={i} x={24 + i * 6.6} y="16" width="3" height="6" fill="rgba(255,255,255,.25)" />
      ))}
      <circle cx="86" cy="42" r="5" fill="rgba(0,0,0,.2)" />
      <circle cx="86" cy="42" r="2.2" fill="rgba(255,255,255,.5)" />
      <rect x="28" y="58" width="64" height="58" rx="6" fill="#fff" />
      <rect x="28" y="58" width="64" height="12" rx="6" fill={fita} />
      <ellipse cx="60" cy="88" rx="9" ry="12" transform="rotate(25 60 88)" fill={cor} />
      <path d="M56 79c5 4 4 13-1 18" fill="none" stroke={fita} strokeWidth="1.8" strokeLinecap="round" transform="rotate(8 60 88)" />
      <text x="60" y="111" fontSize="7.5" textAnchor="middle" fontFamily="Arial" fontWeight="700" fill={cor}>{rotulo}</text>
      <text x="60" y="130" fontSize="7.5" textAnchor="middle" fontFamily="Arial" fontWeight="700" fill="#fff" opacity=".9">{grao ? 'EM GRÃOS' : 'MOÍDO'}</text>
    </>
  );
}

/** Equivalente à função pacote(cor, fita, rotulo, tipo) do HTML oficial. */
export function CoffeeBag({ cor, fita, rotulo, tipo, width, height }: PropsPacote) {
  return (
    <svg viewBox="0 0 120 150" aria-hidden="true" width={width} height={height}>
      <MioloDoPacote cor={cor} fita={fita} rotulo={rotulo} tipo={tipo} />
    </svg>
  );
}

// ---------------------------------------------------------------------
// Ícones repetidos
// ---------------------------------------------------------------------
export function IconeSelo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 14.4 4l3.1-.3.9 3 2.7 1.6-1 3 1 3-2.7 1.6-.9 3-3.1-.3L12 22l-2.4-2-3.1.3-.9-3L2.9 15.7l1-3-1-3L5.6 8.1l.9-3 3.1.3z" />
      <path d="m8.5 12.2 2.3 2.3 4.7-4.8" stroke="#fff" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function IconeCoracao() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
    </svg>
  );
}

export function SetaEsquerda({ largura }: { largura: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={largura}><path d="m15 5-7 7 7 7" /></svg>;
}

export function SetaDireita({ largura }: { largura: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={largura}><path d="m9 5 7 7-7 7" /></svg>;
}

// ---------------------------------------------------------------------
// Ícones das categorias — o miolo de cada <svg>, como no objeto catIco
// ---------------------------------------------------------------------
export const ICONES_CATEGORIA: Record<string, React.ReactNode> = {
  grao: <><ellipse cx="12" cy="12" rx="6" ry="8.5" transform="rotate(25 12 12)" /><path d="M9.5 5.5c3.5 3 3 10-.5 13" transform="rotate(8 12 12)" /></>,
  moido: <><path d="M3 19c3-6 6-9 9-9s6 3 9 9z" /><path d="M8 15h.01M12 13h.01M16 15h.01M11 17h.01" /></>,
  caps: <><path d="M5 9h14l-2 10H7z" /><path d="M4 9h16v-2H4z" /></>,
  esp: <path d="m12 3 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z" />,
  org: <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7" />,
  verde: <><path d="M4 20V10l8-6 8 6v10z" /><path d="M9 20v-6h6v6" /></>,
  metodo: <><path d="M6 5h12l-4 7v5h-4v-5z" /><path d="M8 20h8" /></>,
  maquina: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M10 12h4v4h-4z" /></>,
  drip: <><path d="M6 4h12v16H6z" /><path d="M9 8h6l-1.5 6h-3z" /></>,
  gelado: <><path d="M7 4h10l-1.5 16h-7z" /><path d="M9 9h6M9.5 13h5" /></>,
};

// ---------------------------------------------------------------------
// Artes do hero e dos banners — o objeto `art` do HTML oficial
// ---------------------------------------------------------------------
export function ArteBags() {
  return (
    <svg viewBox="0 0 300 220">
      <g transform="translate(20 40) rotate(-8)">
        <CoffeeBag cor="#3A2318" fita="#F3A066" rotulo="84+ PTS" tipo="grao" width={120} height={150} />
      </g>
      <g transform="translate(150 20) rotate(6)">
        <CoffeeBag cor="#fff" fita="#DA6418" rotulo="MICROLOTE" tipo="grao" width={130} height={165} />
      </g>
      <circle cx="270" cy="200" r="40" fill="#fff" opacity=".2" />
    </svg>
  );
}

export function ArteMapa() {
  const pinos: [number, number][] = [[150, 90], [175, 120], [140, 140], [120, 110], [190, 80], [160, 165]];
  return (
    <svg viewBox="0 0 300 220">
      <path d="M110 20c40-8 90 10 110 40s20 70-5 100-70 50-100 40-50-40-55-75 10-98 50-105z" fill="#DA6418" opacity=".95" />
      {pinos.map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <circle r="9" fill="#fff" />
          <circle r="3.5" fill="#2A1911" />
        </g>
      ))}
    </svg>
  );
}

export function ArteXicara() {
  return (
    <svg viewBox="0 0 300 220">
      <ellipse cx="150" cy="195" rx="110" ry="14" fill="rgba(0,0,0,.25)" />
      <path d="M70 80h150v40c0 45-33 75-75 75s-75-30-75-75z" fill="#fff" />
      <path d="M220 95h14a22 22 0 0 1 0 44h-18" fill="none" stroke="#fff" strokeWidth="12" />
      <ellipse cx="145" cy="80" rx="75" ry="14" fill="#3B2416" />
      <path d="M120 60c-10-15 10-22 0-40M150 55c-10-15 10-22 0-40M180 60c-10-15 10-22 0-40" fill="none" stroke="#2A1911" strokeWidth="5" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}

const CORES_KIT = ['#DA6418', '#2F4B3A', '#8B2214', '#A2472A'];
const ROTULOS_KIT = ['SUL MG', 'CERRADO', 'MOGIANA', 'CHAPADA'];

/** Miolo da arte do banner "Kit Degustação". */
export function ArteKit() {
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <g key={i} transform={`translate(${10 + i * 45} ${40 + (i % 2) * 14}) scale(.75)`}>
          <MioloDoPacote cor={CORES_KIT[i]} fita="#EFE3DA" rotulo={ROTULOS_KIT[i]} tipo="grao" />
        </g>
      ))}
    </>
  );
}

/** Miolo da arte do banner "Para o seu negócio". */
export function ArteCaixote() {
  return (
    <g transform="translate(40 20)">
      <rect x="0" y="60" width="160" height="100" rx="8" fill="#3A2318" opacity=".95" />
      <path d="M0 95h160M0 128h160" stroke="#fff" strokeWidth="3" opacity=".2" />
      {[0, 1, 2].map(i => (
        <g key={i} transform={`translate(${10 + i * 48} 0) scale(.6)`}>
          <MioloDoPacote cor="#F3A066" fita="#3A2318" rotulo="5 KG" tipo="grao" />
        </g>
      ))}
    </g>
  );
}

/** Miolo da arte do bloco "Venda no Coffee LiVRE". */
export function ArteLoja() {
  return (
    <g transform="translate(30 30)">
      <path d="M0 50 20 0h140l20 50z" fill="#3A2318" />
      <path d="M0 50h180v10H0z" fill="#24150E" />
      <rect x="10" y="60" width="160" height="100" fill="#fff" opacity=".95" />
      <rect x="30" y="85" width="50" height="75" fill="#3A2318" />
      <rect x="100" y="85" width="50" height="40" fill="#EFE3DA" />
      {[0, 1, 2, 3].map(i => (
        <path key={i} d={`M${i * 45} 50a22 22 0 0 0 45 0`} fill={i % 2 ? '#F3A066' : '#3A2318'} />
      ))}
    </g>
  );
}

/** Fundo de um card de origem. O id do gradiente segue o índice, como no HTML. */
export function FundoDaOrigem({ indice, c1, c2 }: { indice: number; c1: string; c2: string }) {
  return (
    <svg className="bg" viewBox="0 0 300 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`g${indice}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width="300" height="150" fill={`url(#g${indice})`} />
      <path d="M0 110 C60 70 110 95 160 70 S250 40 300 60 V150 H0z" fill="rgba(255,255,255,.10)" />
      <path d="M0 130 C70 100 130 120 190 95 S270 85 300 90 V150 H0z" fill="rgba(0,0,0,.12)" />
      {[...Array(9)].map((_, k) => (
        <circle key={k} cx={40 + k * 28 + (k % 2) * 6} cy={108 - (k % 3) * 10 + (indice % 2) * 4} r="3.2" fill="rgba(243,160,102,.75)" />
      ))}
    </svg>
  );
}
