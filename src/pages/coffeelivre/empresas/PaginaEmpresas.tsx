// Coffee LiVRE para Empresas — primeira versão demonstrável do B2B.
//
// Uma cafeteria, um hotel ou um escritório diz o que precisa ("100 kg de
// tradicional 500 g moído, todo mês") e vê, na hora, as ofertas do catálogo
// que atendem: preço, R$/kg, vendedor, origem, certificação, estoque.
// Depois pede a cotação.
//
// Não é ERP nem checkout: não há crédito, cobrança recorrente nem leilão.
// A frequência é INTENÇÃO registrada; a solicitação vai para a equipe.
//
// O que o comprador vê é só vitrine pública. Piso, custo e histórico de
// preço do vendedor nunca passam por aqui.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { navegar, rota } from '../config';
import { carregarMercadoPublico } from '../vendedor/mercado';
import { precoPorKg, temAbic, type ProdutoDeMercado } from '../comparacao';
import './empresas.css';

const TIPOS: [string, string][] = [
  ['cafeteria', 'Cafeteria'], ['hotel', 'Hotel'], ['restaurante', 'Restaurante'], ['padaria', 'Padaria'],
  ['escritorio', 'Escritório'], ['cozinha_industrial', 'Cozinha industrial'], ['mercado', 'Mercado'],
  ['distribuidor', 'Distribuidor'], ['outro', 'Outro'],
];
const CLASSES = ['Tradicional', 'Extra Forte', 'Superior', 'Gourmet', 'Especial'];
const FORMATOS: [number, string][] = [[250, '250 g'], [500, '500 g'], [1000, '1 kg']];
const MOAGENS = ['Em grãos', 'Fina', 'Média', 'Grossa'];
const FREQUENCIAS: [string, string][] = [['unica', 'Compra única'], ['semanal', 'Semanal'], ['quinzenal', 'Quinzenal'], ['mensal', 'Mensal']];
const COMO_FALAR: Record<string, string> = { unica: 'uma única vez', semanal: 'toda semana', quinzenal: 'a cada 15 dias', mensal: 'todo mês' };
// Aproximação só para mostrar o volume do mês; nada é cobrado com isso.
const ENTREGAS_NO_MES: Record<string, number> = { unica: 1, semanal: 4, quinzenal: 2, mensal: 1 };
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const brl = (c: number) => `R$ ${(c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const normal = (v: string | undefined) => (v ?? '').trim().toLocaleLowerCase('pt-BR');
const kg = (g: number) => (g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function Chips({ rotulo, opcoes, valor, aoMudar }: {
  rotulo: string;
  opcoes: [string, string][];
  valor: string;
  aoMudar: (v: string) => void;
}) {
  return (
    <div className="emp-chips" role="radiogroup" aria-label={rotulo}>
      {opcoes.map(([v, r]) => (
        <button key={v} type="button" role="radio" aria-checked={valor === v} className={valor === v ? 'on' : ''}
                onClick={() => aoMudar(valor === v ? '' : v)}>
          {r}
        </button>
      ))}
    </div>
  );
}

export default function PaginaEmpresas() {
  const [mercado, setMercado] = useState<ProdutoDeMercado[] | null>(null);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [tipo, setTipo] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [email, setEmail] = useState('');
  const [classe, setClasse] = useState('');
  const [formato, setFormato] = useState('');
  const [moagem, setMoagem] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [frequencia, setFrequencia] = useState('');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    carregarMercadoPublico().then(setMercado).catch(() => setMercado([]));
  }, []);

  const quantidadeKg = Number(quantidade.replace(/\D/g, '')) || 0;
  const gramatura = Number(formato) || 0;

  const ofertas = useMemo(() => {
    if (!mercado || !classe || !gramatura) return null;
    return mercado
      .filter(p => normal(p.atributos.classificacao) === normal(classe) && p.gramaturaG === gramatura
        && (!moagem || normal(p.atributos.moagem) === normal(moagem)))
      .map(p => {
        const pacotes = quantidadeKg ? Math.ceil((quantidadeKg * 1000) / gramatura) : 0;
        const disponivel = p.disponivel ?? 0;
        return {
          produto: p,
          precoKg: precoPorKg(p.precoCents, gramatura),
          pacotes,
          cobre: pacotes > 0 && disponivel >= pacotes,
          disponivel,
          totalCents: pacotes * p.precoCents,
        };
      })
      // Primeiro quem tem estoque para a entrega; depois preço por kg.
      // Preço não é o único critério, e quem não tem o café não resolve o pedido.
      .sort((a, b) => Number(b.cobre) - Number(a.cobre) || a.precoKg - b.precoKg);
  }, [mercado, classe, gramatura, moagem, quantidadeKg]);

  async function solicitar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    if (nome.trim().length < 2) { setErro('Informe o nome da empresa.'); return; }
    if (!tipo) { setErro('Escolha o tipo de negócio.'); return; }
    if (!quantidadeKg) { setErro('Informe quantos kg você precisa.'); return; }
    if (!frequencia) { setErro('Escolha compra única ou a frequência.'); return; }
    setEnviando(true);
    const { data, error } = await supabase.rpc('lv_b2b_solicitar', {
      p: {
        nome, cnpj, cidade, uf, tipo_negocio: tipo, responsavel, email,
        classificacao: classe, gramatura_g: gramatura || null, moagem,
        consumo_mensal_kg: frequencia === 'unica' ? null : quantidadeKg * ENTREGAS_NO_MES[frequencia],
        quantidade_kg: quantidadeKg, frequencia, observacao,
      },
    });
    setEnviando(false);
    if (error) { setErro(error.message); return; }
    setEnviado((data as { id: string }).id);
    window.scrollTo(0, 0);
  }

  const resumo = quantidadeKg && frequencia
    ? `${quantidadeKg.toLocaleString('pt-BR')} kg ${COMO_FALAR[frequencia]}${frequencia !== 'unica' && ENTREGAS_NO_MES[frequencia] > 1
      ? ` — cerca de ${(quantidadeKg * ENTREGAS_NO_MES[frequencia]).toLocaleString('pt-BR')} kg por mês` : ''}`
    : null;

  if (enviado) {
    return (
      <main className="wrap pag emp">
        <section className="emp-ok" data-campo="solicitacao-enviada">
          <span className="emp-selo">Solicitação registrada</span>
          <h1>Recebemos a necessidade da {nome.trim()}</h1>
          <p>
            Pedido de cotação nº <b>{enviado.slice(0, 8).toUpperCase()}</b>
            {resumo ? <> · {resumo}</> : null}{classe ? ` · ${classe}` : ''}{gramatura ? ` ${gramatura >= 1000 ? '1 kg' : `${gramatura} g`}` : ''}{moagem ? ` · ${moagem}` : ''}.
          </p>
          <p className="emp-sub">
            Nesta fase de demonstração a equipe do Coffee LiVRE acompanha a solicitação pelo painel. A resposta direta dos
            vendedores compatíveis entra numa próxima etapa. Nada foi cobrado e nenhum crédito foi analisado.
          </p>
          <a className="emp-botao" href={rota()} onClick={ev => { ev.preventDefault(); navegar(''); }}>Voltar para a loja</a>
        </section>
      </main>
    );
  }

  return (
    <main className="wrap pag emp">
      <div className="pag-topo">
        <p className="migalha">
          <a href={rota()} onClick={e => { e.preventDefault(); navegar(''); }}>Início</a> › Para empresas
        </p>
        <h1>Coffee LiVRE para Empresas</h1>
        <p>
          Café para cafeteria, hotel, restaurante, padaria, escritório, cozinha industrial, mercado e distribuidor —
          direto de quem produz e torra. Diga o que precisa e veja quem atende.
        </p>
      </div>

      <form className="emp-grade" onSubmit={solicitar}>
        <fieldset className="emp-bloco">
          <legend>Sua empresa</legend>
          <label className="emp-campo"><span>Nome da empresa *</span>
            <input value={nome} onChange={e => setNome(e.target.value)} maxLength={120} aria-label="Nome da empresa" />
          </label>
          <div className="emp-campo"><span>Tipo de negócio *</span>
            <Chips rotulo="Tipo de negócio" opcoes={TIPOS} valor={tipo} aoMudar={setTipo} />
          </div>
          <div className="emp-linha">
            <label className="emp-campo"><span>Cidade</span>
              <input value={cidade} onChange={e => setCidade(e.target.value)} maxLength={80} aria-label="Cidade" />
            </label>
            <label className="emp-campo curto"><span>UF</span>
              <select value={uf} onChange={e => setUf(e.target.value)} aria-label="UF">
                <option value="">—</option>
                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>
          <label className="emp-campo"><span>CNPJ (opcional nesta demonstração)</span>
            <input value={cnpj} onChange={e => setCnpj(e.target.value)} inputMode="numeric" maxLength={20} placeholder="00.000.000/0000-00" aria-label="CNPJ" />
          </label>
          <div className="emp-linha">
            <label className="emp-campo"><span>Responsável</span>
              <input value={responsavel} onChange={e => setResponsavel(e.target.value)} maxLength={120} aria-label="Responsável" />
            </label>
            <label className="emp-campo"><span>E-mail</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={160} aria-label="E-mail" />
            </label>
          </div>
        </fieldset>

        <fieldset className="emp-bloco">
          <legend>O que você precisa</legend>
          <div className="emp-campo"><span>Tipo de café</span>
            <Chips rotulo="Tipo de café" opcoes={CLASSES.map(c => [c, c])} valor={classe} aoMudar={setClasse} />
          </div>
          <div className="emp-campo"><span>Formato</span>
            <Chips rotulo="Formato" opcoes={FORMATOS.map(([g, r]) => [String(g), r])} valor={formato} aoMudar={setFormato} />
          </div>
          <div className="emp-campo"><span>Moagem</span>
            <Chips rotulo="Moagem" opcoes={MOAGENS.map(m => [m, m])} valor={moagem} aoMudar={setMoagem} />
          </div>
          <label className="emp-campo"><span>Quantidade por entrega *</span>
            <div className="emp-unidade">
              <input inputMode="numeric" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="100" aria-label="Quantidade em kg" />
              <b>kg</b>
            </div>
          </label>
          <div className="emp-campo"><span>Compra única ou frequência *</span>
            <Chips rotulo="Frequência" opcoes={FREQUENCIAS} valor={frequencia} aoMudar={setFrequencia} />
          </div>
          {resumo && <p className="emp-resumo" data-campo="resumo">Você quer receber {resumo}.</p>}
          <label className="emp-campo"><span>Algo mais?</span>
            <textarea rows={2} value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={1000}
                      placeholder="Ex.: grão para espresso, entrega no início do mês" aria-label="Observação" />
          </label>
        </fieldset>

        <section className="emp-bloco emp-ofertas" aria-label="Ofertas compatíveis">
          <h2>Ofertas compatíveis</h2>
          {!classe || !gramatura ? (
            <p className="emp-sub">Escolha o tipo de café e o formato para ver quem atende.</p>
          ) : !ofertas ? (
            <p className="emp-sub">Carregando o catálogo…</p>
          ) : ofertas.length === 0 ? (
            <p className="emp-sub">Nenhum café no ar com essa combinação agora. Envie a solicitação: a equipe procura vendedores que atendam.</p>
          ) : (
            <>
              <p className="emp-sub">
                {ofertas.length} {ofertas.length === 1 ? 'oferta' : 'ofertas'}. Primeiro quem tem estoque para a entrega; depois preço por kg.
                Preços de vitrine — condição por volume sai na cotação.
              </p>
              <ul className="emp-lista">
                {ofertas.map(o => {
                  const p = o.produto;
                  const origem = p.atributos.regiao || p.atributos.origem;
                  const certificacoes = (p.atributos.certificacoes ?? '').split(',').map(c => c.trim()).filter(Boolean);
                  return (
                    <li key={p.id} className="emp-oferta" data-oferta={p.slug}>
                      <div className="emp-oferta-topo">
                        <a href={rota(`cafe/${p.slug}`)} onClick={e => { e.preventDefault(); navegar(`cafe/${p.slug}`); }}>{p.titulo}</a>
                        <small>{p.lojaNome}{origem ? ` · ${origem}` : ''}</small>
                      </div>
                      <div className="emp-oferta-selos">
                        {temAbic(p.atributos) && <span className="emp-selo">ABIC</span>}
                        {certificacoes.filter(c => normal(c) !== 'abic').map(c => <span key={c} className="emp-selo">{c}</span>)}
                      </div>
                      <dl>
                        <div><dt>Preço</dt><dd>{brl(p.precoCents)}</dd></div>
                        <div><dt>Por kg</dt><dd>{brl(o.precoKg)}</dd></div>
                        <div><dt>Estoque</dt><dd>{o.disponivel} pacotes · {kg(o.disponivel * gramatura)} kg</dd></div>
                        <div><dt>Quantidade mínima</dt><dd>A combinar na cotação</dd></div>
                        {o.pacotes > 0 && (
                          <div className="largo">
                            <dt>Para cada entrega</dt>
                            <dd>{o.pacotes} pacotes · {brl(o.totalCents)} no preço de vitrine</dd>
                          </div>
                        )}
                        <div className="largo"><dt>Prazo</dt><dd>A combinar na cotação</dd></div>
                      </dl>
                      {o.pacotes > 0 && (
                        <p className={`emp-cobertura ${o.cobre ? 'ok' : 'falta'}`}>
                          {o.cobre ? 'O estoque atual cobre esta entrega.' : 'O estoque atual não cobre esta entrega; o vendedor precisaria repor.'}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <div className="emp-enviar">
          {erro && <p className="emp-erro" role="alert">{erro}</p>}
          <button type="submit" className="emp-botao" disabled={enviando}>{enviando ? 'Enviando…' : 'Solicitar cotação'}</button>
          <p className="emp-sub">Demonstração: sem cobrança, sem análise de crédito e sem compromisso. A solicitação fica registrada para a equipe.</p>
        </div>
      </form>
    </main>
  );
}
