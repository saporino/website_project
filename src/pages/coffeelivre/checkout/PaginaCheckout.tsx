// Coffee LiVRE — checkout em seis etapas.
//
//   1 Identificação → 2 Endereço → 3 Entrega → 4 Pagamento → 5 Revisão → 6 Confirmação
//
// Ao sair da identificação o banco grava o carrinho, recalcula a escada e
// RESERVA o estoque por tempo limitado. Daí em diante toda conta que aparece
// na tela vem do servidor (lv_calcular_checkout), e o mesmo cálculo cria o
// pedido. Diferença de preço é mostrada e precisa ser aceita; nada muda calado.
//
// Frete e pagamento passam pelos provedores (provedores.ts): hoje tabela e
// pagamento de demonstração; amanhã transportadoras e Mercado Pago.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { navegar, rota } from '../config';
import { reais } from '../visual';
import { agruparPorLoja } from '../contasDoCarrinho';
import type { Carrinho } from '../usarCarrinho';
import EntrarComprador from './EntrarComprador';
import {
  ErroDoCheckout, confirmarPedido, iniciarCheckout, resumoDoCheckout,
  type CalculoDoCheckout, type FaltaDeEstoque,
} from './dados';
import { PROVEDORES, type MetodoDePagamento } from './provedores';
import { ROTULO_DA_ETIQUETA, opcaoRecomendada, type OpcaoClassificada } from './roteadorDeFrete';
import { ROTULO_DO_PEDIDO, type StatusDoPedido } from './estados';
import {
  UFS, formatarCep, semErros, validarComprador, validarEndereco,
  type Comprador, type Endereco, type ErrosDe,
} from './validacao';
import PainelDePagamento from '../pagamento/PainelDePagamento';
import './checkout.css';

type Etapa = 'identificacao' | 'endereco' | 'entrega' | 'pagamento' | 'revisao' | 'confirmacao';

const ETAPAS: { chave: Etapa; rotulo: string }[] = [
  { chave: 'identificacao', rotulo: 'Identificação' },
  { chave: 'endereco', rotulo: 'Endereço' },
  { chave: 'entrega', rotulo: 'Entrega' },
  { chave: 'pagamento', rotulo: 'Pagamento' },
  { chave: 'revisao', rotulo: 'Revisão' },
  { chave: 'confirmacao', rotulo: 'Confirmação' },
];

const R = (c: number | null | undefined) => `R$ ${reais(c ?? 0)}`;
const novaChave = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const ENDERECO_VAZIO: Endereco = {
  destinatario: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', referencia: '',
};

export default function PaginaCheckout({ carrinho }: { carrinho: Carrinho }) {
  const [etapa, setEtapa] = useState<Etapa>('identificacao');
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [calc, setCalc] = useState<CalculoDoCheckout | null>(null);
  const [faltas, setFaltas] = useState<FaltaDeEstoque[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [comprador, setComprador] = useState<Comprador>({ nome: '', telefone: '', cpf: '' });
  const [endereco, setEndereco] = useState<Endereco>(ENDERECO_VAZIO);
  const [erros, setErros] = useState<ErrosDe<Endereco> & ErrosDe<Comprador>>({});
  const [opcoes, setOpcoes] = useState<OpcaoClassificada[]>([]);
  const [frete, setFrete] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<MetodoDePagamento>('pix');
  const [resumo, setResumo] = useState<CalculoDoCheckout | null>(null);
  const [ciente, setCiente] = useState(true);
  const [pedido, setPedido] = useState<{ order_id: string; numero: string } | null>(null);
  const [statusPedido, setStatusPedido] = useState<StatusDoPedido>('aguardando_pagamento');
  const [agora, setAgora] = useState(() => Date.now());
  const chave = useRef(novaChave());

  async function carregarUsuario() {
    const { data } = await supabase.auth.getUser();
    setEmail(data.user?.email ?? null);
    const nome = (data.user?.user_metadata as { full_name?: string } | undefined)?.full_name;
    if (nome) setComprador(c => (c.nome ? c : { ...c, nome }));
  }

  useEffect(() => {
    carregarUsuario();
    window.scrollTo(0, 0);
    const t = window.setInterval(() => setAgora(Date.now()), 15000);
    return () => window.clearInterval(t);
  }, []);

  const irPara = (e: Etapa) => { setErro(null); setEtapa(e); window.scrollTo(0, 0); };

  function recomecar(mensagem: string) {
    setCalc(null); setResumo(null); setOpcoes([]); setFrete(null);
    chave.current = novaChave();
    setEtapa('identificacao');
    setErro(mensagem);
  }

  async function abrirCheckout() {
    setErro(null); setFaltas(null); setOcupado(true);
    try {
      const c = await iniciarCheckout(
        carrinho.itens.map(i => ({ variant_id: i.varianteId, quantidade: i.quantidade, unitario_cents: i.unitario_cents })),
        chave.current,
      );
      setCalc(c);
      setCiente(!(c.divergencias_de_tela?.length));
      irPara('endereco');
    } catch (e) {
      // Nada ficou reservado: a próxima tentativa é um checkout novo.
      chave.current = novaChave();
      if (e instanceof ErroDoCheckout && e.codigo === 'ESTOQUE_INSUFICIENTE') setFaltas((e.detalhe as FaltaDeEstoque[]) ?? []);
      else setErro(e instanceof Error ? e.message : 'Não foi possível abrir o checkout.');
    } finally {
      setOcupado(false);
    }
  }

  function ajustarAoEstoque() {
    for (const f of faltas ?? []) carrinho.ajustarDisponivel(f.variant_id, f.disponivel);
    setFaltas(null);
  }

  async function irParaEntrega() {
    const e = { ...validarComprador(comprador), ...validarEndereco(endereco) };
    setErros(e);
    if (!semErros(e) || !calc) return;
    setOcupado(true);
    try {
      const o = await PROVEDORES.frete.cotar(calc.checkout_id);
      setOpcoes(o);
      setFrete(f => (f && o.some(x => x.codigo === f) ? f : opcaoRecomendada(o)?.codigo ?? null));
      irPara('entrega');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível calcular a entrega.');
    } finally {
      setOcupado(false);
    }
  }

  async function irParaRevisao() {
    if (!calc || !frete) return;
    setOcupado(true);
    try {
      setResumo(await resumoDoCheckout(calc.checkout_id, frete, metodo));
      irPara('revisao');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível calcular o pedido.');
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!calc || !frete || ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const p = await confirmarPedido(calc.checkout_id, comprador, { ...endereco, destinatario: endereco.destinatario || comprador.nome }, frete, metodo);
      setPedido(p);
      setStatusPedido('aguardando_pagamento');
      carrinho.limpar();
      irPara('confirmacao');
    } catch (err) {
      if (err instanceof ErroDoCheckout && (err.codigo === 'PRECO_MUDOU' || err.codigo === 'CHECKOUT_EXPIRADO')) recomecar(err.message);
      else setErro(err instanceof Error ? err.message : 'Não foi possível confirmar o pedido.');
    } finally {
      setOcupado(false);
    }
  }

  // ------------------------------------------------------------------ telas
  const indice = ETAPAS.findIndex(x => x.chave === etapa);
  const conta = resumo ?? calc;
  const minutos = calc ? Math.max(0, Math.ceil((Date.parse(calc.expira_em) - agora) / 60000)) : null;
  const expirou = etapa !== 'confirmacao' && calc != null && minutos === 0;
  const divergencias = calc?.divergencias_de_tela ?? [];

  if (!calc && etapa !== 'confirmacao' && carrinho.itens.length === 0) {
    return (
      <main className="wrap ck">
        <h1>Fechar pedido</h1>
        <div className="ck-bloco">
          <p>Seu carrinho está vazio.</p>
          <div className="ck-acoes">
            <a className="ck-botao principal" href={rota()} onClick={e => { e.preventDefault(); navegar(''); }}>Escolher cafés</a>
            <a className="ck-link" href={rota('conta/pedidos')} onClick={e => { e.preventDefault(); navegar('conta/pedidos'); }}>Meus pedidos</a>
          </div>
        </div>
      </main>
    );
  }

  const campo = (rotulo: string, chaveCampo: keyof Endereco | keyof Comprador, valor: string, mudar: (v: string) => void,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={`ck-campo${(erros as Record<string, string>)[chaveCampo] ? ' invalido' : ''}`}>
      <span>{rotulo}</span>
      <input value={valor} onChange={e => mudar(e.target.value)} {...extra} />
      {(erros as Record<string, string>)[chaveCampo] && <small>{(erros as Record<string, string>)[chaveCampo]}</small>}
    </label>
  );

  return (
    <main className="wrap ck">
      <h1>{etapa === 'confirmacao' ? 'Pedido recebido' : 'Fechar pedido'}</h1>
      <ol className="ck-etapas" aria-label="Etapas do checkout">
        {ETAPAS.map((x, i) => (
          <li key={x.chave} className={i === indice ? 'on' : i < indice ? 'feito' : ''} aria-current={i === indice ? 'step' : undefined}>
            <span>{i + 1}</span> {x.rotulo}
          </li>
        ))}
      </ol>

      {erro && <p className="ck-erro" role="alert">{erro}</p>}
      {expirou && (
        <div className="ck-aviso" role="alert">
          O tempo de reserva acabou e o estoque foi devolvido.
          <button type="button" className="ck-link" onClick={() => recomecar('Abra o checkout de novo para reservar o estoque.')}>Recomeçar</button>
        </div>
      )}

      <div className="ck-grade">
        <section className="ck-principal">
          {etapa === 'identificacao' && (
            email === undefined ? <p className="ck-sub">Carregando…</p>
              : email === null ? <EntrarComprador titulo="Identificação" aoEntrar={carregarUsuario} />
              : (
                <div className="ck-bloco">
                  <h2>Identificação</h2>
                  <p className="ck-sub">Comprando como <b>{email}</b>.</p>
                  {faltas && (
                    <div className="ck-faltas" role="alert" data-campo="faltas">
                      <b>Não há estoque para parte do carrinho.</b>
                      <ul>
                        {faltas.map(f => {
                          const item = carrinho.itens.find(i => i.varianteId === f.variant_id);
                          return (
                            <li key={f.variant_id}>
                              {item?.titulo ?? 'Item'}: você pediu {f.pedida}, {f.disponivel === 0 ? 'não há nenhuma unidade' : `há ${f.disponivel}`}
                              {f.motivo === 'fora_do_ar' ? ' (saiu da vitrine)' : ''}.
                            </li>
                          );
                        })}
                      </ul>
                      <button type="button" className="ck-botao" onClick={ajustarAoEstoque}>Ajustar carrinho ao estoque</button>
                    </div>
                  )}
                  <p className="ck-sub">Ao continuar, separamos o estoque do seu carrinho por alguns minutos enquanto você termina.</p>
                  <div className="ck-acoes">
                    <button type="button" className="ck-botao principal" onClick={abrirCheckout} disabled={ocupado || !!faltas}>
                      {ocupado ? 'Conferindo estoque…' : 'Continuar'}
                    </button>
                    <button type="button" className="ck-link" onClick={() => supabase.auth.signOut().then(carregarUsuario)}>Não sou eu</button>
                  </div>
                </div>
              )
          )}

          {etapa === 'endereco' && (
            <div className="ck-bloco">
              <h2>Endereço de entrega</h2>
              {divergencias.length > 0 && (
                <div className="ck-divergencia" data-campo="divergencias" role="status">
                  <b>O preço de {divergencias.length === 1 ? 'um item mudou' : 'alguns itens mudou'} desde que você colocou no carrinho:</b>
                  <ul>
                    {divergencias.map(d => (
                      <li key={d.variant_id}>{d.titulo}: você viu {R(d.unitario_visto_cents)}, o preço agora é {R(d.unitario_cents)} por pacote.</li>
                    ))}
                  </ul>
                  <small>Os totais ao lado já estão com o preço atual. Você confirma na revisão.</small>
                </div>
              )}
              <div className="ck-campos">
                {campo('Nome completo', 'nome', comprador.nome, v => setComprador({ ...comprador, nome: v }), { autoComplete: 'name' })}
                {campo('Telefone (opcional)', 'telefone', comprador.telefone, v => setComprador({ ...comprador, telefone: v }), { autoComplete: 'tel', inputMode: 'tel' })}
                {campo('CPF (opcional)', 'cpf', comprador.cpf, v => setComprador({ ...comprador, cpf: v }), { inputMode: 'numeric' })}
                {campo('CEP', 'cep', endereco.cep, v => setEndereco({ ...endereco, cep: formatarCep(v) }), { autoComplete: 'postal-code', inputMode: 'numeric' })}
                {campo('Rua', 'logradouro', endereco.logradouro, v => setEndereco({ ...endereco, logradouro: v }), { autoComplete: 'address-line1' })}
                {campo('Número', 'numero', endereco.numero, v => setEndereco({ ...endereco, numero: v }))}
                {campo('Complemento (opcional)', 'complemento', endereco.complemento, v => setEndereco({ ...endereco, complemento: v }))}
                {campo('Bairro', 'bairro', endereco.bairro, v => setEndereco({ ...endereco, bairro: v }))}
                {campo('Cidade', 'cidade', endereco.cidade, v => setEndereco({ ...endereco, cidade: v }), { autoComplete: 'address-level2' })}
                <label className={`ck-campo${erros.uf ? ' invalido' : ''}`}>
                  <span>UF</span>
                  <select value={endereco.uf} onChange={e => setEndereco({ ...endereco, uf: e.target.value })}>
                    <option value="">—</option>
                    {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {erros.uf && <small>{erros.uf}</small>}
                </label>
                {campo('Ponto de referência (opcional)', 'referencia', endereco.referencia, v => setEndereco({ ...endereco, referencia: v }))}
              </div>
              <p className="ck-sub">{PROVEDORES.cep.nome}: o endereço não é buscado automaticamente nesta fase.</p>
              <div className="ck-acoes">
                <button type="button" className="ck-botao principal" onClick={irParaEntrega} disabled={ocupado || expirou}>
                  {ocupado ? 'Calculando entrega…' : 'Continuar para entrega'}
                </button>
              </div>
            </div>
          )}

          {etapa === 'entrega' && (
            <div className="ck-bloco">
              <h2>Entrega</h2>
              <p className="ck-sub">Cada loja envia a sua parte. Comparamos as opções para o seu carrinho.
                {PROVEDORES.frete.demonstracao && ' Valores de uma tabela de demonstração, não de transportadora real.'}</p>
              <div className="ck-opcoes" role="radiogroup" aria-label="Opções de entrega">
                {opcoes.map(o => (
                  <label key={o.codigo} className={`ck-opcao${frete === o.codigo ? ' on' : ''}`} data-frete={o.codigo}>
                    <input type="radio" name="frete" checked={frete === o.codigo} onChange={() => setFrete(o.codigo)} />
                    <span className="ck-opcao-texto">
                      <b>{o.servico} · {o.transportadora}</b>
                      <small>até {o.prazo_dias} dias úteis · {o.entregas.map(x => `${x.loja_nome} ${R(x.frete_cents)}`).join(' + ')}</small>
                      {o.etiquetas.length > 0 && (
                        <span className="ck-etiquetas">{o.etiquetas.map(t => <em key={t} className="ck-etiqueta">{ROTULO_DA_ETIQUETA[t]}</em>)}</span>
                      )}
                    </span>
                    <b className="ck-opcao-preco">{R(o.total_cents)}</b>
                  </label>
                ))}
              </div>
              <div className="ck-acoes">
                <button type="button" className="ck-link" onClick={() => irPara('endereco')}>Voltar</button>
                <button type="button" className="ck-botao principal" onClick={() => irPara('pagamento')} disabled={!frete || expirou}>Continuar para pagamento</button>
              </div>
            </div>
          )}

          {etapa === 'pagamento' && (
            <div className="ck-bloco">
              <h2>Pagamento</h2>
              <div className="ck-opcoes" role="radiogroup" aria-label="Forma de pagamento">
                {PROVEDORES.pagamento.metodos().map(m => (
                  <label key={m.metodo} className={`ck-opcao${metodo === m.metodo ? ' on' : ''}`}>
                    <input type="radio" name="pagamento" checked={metodo === m.metodo} onChange={() => setMetodo(m.metodo)} />
                    <span className="ck-opcao-texto"><b>{m.rotulo}</b><small>{m.descricao}</small></span>
                  </label>
                ))}
              </div>
              <p className="ck-sub">Nenhuma cobrança real é feita nesta fase. Nenhum dado de cartão é pedido.</p>
              <div className="ck-acoes">
                <button type="button" className="ck-link" onClick={() => irPara('entrega')}>Voltar</button>
                <button type="button" className="ck-botao principal" onClick={irParaRevisao} disabled={ocupado || expirou}>
                  {ocupado ? 'Calculando…' : 'Revisar pedido'}
                </button>
              </div>
            </div>
          )}

          {etapa === 'revisao' && resumo && (
            <div className="ck-bloco">
              <h2>Revisão</h2>
              {minutos != null && <p className="ck-tempo" data-campo="tempo">Estoque reservado por mais {minutos} {minutos === 1 ? 'minuto' : 'minutos'}.</p>}
              {resumo.vendedores.map(v => (
                <div className="ck-loja" key={v.seller_id} data-loja={v.loja_slug}>
                  <h3>{v.loja_nome}</h3>
                  {resumo.itens.filter(i => i.seller_id === v.seller_id).map(i => (
                    <div className="ck-item" key={i.cart_item_id}>
                      <span>{i.quantidade} × {i.titulo}{i.variante_nome ? ` · ${i.variante_nome}` : ''}</span>
                      <span>{R(i.unitario_cents)} cada{i.desconto_cents > 0 ? ` (escada: −${R(i.desconto_cents)})` : ''}</span>
                      <b>{R(i.total_cents)}</b>
                    </div>
                  ))}
                  <div className="ck-linha"><span>Entrega {v.frete ? `${v.frete.servico} · até ${v.frete.prazo_dias} dias úteis` : ''}</span><b>{R(v.frete_cents)}</b></div>
                  <div className="ck-linha forte"><span>Subtotal desta loja</span><b>{R(v.total_cents)}</b></div>
                </div>
              ))}
              <div className="ck-loja">
                <h3>Entregar para</h3>
                <p className="ck-sub">{endereco.destinatario || comprador.nome} · {endereco.logradouro}, {endereco.numero}{endereco.complemento ? ` — ${endereco.complemento}` : ''} · {endereco.bairro} · {endereco.cidade}/{endereco.uf} · CEP {formatarCep(endereco.cep)}</p>
                <h3>Pagamento</h3>
                <p className="ck-sub">{PROVEDORES.pagamento.metodos().find(m => m.metodo === metodo)?.rotulo} (simulado)</p>
              </div>
              {divergencias.length > 0 && (
                <label className="ck-ciente">
                  <input type="checkbox" checked={ciente} onChange={e => setCiente(e.target.checked)} />
                  Entendi que o preço de {divergencias.length === 1 ? 'um item mudou' : 'alguns itens mudou'} e confirmo com os valores atuais.
                </label>
              )}
              <div className="ck-acoes">
                <button type="button" className="ck-link" onClick={() => irPara('pagamento')}>Voltar</button>
                <button type="button" className="ck-botao principal" onClick={confirmar} disabled={ocupado || !ciente || expirou}>
                  {ocupado ? 'Confirmando…' : `Confirmar pedido · ${R(resumo.totais.total_cents)}`}
                </button>
              </div>
            </div>
          )}

          {etapa === 'confirmacao' && pedido && (
            <div className="ck-bloco ck-confirmado">
              <h2>Pedido <span data-campo="numero-pedido">{pedido.numero}</span></h2>
              <p>Status: <b data-campo="status-pedido">{ROTULO_DO_PEDIDO[statusPedido] ?? statusPedido}</b></p>
              <p className="ck-sub">
                Cada loja recebe a sua parte do pedido e envia separadamente. O estoque fica reservado enquanto o pagamento
                não é confirmado; se não for, o pedido é cancelado e o estoque volta.
              </p>
              {(statusPedido === 'aguardando_pagamento' || statusPedido === 'pago') && (
                <PainelDePagamento
                  orderId={pedido.order_id}
                  metodoInicial={metodo}
                  valorTotalCents={resumo?.totais.total_cents ?? 0}
                  aoMudarStatus={s => setStatusPedido(s as StatusDoPedido)}
                />
              )}
              <div className="ck-acoes">
                <a className="ck-botao principal" href={rota(`conta/pedidos/${pedido.numero}`)}
                   onClick={e => { e.preventDefault(); navegar(`conta/pedidos/${pedido.numero}`); }}>Ver pedido</a>
                <a className="ck-link" href={rota()} onClick={e => { e.preventDefault(); navegar(''); }}>Continuar comprando</a>
              </div>
            </div>
          )}
        </section>

        {etapa !== 'confirmacao' && (
          <aside className="ck-resumo" aria-label="Resumo do pedido">
            <h2>Resumo</h2>
            {conta ? (
              <>
                {conta.vendedores.map(v => (
                  <div className="ck-linha" key={v.seller_id}>
                    <span>{v.loja_nome} · {v.unidades} {v.unidades === 1 ? 'pacote' : 'pacotes'}</span>
                    <b>{R(v.subtotal_produtos_cents - v.desconto_produtos_cents)}</b>
                  </div>
                ))}
                <hr />
                <div className="ck-linha"><span>Produtos</span><b>{R(conta.totais.subtotal_produtos_cents)}</b></div>
                {conta.totais.desconto_produtos_cents > 0 && (
                  <div className="ck-linha economia"><span>Descontos da escada</span><b>− {R(conta.totais.desconto_produtos_cents)}</b></div>
                )}
                <div className="ck-linha"><span>Frete</span><b>{conta.totais.frete_definido ? R(conta.totais.frete_cents) : 'na etapa de entrega'}</b></div>
                <div className="ck-linha total" data-campo="total-resumo"><span>Total</span><b>{R(conta.totais.total_cents)}</b></div>
              </>
            ) : (
              <>
                {agruparPorLoja(carrinho.itens).map(g => (
                  <div className="ck-linha" key={g.lojaSlug}><span>{g.lojaNome} · {g.unidades}</span><b>{R(g.total_cents)}</b></div>
                ))}
                <hr />
                <div className="ck-linha total"><span>Produtos</span><b>{R(carrinho.total_cents)}</b></div>
                <small className="ck-sub">Preço e estoque são conferidos ao continuar.</small>
              </>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
