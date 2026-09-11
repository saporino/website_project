import { useEffect, useState } from 'react';
import { ArteBags, ArteMapa, ArteXicara } from './svg';

/** Os três slides, na ordem e com os textos do HTML oficial. */
const SLIDES = [
  {
    classe: 's1',
    chip: 'SEMANA DO ESPECIAL',
    titulo: <>Cafés <em>84+ pontos</em><br />com até 30% OFF</>,
    texto: 'Direto de torrefações e produtores de todo o Brasil.',
    cta: 'Ver ofertas',
    href: '#ofertas',
    arte: <ArteBags />,
  },
  {
    classe: 's2',
    chip: 'DO PRODUTOR PARA A SUA XÍCARA',
    titulo: <>Conheça a origem<br /><em>de cada grão</em></>,
    texto: 'Sul de Minas, Cerrado, Mogiana, Mantiqueira e muito mais.',
    cta: 'Explorar origens',
    href: '#regioes',
    arte: <ArteMapa />,
  },
  {
    classe: 's3',
    chip: 'ASSINATURA LiVRE',
    titulo: <>Café fresco todo mês<br />e <em>15% OFF</em> sempre</>,
    texto: 'Escolha a torrefação, a moagem e a frequência. Cancele quando quiser.',
    cta: 'Quero assinar',
    href: '#',
    arte: <ArteXicara />,
  },
];

const INTERVALO = 5500;

export default function HeroCarousel() {
  const [atual, setAtual] = useState(0);

  // O relógio reinicia a cada troca, inclusive quando a troca veio da seta ou
  // da bolinha — é o comportamento do mostrar() do HTML.
  useEffect(() => {
    const t = setInterval(() => setAtual(a => (a + 1) % SLIDES.length), INTERVALO);
    return () => clearInterval(t);
  }, [atual]);

  const ir = (d: number) => setAtual(a => (a + d + SLIDES.length) % SLIDES.length);

  return (
    <section className="hero" aria-label="Destaques">
      {SLIDES.map((s, i) => (
        <div key={s.classe} className={`slide ${s.classe}${i === atual ? ' on' : ''}`}>
          <div className="wrap">
            <div className="hero-txt">
              <span className="chip">{s.chip}</span>
              <h1>{s.titulo}</h1>
              <p>{s.texto}</p>
              <a className="cta" href={s.href}>{s.cta}</a>
            </div>
            <div className="hero-art">{s.arte}</div>
          </div>
        </div>
      ))}
      <button className="hero-seta esq" aria-label="Anterior" onClick={() => ir(-1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m15 5-7 7 7 7" /></svg>
      </button>
      <button className="hero-seta dir" aria-label="Próximo" onClick={() => ir(1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m9 5 7 7-7 7" /></svg>
      </button>
      <div className="dots" id="dots">
        {SLIDES.map((s, i) => (
          <button key={s.classe} aria-label={`Slide ${i + 1}`} className={i === atual ? 'on' : ''} onClick={() => setAtual(i)} />
        ))}
      </div>
    </section>
  );
}
