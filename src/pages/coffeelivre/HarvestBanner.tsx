/** Faixa "Colheita 2026". Os seis grãos do fundo somem abaixo de 1100px. */
export default function HarvestBanner() {
  const graos: [number, number][] = [[20, 78], [52, 42], [84, 78], [116, 42], [148, 78], [180, 42]];
  return (
    <section className="colheita">
      <span className="tag">COLHEITA 2026</span>
      <div>
        <b>Cafés da nova safra chegando às lojas</b>
        <span>Lotes frescos direto de produtores e torrefações parceiras.</span>
      </div>
      <svg viewBox="0 0 200 120" aria-hidden="true">
        {graos.map(([cx, cy]) => (
          <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="12" ry="17" transform={`rotate(25 ${cx} ${cy})`} fill="#F3A066" />
        ))}
      </svg>
      <a href="#ofertas">Ver nova safra</a>
    </section>
  );
}
