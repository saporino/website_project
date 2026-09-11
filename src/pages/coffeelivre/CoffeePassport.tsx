// Coffee Passport — a identidade digital do café.
//
// REGRA ABSOLUTA: mostra só o que existe. A view do banco já devolve
// apenas campos com valor, então aqui não há nenhum "não informado",
// nenhum travessão e nenhum texto genérico de preenchimento. Se o café
// tem quatro campos, aparecem quatro. Se não tem nenhum — um moedor, por
// exemplo — o componente não renderiza nada.
//
// Isso é o contrário do que um marketplace generalista faz, e é o ponto:
// café tradicional não é obrigado a fingir que é microlote.
import { useState } from 'react';
import type { CampoDoPassport, NivelDoPassport } from './catalogo';
import { ROTULO_DO_NIVEL } from './catalogo';

export default function CoffeePassport({ campos, nivel, urlPermanente }: {
  campos: CampoDoPassport[];
  nivel: NivelDoPassport;
  /** URL estável do café. É o destino do QR que o vendedor vai imprimir. */
  urlPermanente: string;
}) {
  const [copiado, setCopiado] = useState(false);

  // Sem campo não há passaporte, e sem passaporte não há seção.
  if (!campos.length) return null;

  function copiar() {
    navigator.clipboard?.writeText(urlPermanente);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  return (
    <section className="passport">
      <div className="passport-topo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 4h11l3 3v13H5z" /><path d="M8 10h8M8 14h5" />
        </svg>
        <h2>Coffee Passport</h2>
        {nivel && <span className={`nivel ${nivel}`}>{ROTULO_DO_NIVEL[nivel]}</span>}
      </div>

      <div className="passport-campos">
        {campos.map(c => (
          <div className="passport-campo" key={c.chave}>
            <small>{c.rotulo}</small>
            <b>{c.valor}{c.unidade ? ` ${c.unidade}` : ''}</b>
          </div>
        ))}
      </div>

      <p className="passport-nota">
        Informado pelo vendedor. Campos que não aparecem aqui é porque não foram informados para
        este café — o Coffee LiVRE não preenche lacuna com texto genérico.
      </p>

      {/* Preparado para o QR. A URL é permanente: o vendedor pode imprimir
          na embalagem e ela continua válida mesmo se o domínio mudar. */}
      <div className="compartilhar">
        <b>Compartilhe este café</b>
        <div className="url">
          <input readOnly value={urlPermanente} aria-label="Endereço permanente deste café" onFocus={e => e.currentTarget.select()} />
          <button type="button" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button>
        </div>
        <small>
          Endereço permanente. O vendedor poderá usá-lo em QR Code na embalagem, no balcão e em
          feiras, levando o consumidor direto a este Coffee Passport.
        </small>
      </div>
    </section>
  );
}
