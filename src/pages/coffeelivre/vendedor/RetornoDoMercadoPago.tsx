// Seller Central — retorno do OAuth do Mercado Pago.
//
// Rota canônica: /coffeelivre/vendedor/mp/callback — é exatamente o Redirect URL
// cadastrado na aplicação COFFEE LIVRE MARKETPLACE. Esta tela existe só para receber
// ?code=…&state=…, entregar os dois ao servidor (que faz a troca com o client_secret e
// o code_verifier do PKCE) e mandar o vendedor de volta ao Financeiro.
//
// O `code` some da barra de endereço antes de qualquer outra coisa: ele vale 10 minutos
// e não deve ficar no histórico do navegador nem no Referer.
import { useEffect, useState } from 'react';
import { navegar, rota } from '../config';
import { concluirConexao } from '../pagamento/dados';

export default function RetornoDoMercadoPago() {
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get('code');
    const state = q.get('state');
    const recusa = q.get('error_description') ?? q.get('error');
    window.history.replaceState({}, '', rota('vendedor/mp/callback'));
    (async () => {
      if (recusa) {
        setErro('A autorização não foi concluída no Mercado Pago.');
        return;
      }
      if (!code || !state) {
        setErro('Retorno incompleto do Mercado Pago.');
        return;
      }
      try {
        await concluirConexao(code, state);
        sessionStorage.setItem('lv_mp_conexao', 'ok');
      } catch (e) {
        sessionStorage.setItem('lv_mp_conexao', e instanceof Error ? e.message : 'erro');
      }
      navegar('vendedor/financeiro');
    })();
  }, []);

  return (
    <div className="sc-cartao" data-campo="mp-callback">
      <h2>Mercado Pago</h2>
      <p className="sc-sub">{erro ?? 'Concluindo a conexão da sua conta…'}</p>
      {erro && (
        <button type="button" className="sc-botao" onClick={() => navegar('vendedor/financeiro')}>
          Voltar ao Financeiro
        </button>
      )}
    </div>
  );
}
