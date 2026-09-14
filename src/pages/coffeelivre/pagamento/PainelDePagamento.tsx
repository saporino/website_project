// Coffee LiVRE — painel de pagamento do comprador.
//
// Split 1:1 do Mercado Pago: cada loja é um pagamento. A compra continua uma só
// para quem compra, mas o painel mostra uma cobrança por loja (Pix com copia e cola
// e expiração; cartão pelo formulário seguro do Mercado Pago).
//
// Ambiente de teste: tudo é marcado como TESTE e o provedor mock oferece cartões de
// teste (aprovado/recusado) pelo MESMO caminho do servidor. Não há botão que "aprova"
// um pagamento por fora. Produção antes da U9.2: pagamento online desativado, dito
// com clareza.
import { useCallback, useEffect, useState } from 'react';
import { reais } from '../visual';
import { ROTULO_DA_COBRANCA } from '../../../../supabase/functions/_shared/lvMp/status';
import {
  cobrancasDoPedido, configDePagamento, criarCobrancas, ultimaPorSubpedido,
  type CobrancaDoComprador, type ConfigDePagamento, type DadosDoCartao,
} from './dados';
import CartaoBrick from './CartaoBrick';
import './pagamento.css';

const R = (c: number) => `R$ ${reais(c)}`;
const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const PENDENTES = ['criando', 'aguardando_pagamento', 'em_analise'];
const FINAIS_RUINS = ['recusado', 'cancelado', 'expirado', 'erro'];

export default function PainelDePagamento({ orderId, metodoInicial, valorTotalCents, aoMudarStatus }: {
  orderId: string;
  metodoInicial: 'pix' | 'cartao';
  valorTotalCents: number;
  aoMudarStatus?: (statusDoPedido: string) => void;
}) {
  const [config, setConfig] = useState<ConfigDePagamento | null>(null);
  const [metodo, setMetodo] = useState<'pix' | 'cartao'>(metodoInicial);
  const [cobrancas, setCobrancas] = useState<CobrancaDoComprador[]>([]);
  const [statusPedido, setStatusPedido] = useState<string | null>(null);
  const [falhas, setFalhas] = useState<{ loja: string; erro: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const atualizar = useCallback(async (conferir = true) => {
    const r = await cobrancasDoPedido(orderId, conferir);
    setCobrancas(r.cobrancas);
    if (r.pedido) {
      setStatusPedido(r.pedido.status);
      aoMudarStatus?.(r.pedido.status);
    }
  // aoMudarStatus é callback do pai; o painel não deve recriar o laço por causa dele.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    configDePagamento().then(setConfig);
    atualizar(false).catch(() => {});
  }, [atualizar]);

  const vivas = ultimaPorSubpedido(cobrancas);
  const aguardando = vivas.some(c => PENDENTES.includes(c.status));

  // Pagamentos de teste não enviam webhook: o painel pede conferência a cada 5 s.
  useEffect(() => {
    if (!aguardando) return;
    const t = window.setInterval(() => atualizar(true).catch(() => {}), 5000);
    return () => window.clearInterval(t);
  }, [aguardando, atualizar]);

  const gerar = useCallback(async (cartoes?: Record<string, DadosDoCartao>) => {
    setOcupado(true);
    setErro(null);
    try {
      const r = await criarCobrancas(orderId, metodo, cartoes);
      setFalhas(r.falhas ?? []);
      await atualizar(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o pagamento.');
    } finally {
      setOcupado(false);
    }
  }, [orderId, metodo, atualizar]);

  async function copiar(c: CobrancaDoComprador) {
    try { await navigator.clipboard.writeText(c.pix_qr_code ?? ''); setCopiado(c.id); } catch { setCopiado(null); }
  }

  if (!config) return <div className="pg-painel"><p className="ck-sub">Carregando pagamento…</p></div>;

  if (!config.ativo) {
    return (
      <div className="pg-painel" data-campo="pagamento-desativado">
        <b>Pagamento online ainda não disponível</b>
        <p className="ck-sub">Seu pedido está registrado e o estoque fica reservado pelo prazo do pedido. Nenhum valor é cobrado.</p>
      </div>
    );
  }

  const pago = statusPedido && !['aguardando_pagamento', 'cancelado'].includes(statusPedido);
  const precisaGerar = vivas.length === 0 || vivas.every(c => FINAIS_RUINS.includes(c.status));
  const lojas = vivas.length || 1;

  return (
    <div className="pg-painel" data-campo="painel-pagamento">
      {config.teste && (
        <p className="pg-teste" data-campo="pagamento-teste">AMBIENTE DE TESTE · nenhum valor é cobrado{config.provedor === 'mock' ? ' · provedor simulado' : ''}</p>
      )}
      <h3>Pagamento</h3>
      {pago && <p className="pg-ok" data-campo="pagamento-aprovado">Pagamento aprovado. As lojas já foram avisadas.</p>}
      {erro && <p className="ck-erro" role="alert">{erro}</p>}
      {falhas.length > 0 && (
        <div className="ck-aviso" role="alert">
          {falhas.map((f, i) => <span key={i}>{f.loja}: {f.erro}</span>)}
        </div>
      )}

      {!pago && precisaGerar && (
        <>
          <p className="ck-sub">Cada loja recebe o próprio pagamento. {lojas > 1 ? `São ${lojas} pagamentos, um por loja, no mesmo pedido.` : ''}</p>
          <div className="pg-metodos" role="radiogroup" aria-label="Forma de pagamento">
            <label className={metodo === 'pix' ? 'on' : ''}><input type="radio" checked={metodo === 'pix'} onChange={() => setMetodo('pix')} /> Pix</label>
            <label className={metodo === 'cartao' ? 'on' : ''}><input type="radio" checked={metodo === 'cartao'} onChange={() => setMetodo('cartao')} /> Cartão de crédito</label>
          </div>
          {metodo === 'pix' && (
            <button type="button" className="ck-botao principal" onClick={() => gerar()} disabled={ocupado}>
              {ocupado ? 'Gerando…' : `Gerar Pix · ${R(valorTotalCents)}`}
            </button>
          )}
          {metodo === 'cartao' && config.provedor === 'mock' && (
            <div className="pg-cartao-teste">
              <small>Cartões de teste do provedor simulado (nenhum dado de cartão é pedido):</small>
              <div className="ck-acoes">
                <button type="button" className="ck-botao principal" disabled={ocupado}
                        onClick={() => gerar({ '*': { token: 'mock_aprovar', payment_method_id: 'visa', installments: 1 } })}>Cartão de teste: aprovado</button>
                <button type="button" className="ck-botao" disabled={ocupado}
                        onClick={() => gerar({ '*': { token: 'mock_recusar', payment_method_id: 'visa', installments: 1 } })}>Cartão de teste: recusado</button>
              </div>
            </div>
          )}
          {metodo === 'cartao' && config.provedor === 'mercadopago' && config.public_key && (
            lojas > 1
              ? <p className="ck-sub">Com mais de uma loja, pague por Pix nesta versão: cada cartão vira um pagamento separado.</p>
              : <CartaoBrick publicKey={config.public_key} valorCents={valorTotalCents} aoToken={d => gerar({ '*': d })} />
          )}
        </>
      )}

      {vivas.length > 0 && (
        <ul className="pg-cobrancas">
          {vivas.map(c => (
            <li key={c.id} className="pg-cobranca" data-cobranca={c.status}>
              <div className="pg-topo">
                <b>{c.lv_seller_orders?.loja_nome ?? 'Loja'}</b>
                <em className={`pg-status s-${c.status}`}>{ROTULO_DA_COBRANCA[c.status]}</em>
              </div>
              <small>{c.metodo === 'pix' ? 'Pix' : 'Cartão'} · {R(c.valor_cents)}{c.lv_seller_orders ? ` · ${c.lv_seller_orders.numero}` : ''}</small>
              {c.metodo === 'pix' && c.status === 'aguardando_pagamento' && c.pix_qr_code && (
                <div className="pg-pix">
                  {c.pix_qr_base64 && <img src={`data:image/png;base64,${c.pix_qr_base64}`} alt="QR Code Pix" width={180} height={180} />}
                  {c.provedor === 'mock' && <small className="pg-teste-inline">Código de TESTE, sem valor: não pague.</small>}
                  <label className="ck-campo"><span>Pix copia e cola</span>
                    <textarea readOnly rows={3} value={c.pix_qr_code} data-campo="pix-copia-cola" />
                  </label>
                  <div className="ck-acoes">
                    <button type="button" className="ck-botao" onClick={() => copiar(c)}>{copiado === c.id ? 'Copiado' : 'Copiar código'}</button>
                    {c.pix_ticket_url && <a className="ck-link" href={c.pix_ticket_url} target="_blank" rel="noreferrer">Abrir no Mercado Pago</a>}
                  </div>
                  {c.expira_em && <small>Pague até {hora(c.expira_em)}. Depois disso o pedido desta loja é cancelado e o estoque volta.</small>}
                </div>
              )}
              {c.status === 'recusado' && <small className="pg-ruim">Pagamento recusado. Escolha outra forma ou tente de novo.</small>}
              {c.status === 'expirado' && <small className="pg-ruim">O prazo deste pagamento acabou.</small>}
            </li>
          ))}
        </ul>
      )}
      {aguardando && <small className="ck-sub">Atualizando o status automaticamente…</small>}
    </div>
  );
}
