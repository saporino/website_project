// Seller Central — cadastro guiado de produto.
//
// O vendedor não pode sentir que está preenchendo um ERP. Então o cadastro
// é uma conversa em cinco passos, e cada passo pergunta UMA coisa:
//   1. o que você vende      2. em que categoria      3. o básico
//   4. as características    5. preço e quantidade
//
// Nenhum campo de característica é fixo no formulário. Eles saem dos
// atributos que a categoria declara no banco — é por isso que um moedor
// nunca recebe "pontuação SCA", e é por isso que acrescentar um atributo
// novo ao catálogo não exige mexer nesta tela.
//
// E o banco confere de novo: `lv_salvar_produto` só grava atributo que a
// categoria admite, mesmo que alguém mande outro pela API.
import { useEffect, useMemo, useState } from 'react';
import { navegar, rota } from '../config';
import { montarEscada, type Faixa, type TipoDeFaixa } from '../escada';
import { completudeDoPassport } from '../passaporte';
import { reais } from '../visual';
import { ICONES_CATEGORIA } from '../svg';
import {
  carregarProduto, salvarProduto, publicarProduto, ehCategoriaDeCafe, SITUACAO,
  type CategoriaDoCadastro, type AtributoDaCategoria,
} from './dados';
import { paraCentavos, deCentavos, paraBps, deBps } from './dinheiro';
import { mensagemDePublicacao } from './ProdutosDoVendedor';
import type { LojaDoVendedor } from './sessao';
import type { Avisar } from './SellerCentral';

const PASSOS = ['O que vende', 'Categoria', 'Básico', 'Características', 'Preço e quantidade'];

// Pedidos já no passo 3, quando a categoria os tem: são o que qualquer
// comprador de café procura primeiro.
const NO_BASICO = ['classificacao', 'torra', 'moagem'];
// "peso" é coluna do produto E atributo do Passport. Um campo só na tela,
// gravado nos dois lugares, para o vendedor não digitar duas vezes.
const ESPELHADOS = ['peso'];

const GRUPOS: { titulo: string; ajuda: string; chaves: string[] }[] = [
  {
    titulo: 'Perfil do café',
    ajuda: 'O que o café é.',
    chaves: ['especie', 'variedade', 'processo', 'pontuacao', 'notas', 'certificacoes', 'data_torra'],
  },
  {
    titulo: 'Origem',
    ajuda: 'De onde ele vem. Informe só o que você sabe: nada disto é obrigatório para café tradicional.',
    chaves: ['origem', 'regiao', 'fazenda', 'produtor', 'safra', 'lote'],
  },
];

const ROTULO_DO_CAMPO: Record<string, string> = {
  classificacao: 'classificação', especie: 'espécie', torra: 'torra', moagem: 'moagem', peso: 'peso',
  origem: 'origem', regiao: 'região', processo: 'processo', notas: 'notas sensoriais',
  variedade: 'variedade', pontuacao: 'pontuação',
};

function CampoDeAtributo({ a, valor, aoMudar }: {
  a: AtributoDaCategoria;
  valor: string;
  aoMudar: (v: string) => void;
}) {
  if (a.tipo === 'opcao' && a.opcoes.length) {
    return (
      <div className="sc-chips" role="radiogroup" aria-label={a.rotulo}>
        {a.opcoes.map(o => (
          <button key={o} type="button" role="radio" aria-checked={valor === o}
                  className={valor === o ? 'on' : ''} onClick={() => aoMudar(valor === o ? '' : o)}>
            {o}
          </button>
        ))}
      </div>
    );
  }
  if (a.tipo === 'multiopcao' && a.opcoes.length) {
    const marcadas = new Set(valor.split(',').map(s => s.trim()).filter(Boolean));
    return (
      <div className="sc-chips" aria-label={a.rotulo}>
        {a.opcoes.map(o => (
          <button key={o} type="button" aria-pressed={marcadas.has(o)} className={marcadas.has(o) ? 'on' : ''}
                  onClick={() => {
                    const nova = new Set(marcadas);
                    if (nova.has(o)) nova.delete(o); else nova.add(o);
                    aoMudar(a.opcoes.filter(x => nova.has(x)).join(', '));
                  }}>
            {o}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="sc-com-unidade">
      <input
        type={a.tipo === 'data' ? 'date' : 'text'}
        inputMode={a.tipo === 'numero' ? 'decimal' : undefined}
        value={valor}
        onChange={e => aoMudar(e.target.value)}
      />
      {a.unidade && <span>{a.unidade}</span>}
    </div>
  );
}

export default function EditorDeProduto({ produtoId, loja, categorias, avisar }: {
  produtoId: string | null;
  loja: LojaDoVendedor;
  categorias: CategoriaDoCadastro[];
  avisar: Avisar;
}) {
  const [carregando, setCarregando] = useState(!!produtoId);
  const [passo, setPasso] = useState(produtoId ? 3 : 1);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [id, setId] = useState<string | null>(produtoId);
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState('rascunho');
  const [aprovado, setAprovado] = useState(false);
  const [notaModeracao, setNotaModeracao] = useState<string | null>(null);

  const [raiz, setRaiz] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [marca, setMarca] = useState('');
  const [descricao, setDescricao] = useState('');
  const [sku, setSku] = useState('');
  const [peso, setPeso] = useState('');
  const [preco, setPreco] = useState('');
  const [piso, setPiso] = useState('');
  const [atributos, setAtributos] = useState<Record<string, string>>({});

  const [vendaPorQuantidade, setVendaPorQuantidade] = useState(false);
  const [tipoDesconto, setTipoDesconto] = useState<TipoDeFaixa>('reais');
  const [valoresFaixa, setValoresFaixa] = useState<Record<number, string>>({ 2: '', 3: '', 4: '' });
  // Faixas acima de 4 que já existam no banco. A tela mostra 2/3/4, mas não
  // pode apagar em silêncio o que alguém configurou por outro caminho.
  const [faixasExtras, setFaixasExtras] = useState<Faixa[]>([]);

  function aplicar(p: NonNullable<Awaited<ReturnType<typeof carregarProduto>>>) {
    const cat = categorias.find(c => c.id === p.categoryId);
    setId(p.id); setSlug(p.slug); setStatus(p.status); setAprovado(p.aprovado); setNotaModeracao(p.notaModeracao);
    setRaiz(cat?.raizSlug ?? null); setCategoriaId(p.categoryId);
    setTitulo(p.titulo); setMarca(p.marca); setDescricao(p.descricao); setSku(p.sku);
    setPeso(p.pesoG ? String(p.pesoG) : ''); setPreco(deCentavos(p.precoCents)); setPiso(deCentavos(p.pisoCents));
    setAtributos(p.atributos);
    setVendaPorQuantidade(p.vendaPorQuantidade);
    const ate4 = p.faixas.filter(f => f.min_qty <= 4);
    const tipo = (ate4[0]?.tipo ?? 'reais') as TipoDeFaixa;
    setTipoDesconto(tipo);
    const valores: Record<number, string> = { 2: '', 3: '', 4: '' };
    for (const f of ate4) valores[f.min_qty] = f.tipo === 'percentual' ? deBps(f.valor) : deCentavos(f.valor);
    setValoresFaixa(valores);
    setFaixasExtras(p.faixas.filter(f => f.min_qty > 4));
  }

  useEffect(() => {
    if (!produtoId || !categorias.length) return;
    let vivo = true;
    carregarProduto(produtoId).then(p => {
      if (!vivo) return;
      if (p) aplicar(p);
      setCarregando(false);
    });
    return () => { vivo = false; };
    // aplicar depende de categorias, que é a mesma lista estável da sessão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoId, categorias]);

  const raizes = categorias.filter(c => !c.parent_id);
  const folhas = categorias.filter(c => c.parent_id && c.raizSlug === raiz);
  const categoria = categorias.find(c => c.id === categoriaId);
  const cafe = ehCategoriaDeCafe(categoria);
  const chavesDaCategoria = (categoria?.atributos ?? []).map(a => a.chave);
  const atributoPorChave = new Map((categoria?.atributos ?? []).map(a => [a.chave, a]));

  const precoCents = paraCentavos(preco);
  const pisoCents = paraCentavos(piso);

  const valoresParaSalvar = useMemo(() => {
    const v = { ...atributos };
    if (chavesDaCategoria.includes('peso')) {
      if (peso.trim()) v.peso = peso.trim(); else delete v.peso;
    }
    return v;
  }, [atributos, peso, chavesDaCategoria]);

  const passport = cafe ? completudeDoPassport(valoresParaSalvar, chavesDaCategoria) : null;

  const faixas: Faixa[] = useMemo(() => {
    const base = [2, 3, 4].map(q => {
      const bruto = valoresFaixa[q] ?? '';
      const valor = tipoDesconto === 'percentual' ? paraBps(bruto) : paraCentavos(bruto);
      return valor && valor > 0 ? { min_qty: q, tipo: tipoDesconto, valor } : null;
    }).filter((f): f is Faixa => f !== null);
    return [...base, ...faixasExtras];
  }, [valoresFaixa, tipoDesconto, faixasExtras]);

  const degraus = vendaPorQuantidade && precoCents ? montarEscada(precoCents, faixas, { pisoCents }) : [];

  const mudarAtributo = (chave: string, valor: string) =>
    setAtributos(atual => {
      const novo = { ...atual };
      if (valor.trim()) novo[chave] = valor; else delete novo[chave];
      return novo;
    });

  function podeIrPara(n: number): string | null {
    if (n >= 2 && !raiz) return 'Escolha o que você vende.';
    if (n >= 3 && !categoriaId) return 'Escolha a categoria.';
    if (n >= 4 && titulo.trim().length < 3) return 'Dê um nome ao produto.';
    if (n >= 4 && !precoCents) return 'Informe o preço.';
    return null;
  }

  function irPara(n: number) {
    const falta = podeIrPara(n);
    if (falta) { setErro(falta); return; }
    setErro(null);
    setPasso(n);
    window.scrollTo(0, 0);
  }

  async function salvar(enviarParaPublicacao: boolean) {
    const falta = podeIrPara(5);
    if (falta) { setErro(falta); return; }
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarProduto({
        id,
        store_id: loja.id,
        category_id: categoriaId!,
        titulo: titulo.trim(),
        marca, descricao, sku,
        preco_cents: precoCents,
        peso_g: peso.trim() ? Number(peso.replace(/\D/g, '')) || null : null,
        preco_minimo_cents: pisoCents,
        venda_por_quantidade: vendaPorQuantidade,
        atributos: valoresParaSalvar,
        faixas,
      });
      const statusFinal = enviarParaPublicacao ? await publicarProduto(r.id, true) : r.status;

      // Recarrega do banco: o que a tela mostra depois de salvar é o que
      // ficou gravado, não o que estava no formulário.
      const recarregado = await carregarProduto(r.id);
      if (recarregado) aplicar(recarregado);

      avisar({
        tipo: 'ok',
        texto: enviarParaPublicacao ? mensagemDePublicacao(statusFinal, loja.ativa) : 'Salvo.',
      });
      if (!produtoId) navegar(`vendedor/produtos/${r.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function despublicar() {
    if (!id) return;
    setSalvando(true);
    try {
      const novo = await publicarProduto(id, false);
      setStatus(novo);
      avisar({ tipo: 'ok', texto: mensagemDePublicacao(novo, loja.ativa) });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível despublicar.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <div className="sc-cartao">Carregando…</div>;

  const situacao = SITUACAO[status] ?? SITUACAO.rascunho;
  const noAr = status === 'ativo';

  return (
    <div className="sc-pilha">
      <div className="sc-titulo sc-titulo-com-acao">
        <div>
          <p className="sc-migalha">
            <a href={rota('vendedor/produtos')} onClick={e => { e.preventDefault(); navegar('vendedor/produtos'); }}>Produtos</a>
            {' › '}{id ? 'Editar' : 'Novo'}
          </p>
          <h1>{titulo.trim() || (id ? 'Produto' : 'Cadastrar produto')}</h1>
          {id && <span className={`sc-situacao ${situacao.classe}`}>{situacao.rotulo}</span>}
        </div>
        {noAr && loja.ativa && slug && (
          <a href={rota(`cafe/${slug}`)} className="sc-botao"
             onClick={e => { e.preventDefault(); navegar(`cafe/${slug}`); }}>
            Ver produto na loja
          </a>
        )}
      </div>

      {status === 'recusado' && notaModeracao && (
        <div className="sc-cartao sc-alerta erro">
          <b>Recusado na moderação</b>
          <p>{notaModeracao}. Corrija e envie de novo.</p>
        </div>
      )}
      {status === 'em_moderacao' && (
        <div className="sc-cartao sc-alerta aviso">
          <b>Em moderação</b>
          <p>A equipe está revisando. Você pode continuar editando; o produto entra no ar quando for aprovado.</p>
        </div>
      )}
      {noAr && aprovado && (
        <p className="sc-sub">
          Mudar o nome, a categoria ou baixar o preço pela metade manda o produto de volta para moderação.
        </p>
      )}

      <ol className="sc-passos">
        {PASSOS.map((p, i) => {
          const n = i + 1;
          return (
            <li key={p}>
              <button type="button" className={`${passo === n ? 'on' : ''}${passo > n ? ' feito' : ''}`}
                      onClick={() => irPara(n)} aria-current={passo === n ? 'step' : undefined}>
                <em>{n}</em><span>{p}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {cafe && passport && passo >= 3 && (
        <div className="sc-cartao sc-passport">
          <div className="sc-passport-topo">
            <b>LiVRE Passport</b>
            <span className="sc-medidor grande"><i style={{ width: `${passport.percentual}%` }} /></span>
            <strong>{passport.percentual}% completo</strong>
          </div>
          <p className="sc-sub">
            {passport.faltando.length === 0
              ? 'Tudo o que se espera deste tipo de café está informado.'
              : `Falta: ${passport.faltando.map(c => ROTULO_DO_CAMPO[c] ?? c).join(', ')}.`}
            {' '}Quanto mais informação real, melhor o café é representado. Campo vazio continua vazio — nunca invente.
          </p>
        </div>
      )}

      <section className="sc-cartao">
        {passo === 1 && (
          <>
            <h2>O que você está vendendo?</h2>
            <div className="sc-escolhas">
              {raizes.map(r => {
                const filhas = categorias.filter(c => c.parent_id === r.id).map(c => c.nome);
                return (
                  <button key={r.id} type="button" className={`sc-escolha${raiz === r.slug ? ' on' : ''}`}
                          onClick={() => { setRaiz(r.slug); setCategoriaId(null); setErro(null); setPasso(2); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {ICONES_CATEGORIA[r.icone ?? 'grao'] ?? ICONES_CATEGORIA.grao}
                    </svg>
                    <b>{r.nome}</b>
                    <small>{filhas.join(', ')}</small>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {passo === 2 && (
          <>
            <h2>Em qual categoria?</h2>
            <p className="sc-sub">Ela decide quais características o comprador vai ver.</p>
            <div className="sc-escolhas">
              {folhas.map(c => (
                <button key={c.id} type="button" className={`sc-escolha${categoriaId === c.id ? ' on' : ''}`}
                        onClick={() => { setCategoriaId(c.id); setErro(null); setPasso(3); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {ICONES_CATEGORIA[c.icone ?? 'grao'] ?? ICONES_CATEGORIA.grao}
                  </svg>
                  <b>{c.nome}</b>
                </button>
              ))}
            </div>
          </>
        )}

        {passo === 3 && categoria && (
          <>
            <h2>O básico</h2>
            <p className="sc-sub">Categoria: <b>{categoria.nome}</b></p>
            <div className="sc-grade-campos">
              <label className="sc-campo largo">
                <span>Nome do produto *</span>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={120}
                       placeholder="Ex.: Café Tradicional Torrado e Moído 500g" />
              </label>
              <label className="sc-campo">
                <span>Marca</span>
                <input value={marca} onChange={e => setMarca(e.target.value)} maxLength={60} />
              </label>
              <label className="sc-campo">
                <span>Preço *</span>
                <div className="sc-com-unidade prefixo"><span>R$</span>
                  <input inputMode="decimal" value={preco} onChange={e => setPreco(e.target.value)} placeholder="23,90" />
                </div>
              </label>
              {chavesDaCategoria.includes('peso') && (
                <label className="sc-campo">
                  <span>Peso</span>
                  <div className="sc-com-unidade">
                    <input inputMode="numeric" value={peso} onChange={e => setPeso(e.target.value.replace(/\D/g, ''))} placeholder="500" />
                    <span>g</span>
                  </div>
                </label>
              )}
              <label className="sc-campo">
                <span>SKU ou referência</span>
                <input value={sku} onChange={e => setSku(e.target.value)} maxLength={40} />
              </label>
            </div>

            {NO_BASICO.filter(c => atributoPorChave.has(c)).map(chave => {
              const a = atributoPorChave.get(chave)!;
              return (
                <div className="sc-campo" key={chave}>
                  <span>{a.rotulo}</span>
                  <CampoDeAtributo a={a} valor={atributos[chave] ?? ''} aoMudar={v => mudarAtributo(chave, v)} />
                </div>
              );
            })}

            <label className="sc-campo largo">
              <span>Descrição</span>
              <textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={1200}
                        placeholder="O que torna este café seu. Evite promessas de saúde." />
            </label>
          </>
        )}

        {passo === 4 && categoria && (() => {
          const usados = new Set([...NO_BASICO, ...ESPELHADOS]);
          const restantes = categoria.atributos.filter(a => !usados.has(a.chave));
          const agrupados = GRUPOS.map(g => ({ ...g, atributos: restantes.filter(a => g.chaves.includes(a.chave)) }))
            .filter(g => g.atributos.length);
          const soltos = restantes.filter(a => !GRUPOS.some(g => g.chaves.includes(a.chave)));
          return (
            <>
              <h2>Características</h2>
              <p className="sc-sub">Só aparecem aqui os campos que fazem sentido para <b>{categoria.nome}</b>.</p>
              {agrupados.map(g => (
                <fieldset key={g.titulo} className="sc-grupo">
                  <legend>{g.titulo}</legend>
                  <p className="sc-sub">{g.ajuda}</p>
                  {g.atributos.map(a => (
                    <div className="sc-campo" key={a.chave}>
                      <span>{a.rotulo}</span>
                      <CampoDeAtributo a={a} valor={atributos[a.chave] ?? ''} aoMudar={v => mudarAtributo(a.chave, v)} />
                    </div>
                  ))}
                </fieldset>
              ))}
              {soltos.length > 0 && (
                <fieldset className="sc-grupo">
                  <legend>Especificações</legend>
                  {soltos.map(a => (
                    <div className="sc-campo" key={a.chave}>
                      <span>{a.rotulo}</span>
                      <CampoDeAtributo a={a} valor={atributos[a.chave] ?? ''} aoMudar={v => mudarAtributo(a.chave, v)} />
                    </div>
                  ))}
                </fieldset>
              )}
            </>
          );
        })()}

        {passo === 5 && (
          <>
            <h2>Preço e quantidade</h2>
            <div className="sc-grade-campos">
              <label className="sc-campo">
                <span>Preço normal *</span>
                <div className="sc-com-unidade prefixo"><span>R$</span>
                  <input inputMode="decimal" value={preco} onChange={e => setPreco(e.target.value)} />
                </div>
              </label>
              <label className="sc-campo">
                <span>Preço mínimo desejado por unidade</span>
                <div className="sc-com-unidade prefixo"><span>R$</span>
                  <input inputMode="decimal" value={piso} onChange={e => setPiso(e.target.value)} placeholder="opcional" />
                </div>
              </label>
            </div>
            <p className="sc-ajuda">
              O preço mínimo serve para alertar quando uma promoção ou quantidade reduzir o preço abaixo do que você
              deseja receber por unidade. É um alerta: você continua decidindo.
            </p>

            <div className="sc-interruptor">
              <button type="button" role="switch" aria-checked={vendaPorQuantidade}
                      className={vendaPorQuantidade ? 'on' : ''} onClick={() => setVendaPorQuantidade(v => !v)}>
                <i />
              </button>
              <div>
                <b>Venda por quantidade</b>
                <p className="sc-sub">Quem leva mais pacotes paga menos por unidade. É um produto só, com um estoque só.</p>
              </div>
            </div>

            {vendaPorQuantidade && (
              <>
                <div className="sc-chips" role="radiogroup" aria-label="Tipo de desconto">
                  <button type="button" role="radio" aria-checked={tipoDesconto === 'reais'}
                          className={tipoDesconto === 'reais' ? 'on' : ''} onClick={() => setTipoDesconto('reais')}>
                    Desconto em R$ por unidade
                  </button>
                  <button type="button" role="radio" aria-checked={tipoDesconto === 'percentual'}
                          className={tipoDesconto === 'percentual' ? 'on' : ''} onClick={() => setTipoDesconto('percentual')}>
                    Desconto em %
                  </button>
                </div>

                <div className="sc-faixas">
                  {[2, 3, 4].map(q => (
                    <label key={q} className="sc-campo">
                      <span>{q} unidades</span>
                      <div className={`sc-com-unidade${tipoDesconto === 'reais' ? ' prefixo' : ''}`}>
                        {tipoDesconto === 'reais' && <span>− R$</span>}
                        <input inputMode="decimal" value={valoresFaixa[q] ?? ''}
                               onChange={e => setValoresFaixa(v => ({ ...v, [q]: e.target.value }))}
                               placeholder={tipoDesconto === 'reais' ? '1,00' : '2'} />
                        {tipoDesconto === 'percentual' && <span>%</span>}
                      </div>
                    </label>
                  ))}
                </div>

                {degraus.length > 1 && (
                  <div className="sc-previa">
                    <b className="sc-previa-titulo">Como o comprador vai ver</b>
                    <div className="sc-previa-linhas">
                      {degraus.map(d => {
                        const abaixo = d.abaixoDoPiso && pisoCents ? pisoCents - d.unitario_cents : 0;
                        return (
                          <div key={d.quantidade} className={`sc-previa-linha${d.abaixoDoPiso ? ' abaixo' : ''}`}>
                            <span className="q">{d.quantidade} {d.quantidade === 1 ? 'unidade' : 'unidades'}</span>
                            <span className="t" data-rotulo="Total">R$ {reais(d.total_cents)}</span>
                            <span className="u" data-rotulo="Por unidade">R$ {reais(d.unitario_cents)}</span>
                            <span className="e" data-rotulo="Economia">{d.economia_cents ? `R$ ${reais(d.economia_cents)}` : '—'}</span>
                            {d.abaixoDoPiso && (
                              <span className="alerta">
                                Esta faixa fica R$ {reais(abaixo)} abaixo do seu preço mínimo desejado.
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {erro && <p className="sc-erro" role="alert">{erro}</p>}

        <div className="sc-rodape-editor">
          {passo > 1 && (
            <button type="button" className="sc-botao" onClick={() => irPara(passo - 1)} disabled={salvando}>Voltar</button>
          )}
          <span className="sc-espaco" />
          {passo >= 3 && (
            <button type="button" className="sc-botao" onClick={() => salvar(false)} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          )}
          {passo >= 3 && passo < 5 && (
            <button type="button" className="sc-botao sc-botao-principal" onClick={() => irPara(passo + 1)} disabled={salvando}>
              Continuar
            </button>
          )}
          {passo === 5 && !noAr && status !== 'em_moderacao' && (
            <button type="button" className="sc-botao sc-botao-principal" onClick={() => salvar(true)} disabled={salvando}>
              {aprovado ? 'Salvar e publicar' : 'Salvar e enviar para publicação'}
            </button>
          )}
          {passo === 5 && noAr && (
            <button type="button" className="sc-botao" onClick={despublicar} disabled={salvando}>Despublicar</button>
          )}
        </div>
      </section>
    </div>
  );
}
