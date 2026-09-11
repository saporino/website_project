/** Os quatro benefícios, na ordem do HTML oficial. */
export default function BenefitsBar() {
  return (
    <section className="beneficios">
      <div className="bf">
        <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 3 3.5 3.5L12 10 8.5 6.5zM17.5 8.5 21 12l-3.5 3.5L14 12zM6.5 8.5 10 12l-3.5 3.5L3 12zM12 14l3.5 3.5L12 21l-3.5-3.5z" /></svg></span>
        <div><b>Pix com desconto</b><span>5% OFF pagando no Pix</span></div>
      </div>
      <div className="bf">
        <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></svg></span>
        <div><b>Até 6x sem juros</b><span>no cartão de crédito</span></div>
      </div>
      <div className="bf">
        <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg></span>
        <div><b>Frete grátis</b><span>em compras acima de R$ 99</span></div>
      </div>
      <div className="bf">
        <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z" /><path d="m8.8 12 2.2 2.2 4.3-4.4" /></svg></span>
        <div><b>Compra garantida</b><a href="#">Receba ou seu dinheiro de volta</a></div>
      </div>
    </section>
  );
}
