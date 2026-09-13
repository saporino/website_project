// Calculadora de Economia LiVRE.
//
// "Você não precisa acreditar no Coffee LiVRE. Veja a conta."
//
// A tela é progressiva: dois cartões de perguntas curtas e, assim que dá
// para calcular, a comparação. O detalhe fica atrás de "Ver cálculo
// detalhado" e cada número tem um "Como calculamos" com fonte, data e grau
// de confiança. Nenhuma tarifa está escrita aqui: tudo vem de
// `lv_tarifas_simulacao`, e a conta é do motor puro em `economia.ts`.
//
// Linguagem: "potencial", "estimado", "simulação". Nunca "garantido".
import { useEffect, useMemo, useState } from 'react';
import { paraCentavos } from '../vendedor/dinheiro';
import type { Faixa } from '../escada';
import { carregarCalculadora, type DadosDaCalculadora } from './dados';
import {
  calcularPedido, comparar, ehErro, pesoDaMensalidade, precoParaLiquido, projetar, simularEscada,
  unidadeParaFreteGratis,
  type Alvo, type Cenario, type Comparacao, type Confiabilidade, type Linha, type Plataforma,
  type ResultadoPedido, type SituacaoPiso, type Solucao,
} from './economia';
import { BENEFICIOS, FONTES_DOS_BENEFICIOS, ROTULO_DO_STATUS, type ColunaDeBeneficio } from './beneficios';
import './calculadora.css';

type Periodo = 'pedido' | 'mes' | 'ano';
type Concorrente = Exclude<Plataforma, 'coffeelivre'>;
type Atual = Concorrente | 'nenhuma';

const NOME: Record<Plataforma, string> = {
  coffeelivre: 'Coffee LiVRE', mercado_livre: 'Mercado Livre', shopee: 'Shopee', amazon: 'Amazon', magalu: 'Magalu', ifood: 'iFood',
};

// "na Magalu", "no Mercado Livre": concordância certa em cada frase.
const EM: Record<Plataforma, string> = {
  coffeelivre: 'no Coffee LiVRE', mercado_livre: 'no Mercado Livre', shopee: 'na Shopee', amazon: 'na Amazon', magalu: 'na Magalu', ifood: 'no iFood',
};

const SUBTITULO: Record<string, string> = {
  classico: 'Anúncio Clássico', premium: 'Anúncio Premium', fba: 'Logística FBA · plano Profissional', padrao: '',
};

const CONFIANCA: Record<Confiabilidade, string> = {
  verificado: 'Fonte oficial',
  fonte_secundaria: 'Fonte secundária',
  calculado: 'Calculado de fonte oficial',
  premissa: 'Premissa do estudo',
  conflitante: 'Fontes oficiais divergem',
  nao_publico: 'Não disponível publicamente',
  em_estudo: 'Em estudo',
  desatualizado: 'Desatualizado',
  nao_se_aplica: 'Não entra na conta',
  fora_da_tabela: 'Fora das faixas estudadas',
};

const PISO: Record<SituacaoPiso, string> = {
  acima: 'Acima do seu piso',
  proximo: 'Próximo do seu piso',
  abaixo: 'Abaixo do seu piso',
  indeterminado: 'Não dá para afirmar',
};

const GRAMATURAS = [
  { valor: '250', rotulo: '250 g' },
  { valor: '500', rotulo: '500 g' },
  { valor: '1000', rotulo: '1 kg' },
  { valor: 'outro', rotulo: 'Outro' },
];

const ATUAIS: { valor: Atual; rotulo: string }[] = [
  { valor: 'mercado_livre', rotulo: 'Mercado Livre' },
  { valor: 'shopee', rotulo: 'Shopee' },
  { valor: 'amazon', rotulo: 'Amazon' },
  { valor: 'magalu', rotulo: 'Magalu' },
  { valor: 'nenhuma', rotulo: 'Ainda não vendo em marketplace' },
];

const CONCORRENTES: Concorrente[] = ['mercado_livre', 'shopee', 'amazon', 'magalu'];

// Grupos da tabela, na ordem pedida: comissão, fixa, logística, pagamento, outras.
const GRUPOS: { rotulo: string; componentes: Linha['componente'][] }[] = [
  { rotulo: 'Comissão', componentes: ['comissao'] },
  { rotulo: 'Tarifa fixa', componentes: ['tarifa_fixa_pedido', 'tarifa_unidade'] },
  { rotulo: 'Logística', componentes: ['logistica_pedido', 'frete'] },
  { rotulo: 'Pagamento', componentes: ['pagamento'] },
  { rotulo: 'Outras tarifas consideradas', componentes: ['armazenagem_unidade', 'mensalidade'] },
];

// ---------------------------------------------------------------------
// Formatação — só exibição; a conta é toda em centavos inteiros.
// ---------------------------------------------------------------------
function brl(c: number): string {
  const s = (Math.abs(c) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${c < 0 ? '−' : ''}R$ ${s}`;
}
const brlSinal = (c: number) => (c > 0 ? `+${brl(c)}` : brl(c));
function pct(bps: number | null): string {
  if (bps == null) return 'Não disponível';
  return `${(bps / 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
const inteiroDe = (t: string) => { const d = t.replace(/\D/g, ''); return d ? Number(d) : null; };
const data = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

/** Soma de um grupo: ausente = R$ 0,00 (não faz parte); qualquer nulo = não disponível. */
function somaDoGrupo(r: ResultadoPedido, componentes: Linha['componente'][]): number | null {
  const linhas = r.linhas.filter(l => componentes.includes(l.componente));
  if (linhas.some(l => l.valorCents == null)) return null;
  return linhas.reduce((s, l) => s + (l.valorCents ?? 0), 0);
}

const valorOuND = (v: number | null) => (v == null ? 'Não disponível' : brl(v));

// ---------------------------------------------------------------------
interface Entrada {
  plataforma: Plataforma;
  alvo: Alvo;
  resultado: ResultadoPedido;
}

interface Calculo {
  daAtual: Entrada | null;
  livre: Entrada | null;
  economia: { mes: Comparacao; ano: Comparacao } | null;
}

export default function CalculadoraEconomia({ planoId, aoEscolherPlano, aoVerPlanos, aoQuererVender }: {
  planoId: string | null;
  aoEscolherPlano: (id: string) => void;
  aoVerPlanos: () => void;
  aoQuererVender: () => void;
}) {
  const [dados, setDados] = useState<DadosDaCalculadora | null>(null);
  const [falhou, setFalhou] = useState(false);

  const [preco, setPreco] = useState('');
  const [gramatura, setGramatura] = useState('500');
  const [gramaturaOutra, setGramaturaOutra] = useState('');
  const [piso, setPiso] = useState('');
  const [volume, setVolume] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [atual, setAtual] = useState<Atual>('mercado_livre');
  const [modalidadeML, setModalidadeML] = useState<'classico' | 'premium'>('classico');
  const [pagamento, setPagamento] = useState<'cartao' | 'pix'>('cartao');
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [detalhado, setDetalhado] = useState(false);
  const [fontesAbertas, setFontesAbertas] = useState<Plataforma | null>(null);
  const [descontos, setDescontos] = useState<Record<number, string>>({ 2: '', 3: '', 4: '', 5: '' });

  useEffect(() => {
    carregarCalculadora().then(setDados).catch(() => setFalhou(true));
  }, []);

  const planos = dados?.planos ?? [];
  const plano = planos.find(p => p.id === planoId) ?? planos[0] ?? null;

  const precoCents = paraCentavos(preco);
  const pisoCents = piso.trim() ? paraCentavos(piso) : null;
  const gramaturaG = gramatura === 'outro' ? inteiroDe(gramaturaOutra) : Number(gramatura);
  const volumeMensal = inteiroDe(volume);
  const pisoInvalido = !!piso.trim() && pisoCents == null;
  const pronto = !!dados && !!plano && !!precoCents && !!gramaturaG && volumeMensal != null && !pisoInvalido;

  const calculo = useMemo(() => {
    if (!pronto || !dados || !plano || !precoCents || !gramaturaG || volumeMensal == null) return null;
    const { regras, premissas } = dados;
    const cenario: Cenario = { precoCents, gramaturaG, quantidade, volumeMensal, pisoCents, pagamento };

    const alvos: { plataforma: Plataforma; alvo: Alvo }[] = [
      ...CONCORRENTES.map(p => ({
        plataforma: p,
        alvo: { plataforma: p, modalidade: p === 'mercado_livre' ? modalidadeML : p === 'amazon' ? 'fba' : 'padrao' } as Alvo,
      })),
      { plataforma: 'coffeelivre', alvo: { plataforma: 'coffeelivre', modalidade: plano.slug } },
    ];

    const entradas: Entrada[] = alvos.flatMap(({ plataforma, alvo }) => {
      const r = calcularPedido(regras, alvo, cenario, premissas);
      return ehErro(r) ? [] : [{ plataforma, alvo, resultado: r }];
    });

    const livre = entradas.find(e => e.plataforma === 'coffeelivre') ?? null;
    const daAtual = atual === 'nenhuma' ? null : entradas.find(e => e.plataforma === atual) ?? null;

    const economia = daAtual && livre ? {
      mes: comparar(projetar(daAtual.resultado, volumeMensal, 1, pisoCents), projetar(livre.resultado, volumeMensal, 1, pisoCents)),
      ano: comparar(projetar(daAtual.resultado, volumeMensal, 12, pisoCents), projetar(livre.resultado, volumeMensal, 12, pisoCents)),
    } : null;

    const precosDoPiso = pisoCents
      ? entradas.map(e => ({ plataforma: e.plataforma, alvo: e.alvo, solucao: precoParaLiquido(regras, e.alvo, cenario, pisoCents, premissas) }))
      : [];

    const equivalente: Solucao | null = daAtual && livre && daAtual.resultado.completo
      ? precoParaLiquido(regras, livre.alvo, cenario, daAtual.resultado.liquidoUnidadeCents, premissas)
      : null;

    const faixas: Faixa[] = [2, 3, 4, 5].flatMap(q => {
      const v = paraCentavos(descontos[q] ?? '');
      return v && v > 0 ? [{ min_qty: q, tipo: 'reais' as const, valor: v }] : [];
    });
    const escada = livre ? simularEscada(regras, livre.alvo, { ...cenario, quantidade: 1 }, faixas, 5, premissas) : [];

    const datas = regras.filter(r => r.natureza === 'benchmark' && r.verificado_em).map(r => r.verificado_em!).sort();
    const verificadoEm = datas.length ? datas[datas.length - 1] : null;
    const freteGratisMagalu = unidadeParaFreteGratis(regras, { plataforma: 'magalu', modalidade: 'padrao' }, precoCents, quantidade);

    return { entradas, livre, daAtual, economia, precosDoPiso, equivalente, escada, verificadoEm, freteGratisMagalu, premissas };
  }, [pronto, dados, plano, precoCents, gramaturaG, quantidade, volumeMensal, pisoCents, pagamento, modalidadeML, atual, descontos]);

  function preencherExemplo() {
    setPreco('23,90'); setGramatura('500'); setPiso('19,00'); setVolume('1.000'); setQuantidade(1); setAtual('mercado_livre');
  }

  if (falhou) {
    return <section className="calc" id="calculadora"><p className="calc-aviso">Não foi possível carregar a calculadora agora.</p></section>;
  }

  const meses = periodo === 'ano' ? 12 : 1;
  const nomePeriodo = periodo === 'pedido' ? 'por pedido' : periodo === 'mes' ? 'por mês' : 'por ano';

  // Ordem dos cartões: a plataforma atual primeiro, os outros concorrentes,
  // e o Coffee LiVRE por último — comparar é olhar de onde se parte.
  const ordenadas = calculo ? [
    ...calculo.entradas.filter(e => e.plataforma === atual),
    ...calculo.entradas.filter(e => e.plataforma !== atual && e.plataforma !== 'coffeelivre'),
    ...calculo.entradas.filter(e => e.plataforma === 'coffeelivre'),
  ] : [];

  return (
    <section className="calc" id="calculadora" aria-labelledby="calc-titulo">
      <header className="calc-topo">
        <span className="calc-selo">Calculadora</span>
        <h2 id="calc-titulo">Calculadora de Economia LiVRE</h2>
        <p className="calc-chamada">Descubra quanto realmente sobra para você em cada venda.</p>
        <p className="calc-sub">Compare usando os seus próprios números. Seu café pode valer mais quando a plataforma custa menos.</p>
        {!preco && (
          <button type="button" className="calc-link" onClick={preencherExemplo}>
            Preencher com um exemplo (café 500 g a R$ 23,90)
          </button>
        )}
      </header>

      <div className="calc-passos">
        <fieldset className="calc-passo">
          <legend><em>1</em> Conte sobre o seu café</legend>
          <label className="calc-campo">
            <span>Preço atual do produto</span>
            <div className="calc-dinheiro"><b>R$</b>
              <input inputMode="decimal" value={preco} onChange={e => setPreco(e.target.value)} placeholder="23,90" aria-label="Preço atual do produto" />
            </div>
          </label>
          <div className="calc-campo">
            <span>Peso / apresentação</span>
            <div className="calc-chips" role="radiogroup" aria-label="Peso / apresentação">
              {GRAMATURAS.map(g => (
                <button key={g.valor} type="button" role="radio" aria-checked={gramatura === g.valor}
                        className={gramatura === g.valor ? 'on' : ''} onClick={() => setGramatura(g.valor)}>
                  {g.rotulo}
                </button>
              ))}
            </div>
            {gramatura === 'outro' && (
              <div className="calc-dinheiro calc-gramas">
                <input inputMode="numeric" value={gramaturaOutra} onChange={e => setGramaturaOutra(e.target.value)} placeholder="340" aria-label="Gramatura em gramas" />
                <b>g</b>
              </div>
            )}
          </div>
          <label className="calc-campo">
            <span>Piso líquido desejado por unidade</span>
            <div className="calc-dinheiro"><b>R$</b>
              <input inputMode="decimal" value={piso} onChange={e => setPiso(e.target.value)} placeholder="19,00" aria-label="Piso líquido desejado por unidade" />
            </div>
            <small>É o valor mínimo que você deseja receber por unidade depois das taxas consideradas nesta simulação.</small>
            {pisoInvalido && <small className="calc-erro">Confira o valor do piso.</small>}
          </label>
        </fieldset>

        <fieldset className="calc-passo">
          <legend><em>2</em> Conte sobre suas vendas</legend>
          <label className="calc-campo">
            <span>Quantos pacotes você vende ou pretende vender por mês?</span>
            <div className="calc-dinheiro">
              <input inputMode="numeric" value={volume} onChange={e => setVolume(e.target.value)} placeholder="1.000" aria-label="Pacotes por mês" />
              <b>pacotes</b>
            </div>
          </label>
          <div className="calc-campo">
            <span>Média de pacotes por pedido</span>
            <div className="calc-chips" role="radiogroup" aria-label="Média de pacotes por pedido">
              {[1, 2, 3, 4, 5].map(q => (
                <button key={q} type="button" role="radio" aria-checked={quantidade === q}
                        className={quantidade === q ? 'on' : ''} onClick={() => setQuantidade(q)}>
                  {q}
                </button>
              ))}
            </div>
            <small>Tarifa fixa e logística mudam muito quando vários pacotes vão no mesmo pedido.</small>
          </div>
          <div className="calc-campo">
            <span>Onde você vende hoje</span>
            <div className="calc-chips" role="radiogroup" aria-label="Plataforma atual">
              {ATUAIS.map(a => (
                <button key={a.valor} type="button" role="radio" aria-checked={atual === a.valor}
                        className={atual === a.valor ? 'on' : ''} onClick={() => setAtual(a.valor)}>
                  {a.rotulo}
                </button>
              ))}
            </div>
          </div>
          {planos.length > 0 && (
            <div className="calc-campo">
              <span>Plano do Coffee LiVRE para comparar</span>
              <div className="calc-chips" role="radiogroup" aria-label="Plano do Coffee LiVRE">
                {planos.map(p => (
                  <button key={p.id} type="button" role="radio" aria-checked={plano?.id === p.id}
                          className={plano?.id === p.id ? 'on' : ''} onClick={() => aoEscolherPlano(p.id)}>
                    {p.nome}
                  </button>
                ))}
              </div>
              <small>Valores ilustrativos da fase de apresentação.</small>
            </div>
          )}
        </fieldset>
      </div>

      {!dados ? (
        <p className="calc-aviso">Carregando as regras de tarifa…</p>
      ) : !calculo ? (
        <p className="calc-aviso">Preencha preço, apresentação e volume para ver a comparação.</p>
      ) : (
        <div className="calc-resultado">
          <div className="calc-resultado-topo">
            <h3><em>3</em> Veja a comparação</h3>
            <div className="calc-alternar" role="radiogroup" aria-label="Período">
              {(['pedido', 'mes', 'ano'] as Periodo[]).map(p => (
                <button key={p} type="button" role="radio" aria-checked={periodo === p}
                        className={periodo === p ? 'on' : ''} onClick={() => setPeriodo(p)}>
                  {p === 'pedido' ? 'Por pedido' : p === 'mes' ? 'Por mês' : 'Por ano'}
                </button>
              ))}
            </div>
          </div>
          <p className="calc-legenda">
            Pedido com <b>{quantidade} {quantidade === 1 ? 'pacote' : 'pacotes'}</b> de {gramaturaG} g a {brl(precoCents!)} cada
            {volumeMensal ? <> · {volumeMensal.toLocaleString('pt-BR')} pacotes por mês</> : <> · sem volume mensal informado</>}.
          </p>

          <SeuCenario calculo={calculo} atual={atual} planoNome={plano!.nome} planoMensalidade={plano!.mensalidadeCents}
                      volume={volumeMensal!} quantidade={quantidade} />

          <div className="calc-cartoes">
            {ordenadas.map(e => (
              <CartaoPlataforma
                key={e.plataforma}
                entrada={e}
                periodo={periodo}
                meses={meses}
                nomePeriodo={nomePeriodo}
                volume={volumeMensal!}
                pisoCents={pisoCents}
                destaque={e.plataforma === 'coffeelivre' ? 'livre' : e.plataforma === atual ? 'atual' : null}
                subtitulo={e.plataforma === 'coffeelivre' ? plano!.nome : SUBTITULO[e.alvo.modalidade] ?? ''}
                fontesAbertas={fontesAbertas === e.plataforma}
                aoAlternarFontes={() => setFontesAbertas(fontesAbertas === e.plataforma ? null : e.plataforma)}
                pesoEmbalagemG={calculo.premissas.pesoEmbalagemG}
                gramaturaG={gramaturaG!}
                extra={
                  e.plataforma === 'mercado_livre' ? (
                    <div className="calc-mini-alternar" role="radiogroup" aria-label="Tipo de anúncio no Mercado Livre">
                      {(['classico', 'premium'] as const).map(m => (
                        <button key={m} type="button" role="radio" aria-checked={modalidadeML === m}
                                className={modalidadeML === m ? 'on' : ''} onClick={() => setModalidadeML(m)}>
                          {m === 'classico' ? 'Clássico' : 'Premium'}
                        </button>
                      ))}
                    </div>
                  ) : e.plataforma === 'coffeelivre' ? (
                    <>
                      <div className="calc-mini-alternar" role="radiogroup" aria-label="Pagamento do comprador">
                        {(['cartao', 'pix'] as const).map(m => (
                          <button key={m} type="button" role="radio" aria-checked={pagamento === m}
                                  className={pagamento === m ? 'on' : ''} onClick={() => setPagamento(m)}>
                            {m === 'cartao' ? 'Cartão à vista' : 'Pix'}
                          </button>
                        ))}
                      </div>
                      <p className="calc-nota">Frete calculado separadamente. Valores ilustrativos da fase de apresentação.</p>
                    </>
                  ) : e.plataforma === 'magalu' && calculo.freteGratisMagalu ? (
                    <p className="calc-nota destaque">
                      Com mais 1 unidade o comprador alcançaria o frete grátis da Magalu nesta simulação
                      (a partir de {brl(calculo.freteGratisMagalu)}). Daí em diante entra uma coparticipação sua no frete que a Magalu não publica.
                    </p>
                  ) : null
                }
              />
            ))}
          </div>

          <PrecoDoPiso itens={calculo.precosDoPiso} pisoCents={pisoCents} quantidade={quantidade} precoAtual={precoCents!} planoNome={plano!.nome} />

          {calculo.daAtual && calculo.livre && (
            <PrecoEquivalente atual={calculo.daAtual} livre={calculo.livre} solucao={calculo.equivalente}
                              precoAtual={precoCents!} planoNome={plano!.nome} />
          )}

          <section className="calc-bloco">
            <h4>Quer vender mais sem ultrapassar seu piso?</h4>
            <p className="calc-sub">
              Simule a escada de quantidade no {plano!.nome}: diga quanto tiraria de cada pacote ao levar mais. Nada é sugerido — você decide.
            </p>
            <div className="calc-descontos">
              {[2, 3, 4, 5].map(q => (
                <label key={q} className="calc-campo">
                  <span>{q} pacotes</span>
                  <div className="calc-dinheiro"><b>− R$</b>
                    <input inputMode="decimal" value={descontos[q]} placeholder="0,00" aria-label={`Desconto por pacote levando ${q}`}
                           onChange={e => setDescontos(d => ({ ...d, [q]: e.target.value }))} />
                  </div>
                </label>
              ))}
            </div>
            <div className="calc-rolagem">
              <table className="calc-escada">
                <thead><tr><th>Pacotes</th><th>Preço por pacote</th><th>Total do pedido</th><th>Líquido por pacote</th><th>Seu piso</th></tr></thead>
                <tbody>
                  {calculo.escada.map(d => (
                    <tr key={d.quantidade}>
                      <td>{d.quantidade}</td>
                      <td>{brl(d.unitarioCents)}</td>
                      <td>{brl(d.totalCents)}</td>
                      <td>{d.resultado.completo ? '' : 'até '}{brl(d.resultado.liquidoUnidadeCents)}</td>
                      <td>{d.resultado.piso ? <SeloPiso situacao={d.resultado.piso.situacao} /> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="calc-acoes-detalhe">
            <button type="button" className="calc-botao" aria-expanded={detalhado} onClick={() => setDetalhado(v => !v)}>
              {detalhado ? 'Esconder cálculo detalhado' : 'Ver cálculo detalhado'}
            </button>
          </div>
          {detalhado && (
            <TabelaDetalhada entradas={ordenadas} volume={volumeMensal!} pisoCents={pisoCents} planoNome={plano!.nome} />
          )}

          <Beneficios />

          {/* div, não footer: o CSS do Coffee LiVRE pinta todo footer de laranja. */}
          <div className="calc-rodape">
            <p>
              Simulação baseada nas regras públicas verificadas em {data(calculo.verificadoEm)}. Os valores podem mudar.
              Confira as condições atuais da plataforma antes de tomar uma decisão comercial. Valores do Coffee LiVRE são
              ilustrativos da fase de apresentação, não tarifa contratual. Impostos, custo do café e embalagem não entram na conta.
            </p>
            <p className="calc-frase">Você entende de café. O Coffee LiVRE entende de vender.</p>
            <div className="calc-cta">
              <button type="button" className="calc-botao principal" onClick={aoQuererVender}>Quero vender melhor no Coffee LiVRE</button>
              <button type="button" className="calc-botao" onClick={aoVerPlanos}>Conhecer os planos</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
function SeloPiso({ situacao }: { situacao: SituacaoPiso }) {
  return <span className={`calc-piso ${situacao}`}>{PISO[situacao]}</span>;
}

function CartaoPlataforma({
  entrada, periodo, meses, nomePeriodo, volume, pisoCents, destaque, subtitulo, extra,
  fontesAbertas, aoAlternarFontes, pesoEmbalagemG, gramaturaG,
}: {
  entrada: Entrada;
  periodo: Periodo;
  meses: number;
  nomePeriodo: string;
  volume: number;
  pisoCents: number | null;
  destaque: 'atual' | 'livre' | null;
  subtitulo: string;
  extra: React.ReactNode;
  fontesAbertas: boolean;
  aoAlternarFontes: () => void;
  pesoEmbalagemG: number;
  gramaturaG: number;
}) {
  const r = entrada.resultado;
  const p = projetar(r, volume, meses, pisoCents);
  const venda = periodo === 'pedido' ? r.vendaCents : p.vendaCents;
  const custo = periodo === 'pedido' ? r.custoConhecidoCents : p.custoCents;
  const liquido = periodo === 'pedido' ? r.liquidoCents : p.liquidoCents;
  const ate = r.completo ? '' : 'até ';
  const fatiaLiquida = r.completo && r.vendaCents > 0 ? Math.max(0, Math.min(100, Math.round((r.liquidoCents * 100) / r.vendaCents))) : null;

  return (
    <article className={`calc-cartao${destaque ? ` ${destaque}` : ''}`} data-plataforma={entrada.plataforma}>
      <header>
        <div>
          <b>{NOME[entrada.plataforma]}</b>
          {subtitulo && <small>{subtitulo}</small>}
        </div>
        {destaque === 'atual' && <span className="calc-marca">Onde você vende</span>}
        {destaque === 'livre' && <span className="calc-marca livre">Em estudo</span>}
      </header>

      {extra}

      <dl className="calc-numeros">
        <div><dt>Venda {nomePeriodo}</dt><dd>{brl(venda)}</dd></div>
        <div><dt>Custos {nomePeriodo}</dt><dd>{r.completo ? brl(custo) : <>{brl(custo)} <small>+ não disponível</small></>}</dd></div>
        <div className="grande"><dt>Você recebe {nomePeriodo}</dt><dd data-campo="liquido">{ate}{brl(liquido)}</dd></div>
        <div><dt>Por pacote</dt><dd data-campo="por-pacote">{ate}{brl(r.liquidoUnidadeCents)}</dd></div>
        <div><dt>Carga efetiva</dt><dd>{pct(r.cargaBps)}</dd></div>
      </dl>

      {fatiaLiquida != null && (
        <div className="calc-barra" aria-label={`De cada R$ 100 vendidos, R$ ${fatiaLiquida} ficam com você`}>
          <i style={{ width: `${fatiaLiquida}%` }} />
          <small>De cada R$ 100 vendidos, ficam R$ {fatiaLiquida} com você.</small>
        </div>
      )}
      {!r.completo && (
        <p className="calc-nota">Parte do custo não é pública nesta faixa: o valor real que você recebe é menor que o mostrado.</p>
      )}

      {r.piso && pisoCents != null && (
        <div className={`calc-piso-bloco ${r.piso.situacao}`}>
          <SeloPiso situacao={r.piso.situacao} />
          <p>
            <span>Você recebe {ate}<b>{brl(r.liquidoUnidadeCents)}</b></span> · <span>seu piso <b>{brl(pisoCents)}</b></span> ·{' '}
            <span>diferença <b>{brlSinal(r.piso.diferencaUnidadeCents)}</b> por pacote</span>
          </p>
          {volume > 0 && r.piso.situacao !== 'indeterminado' && (
            <p className="calc-impacto">
              <span>por pedido {brlSinal(r.piso.diferencaUnidadeCents * r.quantidade)}</span> ·{' '}
              <span>por mês {brlSinal(r.piso.diferencaUnidadeCents * volume)}</span> ·{' '}
              <span>por ano {brlSinal(r.piso.diferencaUnidadeCents * volume * 12)}</span>
              {!r.completo && ' (no mínimo)'}
            </p>
          )}
        </div>
      )}

      <button type="button" className="calc-link" aria-expanded={fontesAbertas} onClick={aoAlternarFontes}>
        {fontesAbertas ? 'Fechar' : 'Como calculamos'}
      </button>
      {fontesAbertas && (
        <div className="calc-fontes">
          <ul>
            {r.linhas.map(l => (
              <li key={`${l.componente}-${l.regra?.id ?? 'x'}`}>
                <div className="calc-fonte-linha">
                  <span>{l.rotulo}</span>
                  <b>{valorOuND(l.valorCents)}</b>
                </div>
                <span className={`calc-confianca ${l.confiabilidade}`}>{CONFIANCA[l.confiabilidade]}</span>
                {l.regra?.fonte && (
                  <small>
                    Fonte: {l.regra.fonte_url ? <a href={l.regra.fonte_url} target="_blank" rel="noreferrer">{l.regra.fonte}</a> : l.regra.fonte}
                    {l.regra.verificado_em && <> · verificado em {data(l.regra.verificado_em)}</>}
                  </small>
                )}
                {l.regra?.observacao && <small>{l.regra.observacao}</small>}
                {!l.regra && <small>Nenhuma faixa dos estudos cobre este pedido. Não inventamos o valor.</small>}
              </li>
            ))}
          </ul>
          <p className="calc-nota">
            Premissas: pedido de {r.quantidade} {r.quantidade === 1 ? 'pacote enviado' : 'pacotes enviados juntos, como um kit'}, como nos
            estudos de referência; peso de envio de {r.pesoEnvioG.toLocaleString('pt-BR')} g ({r.quantidade} × ({gramaturaG} g + {pesoEmbalagemG} g de embalagem)).
            Impostos, custo do café e embalagem não entram.
          </p>
        </div>
      )}
    </article>
  );
}

function textoDaComparacao(c: Comparacao): string {
  if (c.tipo === 'indeterminada') return 'Não é possível estimar';
  return `${c.tipo === 'minima' ? 'pelo menos ' : ''}${brlSinal(c.diferencaCents)}`;
}

function SeuCenario({ calculo, atual, planoNome, planoMensalidade, volume, quantidade }: {
  calculo: Pick<Calculo, 'daAtual' | 'livre' | 'economia'>;
  atual: Atual;
  planoNome: string;
  planoMensalidade: number;
  volume: number;
  quantidade: number;
}) {
  const { daAtual, livre, economia } = calculo;
  if (!livre) return null;
  if (atual === 'nenhuma' || !daAtual || !economia) {
    return (
      <section className="calc-cenario">
        <h4>Seu cenário</h4>
        <p>
          Você ainda não vende em marketplace. No {planoNome}, cada pacote deixaria {livre.resultado.completo ? '' : 'até '}
          <b>{brl(livre.resultado.liquidoUnidadeCents)}</b> com você nesta simulação. Compare abaixo com o que as outras plataformas deixariam.
        </p>
      </section>
    );
  }

  const mes = economia.mes;
  const pedidosMes = volume > 0 ? volume / quantidade : 0;
  const peso = mes.tipo !== 'indeterminada' ? pesoDaMensalidade(planoMensalidade, mes.diferencaCents) : null;
  const motivo = livre.resultado.completo
    ? ''
    : `Há valores do ${planoNome} ainda em estudo para esta apresentação.`;

  return (
    <section className="calc-cenario" aria-label="Seu cenário">
      <h4>Seu cenário</h4>
      <div className="calc-cenario-lados">
        <div>
          <small>Hoje {EM[daAtual.plataforma]}</small>
          <b>{daAtual.resultado.completo ? '' : 'até '}{brl(daAtual.resultado.liquidoUnidadeCents)}</b>
          <span>por pacote</span>
        </div>
        <div className="livre">
          <small>No Coffee LiVRE · {planoNome}</small>
          <b>{livre.resultado.completo ? '' : 'até '}{brl(livre.resultado.liquidoUnidadeCents)}</b>
          <span>por pacote</span>
        </div>
      </div>

      <h5>Quanto você poderia preservar?</h5>
      {mes.tipo === 'indeterminada' ? (
        <p className="calc-nota">Não é possível estimar a economia com segurança. {motivo}</p>
      ) : (
        <div className="calc-economia" data-campo="economia">
          <div><small>Potencial estimado por mês</small><b>{textoDaComparacao(mes)}</b></div>
          <div><small>Em 12 meses</small><b>{textoDaComparacao(economia.ano)}</b></div>
        </div>
      )}
      {mes.tipo !== 'indeterminada' && mes.diferencaCents < 0 && (
        <p className="calc-nota">Nesta simulação o Coffee LiVRE deixaria menos com você do que a plataforma atual.</p>
      )}
      {mes.tipo === 'minima' && (
        <p className="calc-nota">Parte do custo da plataforma atual não é pública; a diferença real tende a ser maior.</p>
      )}

      {planoMensalidade > 0 && (
        <div className="calc-mensalidade">
          <p>
            <b>{planoNome}:</b> {brl(planoMensalidade)}/mês.
            {mes.tipo !== 'indeterminada' && mes.diferencaCents > 0 && <> Economia potencial estimada: {brl(mes.diferencaCents)}/mês.</>}
          </p>
          {peso != null && <p>A mensalidade representa {pct(peso)} da economia simulada.</p>}
          <p>
            {pedidosMes > 0
              ? <>Custo da mensalidade por pedido: {brl(Math.round(planoMensalidade / pedidosMes))} ({Math.round(pedidosMes).toLocaleString('pt-BR')} pedidos no mês).</>
              : 'Sem vendas no mês, a mensalidade não se dilui em pedidos.'}
          </p>
        </div>
      )}
      <p className="calc-nota">Potencial, estimado, simulação — nunca garantido.</p>
    </section>
  );
}

function PrecoDoPiso({ itens, pisoCents, quantidade, precoAtual, planoNome }: {
  itens: { plataforma: Plataforma; alvo: Alvo; solucao: Solucao }[];
  pisoCents: number | null;
  quantidade: number;
  precoAtual: number;
  planoNome: string;
}) {
  if (!pisoCents) return null;
  return (
    <section className="calc-bloco" aria-label="Preço necessário para preservar o piso">
      <h4>Quanto preciso cobrar para receber meu piso?</h4>
      <p className="calc-sub">
        Menor preço por pacote que deixa {brl(pisoCents)} líquidos por pacote, em pedidos de {quantidade} {quantidade === 1 ? 'pacote' : 'pacotes'}.
      </p>
      <ul className="calc-lista-precos">
        {itens.map(i => (
          <li key={i.plataforma} data-plataforma={i.plataforma}>
            <span>{NOME[i.plataforma]}{i.plataforma === "coffeelivre" && planoNome ? <small> · {planoNome}</small> : SUBTITULO[i.alvo.modalidade] ? <small> · {SUBTITULO[i.alvo.modalidade]}</small> : null}</span>
            {i.solucao.tipo === 'preco' ? (
              <b>
                {brl(i.solucao.precoCents)}
                <small>{i.solucao.precoCents <= precoAtual ? ' · seu preço atual já cobre' : ` · ${brlSinal(i.solucao.precoCents - precoAtual)} sobre o atual`}</small>
              </b>
            ) : i.solucao.tipo === 'indeterminado' ? (
              <em>Não é possível determinar com precisão com os dados públicos disponíveis.</em>
            ) : (
              <em>Sem solução dentro das faixas simuladas.</em>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PrecoEquivalente({ atual, livre, solucao, precoAtual, planoNome }: {
  atual: Entrada;
  livre: Entrada;
  solucao: Solucao | null;
  precoAtual: number;
  planoNome: string;
}) {
  const liquido = atual.resultado.liquidoUnidadeCents;
  return (
    <section className="calc-bloco" aria-label="Preço equivalente no Coffee LiVRE">
      <h4>Por quanto eu poderia vender no Coffee LiVRE mantendo o mesmo líquido que recebo hoje?</h4>
      {!atual.resultado.completo || !solucao ? (
        <p className="calc-nota">
          Não é possível calcular: o que você recebe hoje {EM[atual.plataforma]} depende de custo que não é público nesta faixa.
        </p>
      ) : solucao.tipo !== 'preco' ? (
        <p className="calc-nota">
          {solucao.tipo === 'indeterminado'
            ? `Há valores do ${planoNome} ainda em estudo para esta gramatura; não dá para calcular com segurança.`
            : 'Sem solução dentro das faixas simuladas.'}
        </p>
      ) : (
        <>
          <div className="calc-equivalente" data-campo="equivalente">
            <div><small>Preço atual</small><b>{brl(precoAtual)}</b></div>
            <div><small>Preço LiVRE possível</small><b>{brl(solucao.precoCents)}</b></div>
            <div><small>Líquido preservado</small><b>{brl(liquido)}</b></div>
            <div>
              <small>Redução possível para o consumidor</small>
              <b>{solucao.precoCents < precoAtual ? brl(precoAtual - solucao.precoCents) : 'Nenhuma'}</b>
            </div>
          </div>
          <p className="calc-sub">
            {solucao.precoCents < precoAtual
              ? `Você poderia vender por ${brl(solucao.precoCents)} no ${planoNome} e manter aproximadamente ${brl(liquido)} líquidos por pacote. A diferença de custo pode ficar com você, com o comprador, ou ser dividida — quem decide é você.`
              : `Com o ${planoNome} não sobra espaço para reduzir o preço mantendo o mesmo líquido.`}
          </p>
        </>
      )}
      {livre.resultado.completo ? null : <p className="calc-nota">Valores do {planoNome} em estudo.</p>}
    </section>
  );
}

function TabelaDetalhada({ entradas, volume, pisoCents, planoNome }: {
  entradas: Entrada[];
  volume: number;
  pisoCents: number | null;
  planoNome: string;
}) {
  const linhas: { rotulo: string; valor: (e: Entrada) => React.ReactNode; forte?: boolean }[] = [
    { rotulo: 'Valor da venda', valor: e => brl(e.resultado.vendaCents) },
    ...GRUPOS.map(g => ({ rotulo: g.rotulo, valor: (e: Entrada) => valorOuND(somaDoGrupo(e.resultado, g.componentes)) })),
    { rotulo: 'Total dos custos', valor: e => (e.resultado.completo ? brl(e.resultado.custoConhecidoCents) : 'Não disponível'), forte: true },
    { rotulo: 'Líquido do pedido', valor: e => `${e.resultado.completo ? '' : 'até '}${brl(e.resultado.liquidoCents)}`, forte: true },
    { rotulo: 'Líquido por pacote', valor: e => `${e.resultado.completo ? '' : 'até '}${brl(e.resultado.liquidoUnidadeCents)}` },
    { rotulo: 'Carga efetiva', valor: e => pct(e.resultado.cargaBps) },
    { rotulo: 'Piso', valor: e => (e.resultado.piso ? PISO[e.resultado.piso.situacao] : '—') },
    {
      rotulo: 'Diferença para o piso no mês',
      valor: e => (pisoCents == null || !e.resultado.piso || e.resultado.piso.situacao === 'indeterminado'
        ? '—' : brlSinal(e.resultado.piso.diferencaUnidadeCents * volume)),
    },
    {
      rotulo: 'Diferença para o piso no ano',
      valor: e => (pisoCents == null || !e.resultado.piso || e.resultado.piso.situacao === 'indeterminado'
        ? '—' : brlSinal(e.resultado.piso.diferencaUnidadeCents * volume * 12)),
    },
  ];
  const cabecalho = (e: Entrada) => (e.plataforma === 'coffeelivre' ? `Coffee LiVRE · ${planoNome}` : NOME[e.plataforma]);

  return (
    <section className="calc-detalhe" aria-label="Cálculo detalhado">
      <p className="calc-sub">Valores por pedido. "Não disponível" quando o custo não é público ou está fora das faixas estudadas; R$ 0,00 quando não faz parte da cobrança.</p>
      <div className="calc-rolagem calc-so-largo">
        <table className="calc-tabela">
          <thead>
            <tr><th />{entradas.map(e => <th key={e.plataforma}>{cabecalho(e)}</th>)}</tr>
          </thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.rotulo} className={l.forte ? 'forte' : ''}>
                <th>{l.rotulo}</th>
                {entradas.map(e => <td key={e.plataforma}>{l.valor(e)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="calc-so-estreito">
        {entradas.map(e => (
          <div key={e.plataforma} className="calc-detalhe-cartao" data-plataforma={e.plataforma}>
            <b>{cabecalho(e)}</b>
            <dl>
              {linhas.map(l => (
                <div key={l.rotulo} className={l.forte ? 'forte' : ''}><dt>{l.rotulo}</dt><dd>{l.valor(e)}</dd></div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

const COLUNAS: { chave: ColunaDeBeneficio; rotulo: string }[] = [
  { chave: 'coffeelivre', rotulo: 'Coffee LiVRE' },
  { chave: 'mercado_livre', rotulo: 'Mercado Livre' },
  { chave: 'shopee', rotulo: 'Shopee' },
  { chave: 'amazon', rotulo: 'Amazon' },
  { chave: 'magalu', rotulo: 'Magalu' },
];

function Beneficios() {
  return (
    <section className="calc-bloco" aria-label="Além do dinheiro">
      <h4>Além do dinheiro</h4>
      <p className="calc-sub">Só marcamos recurso dos concorrentes quando os estudos sustentam. "Não encontrado" quer dizer que não achamos, não que não exista.</p>
      <div className="calc-rolagem calc-so-largo">
        <table className="calc-tabela calc-beneficios">
          <thead><tr><th />{COLUNAS.map(c => <th key={c.chave}>{c.rotulo}</th>)}</tr></thead>
          <tbody>
            {BENEFICIOS.map(b => (
              <tr key={b.recurso}>
                <th>{b.recurso}</th>
                {COLUNAS.map(c => (
                  <td key={c.chave} title={b.celulas[c.chave].nota}>
                    <span className={`calc-status ${b.celulas[c.chave].status}`}>{ROTULO_DO_STATUS[b.celulas[c.chave].status]}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="calc-so-estreito">
        {BENEFICIOS.map(b => (
          <div key={b.recurso} className="calc-detalhe-cartao">
            <b>{b.recurso}</b>
            <dl>
              {COLUNAS.map(c => (
                <div key={c.chave}>
                  <dt>{c.rotulo}</dt>
                  <dd><span className={`calc-status ${b.celulas[c.chave].status}`}>{ROTULO_DO_STATUS[b.celulas[c.chave].status]}</span></dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <p className="calc-nota">{FONTES_DOS_BENEFICIOS}</p>
    </section>
  );
}
