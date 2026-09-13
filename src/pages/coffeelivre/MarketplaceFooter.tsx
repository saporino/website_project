import { LOGO, ALT_LOGO, colunasDoRodape } from './mockData';
import { encerrarSessao } from './AccessGate';
import { DEMONSTRACAO_PRIVADA, navegar, rota } from './config';

// Itens do rodapé que já têm página. Os outros continuam âncora vazia
// até existirem.
const DESTINOS: Record<string, string> = { 'Para empresas': 'empresas', 'Como vender': 'vender' };

export default function MarketplaceFooter() {
  return (
    <footer>
      <div className="wrap ft">
        <div>
          {/* O HTML original copiava o src do cabeçalho por JS para não repetir
              o base64. Aqui os dois apontam para o mesmo arquivo. */}
          <a className="logo" href="#"><img src={LOGO} alt={ALT_LOGO} width="239" height="62" /></a>
          <p>Produtores, torrefações e marcas de café do Brasil inteiro em um só lugar.</p>
        </div>
        {colunasDoRodape.map(([titulo, itens]) => (
          <div key={titulo}>
            <h4>{titulo}</h4>
            <ul>{itens.map(i => (
              <li key={i}>
                {DESTINOS[i]
                  ? <a href={rota(DESTINOS[i])} onClick={e => { e.preventDefault(); navegar(DESTINOS[i]); }}>{i}</a>
                  : <a href="#">{i}</a>}
              </li>
            ))}</ul>
          </div>
        ))}
      </div>
      <div className="wrap copy">
        <span>© 2026 Coffee LiVRE. Mockup — dados de produtos, preços e lojas são fictícios.</span>
        <span>
          Pix · Cartão · Boleto
          {/* Sair da demonstração. Discreto de proposito: e controle de
              apresentacao, nao elemento da loja. Some quando o marketplace
              abrir ao publico. */}
          {DEMONSTRACAO_PRIVADA && (
            <>
              {' · '}
              <button
                type="button"
                onClick={() => { encerrarSessao(); window.location.reload(); }}
                style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}
              >
                Sair da demonstração
              </button>
            </>
          )}
        </span>
      </div>
    </footer>
  );
}
