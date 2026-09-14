// Seller Central — Financeiro / Mercado Pago.
//
// Split 1:1: o dinheiro de cada venda cai na conta Mercado Pago DO VENDEDOR, e a
// comissão do Coffee LiVRE sai na própria transação. Por isso o vendedor conecta a
// conta (OAuth). Tokens nunca chegam a esta tela: ela só vê o estado da conexão.
// Os valores são só leitura: vêm congelados da cobrança; a taxa real, da reconciliação.
import { useCallback, useEffect, useState } from 'react';
import { rota } from '../config';
import { reais } from '../visual';
import { ROTULO_DA_COBRANCA } from '../../../../supabase/functions/_shared/lvMp/status';
import {
  cobrancasDoVendedor, concluirConexao, desconectarMercadoPago, estadoDaConexao, iniciarConexao,
  type CobrancaDoVendedor, type EstadoDaConexao,
} from '../pagamento/dados';
import type { ContextoDoVendedor } from './sessao';
import type { Avisar } from './SellerCentral';
import './financeiro.css';

const R = (c: number | null) => (c == null ? 'não disponível' : `R$ ${reais(c)}`);
const data = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');

const ROTULO_DA_CONEXAO: Record<EstadoDaConexao['conexao']['status'], string> = {
  nao_conectado: 'Não conectado',
  conectando: 'Conectando',
  conectado: 'Conectado',
  atencao: 'Atenção necessária',
  expirado: 'Reautorização necessária',
  desconectado: 'Desconectado',
};

export default function FinanceiroDoVendedor({ contexto, avisar }: { contexto: ContextoDoVendedor; avisar: Avisar }) {
  const [estado, setEstado] = useState<EstadoDaConexao | null>(null);
  const [cobrancas, setCobrancas] = useState<CobrancaDoVendedor[] | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const [e, c] = await Promise.all([estadoDaConexao().catch(() => null), cobrancasDoVendedor(contexto.sellerId).catch(() => [])]);
    setEstado(e);
    setCobrancas(c);
  }, [contexto.sellerId]);

  useEffect(() => {
    // Volta do Mercado Pago (ou do mock no staging): ?code=…&state=…
    const q = new URLSearchParams(window.location.search);
    const code = q.get('code');
    const state = q.get('state');
    (async () => {
      if (code && state) {
        window.history.replaceState({}, '', rota('vendedor/financeiro'));
        try {
          await concluirConexao(code, state);
          avisar({ tipo: 'ok', texto: 'Mercado Pago conectado.' });
        } catch (err) {
          avisar({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Não foi possível conectar.' });
        }
      }
      await carregar();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function conectar() {
    setOcupado(true);
    try {
      const { url } = await iniciarConexao(`${window.location.origin}${rota('vendedor/financeiro')}`);
      window.location.assign(url);
    } catch (err) {
      avisar({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Não foi possível iniciar a conexão.' });
      setOcupado(false);
    }
  }

  async function desconectar() {
    setOcupado(true);
    try {
      await desconectarMercadoPago();
      avisar({ tipo: 'ok', texto: 'Mercado Pago desconectado.' });
      await carregar();
    } catch (err) {
      avisar({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Não foi possível desconectar.' });
    } finally {
      setOcupado(false);
    }
  }

  const conexao = estado?.conexao;
  const conectado = conexao?.status === 'conectado';

  return (
    <div className="fin">
      <section className="sc-cartao">
        <div className="fin-topo">
          <h2>Mercado Pago</h2>
          {conexao && <em className={`fin-status s-${conexao.status}`} data-campo="status-mercado-pago">{ROTULO_DA_CONEXAO[conexao.status]}</em>}
        </div>
        {estado?.ambiente === 'teste' && (
          <p className="fin-teste">AMBIENTE DE TESTE{estado.provedor === 'mock' ? ' · conexão simulada, sem conta real' : ''}</p>
        )}
        <p className="sc-sub">
          Cada venda é paga direto na sua conta Mercado Pago. A comissão do Coffee LiVRE, a tarifa operacional e o frete
          do CD saem na própria transação. Não mostramos nem guardamos sua senha; o acesso fica protegido no servidor.
        </p>
        {!estado ? <p className="sc-sub">Carregando…</p> : estado.integracao_bloqueada ? (
          <p className="sc-sub" data-campo="integracao-bloqueada">A integração com o Mercado Pago ainda não está ativa neste ambiente. Nenhuma conta pode ser conectada por enquanto.</p>
        ) : (
          <>
            {conectado && (
              <dl className="fin-dados">
                <div><dt>Conta</dt><dd>{conexao?.mp_user_id}</dd></div>
                <div><dt>Conectada em</dt><dd>{data(conexao?.conectado_em)}</dd></div>
                <div><dt>Autorização válida até</dt><dd>{data(conexao?.expira_em)}</dd></div>
              </dl>
            )}
            {conexao?.ultimo_erro && conexao.status !== 'conectado' && <p className="sc-erro">{conexao.ultimo_erro}</p>}
            <div className="fin-acoes">
              {!conectado && (
                <button type="button" className="sc-botao sc-botao-principal" onClick={conectar} disabled={ocupado}>
                  {conexao?.status === 'expirado' || conexao?.status === 'atencao' ? 'Reconectar Mercado Pago' : 'Conectar Mercado Pago'}
                </button>
              )}
              {conectado && <button type="button" className="sc-botao" onClick={desconectar} disabled={ocupado}>Desconectar</button>}
            </div>
          </>
        )}
      </section>

      <section className="sc-cartao">
        <h2>Pagamentos das suas vendas</h2>
        <p className="sc-sub">Valores de cada pagamento. A taxa do Mercado Pago aparece como estimada até o pagamento ser conferido.</p>
        {cobrancas === null ? <p className="sc-sub">Carregando…</p> : cobrancas.length === 0 ? <p className="sc-sub">Nenhum pagamento ainda.</p> : (
          <ul className="fin-lista">
            {cobrancas.map(c => (
              <li key={c.id} className="fin-cobranca" data-cobranca={c.status}>
                <div className="fin-topo">
                  <b>{c.lv_seller_orders?.numero ?? 'Pedido'}</b>
                  <em className={`fin-status s-${c.status}`}>{ROTULO_DA_COBRANCA[c.status]}</em>
                </div>
                <small>{data(c.criado_em)} · {c.metodo === 'pix' ? 'Pix' : 'Cartão'}{c.provedor === 'mock' ? ' · teste' : ''}</small>
                <dl className="fin-valores">
                  <div><dt>Valor pago</dt><dd>{R(c.valor_cents)}</dd></div>
                  <div><dt>Comissão Coffee LiVRE</dt><dd>− {R(c.comissao_cents)}</dd></div>
                  <div><dt>Tarifa operacional</dt><dd>− {R(c.tarifa_cents)}</dd></div>
                  {c.frete_no_application_fee && <div><dt>Frete (CD Coffee LiVRE)</dt><dd>− {R(c.frete_cents)}</dd></div>}
                  <div><dt>Taxa Mercado Pago {c.processor_fee_real_cents != null ? '(real)' : '(estimada)'}</dt>
                    <dd>− {R(c.processor_fee_real_cents ?? c.processor_fee_estimada_cents)}</dd></div>
                  <div className="forte"><dt>Líquido {c.liquido_seller_real_cents != null ? 'recebido' : 'estimado'}</dt>
                    <dd data-campo="liquido">{R(c.liquido_seller_real_cents ?? c.liquido_seller_estimado_cents)}</dd></div>
                  {c.reembolsado_cents > 0 && <div><dt>Reembolsado</dt><dd>{R(c.reembolsado_cents)}</dd></div>}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
