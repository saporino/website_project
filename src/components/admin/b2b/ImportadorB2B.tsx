// Importador do B2B Prospecção: qualquer lista → padronizada → mesclada por CNPJ.
//
// 1. arquivo (CSV, Excel com todas as abas, HTML com tabelas ou dados embutidos, JSON, XML)
// 2. tabela/aba, quando o arquivo tem mais de uma
// 3. colunas (sugestão pelo cabeçalho E pelo conteúdo; o mapeamento fica lembrado por formato)
// 4. prévia (novas × já existentes × fora) + aviso se o MESMO arquivo já foi importado
// 5. grava em lotes numa única importação; diferença de valor vira divergência para decidir na ficha.
// Nada é gravado antes da confirmação. Fonte nova só completa o vazio; nunca apaga.
import { useEffect, useMemo, useState } from 'react';
import { Loader2, X, Upload, AlertTriangle, History } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase';
import { impressaoDigital, lerConteudo, type Tabela } from '../../../lib/b2b/leitores';
import {
  CAMPOS, ROTULO_DO_TIPO, formatarCnpj, formatarTelefone, normalizarLinha, sugerirMapeamento, sugerirPorValores,
  type Campo, type LinhaB2B,
} from '../../../lib/b2b/normalizar';

const LOTE = 400;
const chaveDoFormato = (cab: string[]) => 'b2b_mapa_' + [...cab].sort().join('|').slice(0, 400);
const quando = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const kb = (n: number | null) => (n == null ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

interface Importacao {
  id: string; fonte: string; arquivo: string | null; arquivo_hash: string | null; arquivo_tamanho: number | null; linhas: number;
  novas: number; completadas: number; iguais: number; invalidas: number; divergencias: number; created_at: string; concluida_em: string | null;
}
type Etapa = 'arquivo' | 'tabela' | 'colunas' | 'previa' | 'gravando' | 'pronto';

export default function ImportadorB2B({ aoFechar, aoConcluir }: { aoFechar: () => void; aoConcluir: () => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [fonte, setFonte] = useState('');
  const [tabelas, setTabelas] = useState<Tabela[]>([]);
  const [tabela, setTabela] = useState<Tabela | null>(null);
  const [mapa, setMapa] = useState<Record<string, Campo | null>>({});
  const [etapa, setEtapa] = useState<Etapa>('arquivo');
  const [existentes, setExistentes] = useState<Set<string>>(new Set());
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState({ novas: 0, completadas: 0, iguais: 0, invalidas: 0, divergencias: 0 });
  const [historico, setHistorico] = useState<Importacao[]>([]);
  const [mesmoArquivo, setMesmoArquivo] = useState<Importacao | null>(null);
  const [mesmoNome, setMesmoNome] = useState<Importacao | null>(null);

  useEffect(() => {
    supabase.from('b2b_importacoes').select('*').order('created_at', { ascending: false }).limit(12)
      .then(({ data }) => setHistorico((data as Importacao[]) ?? []));
  }, []);

  async function escolher(f: File) {
    setLendo(true);
    try {
      const dados = await f.arrayBuffer();
      const [tabs, digital] = await Promise.all([lerConteudo(f.name, dados), impressaoDigital(dados)]);
      if (!tabs.length) { toast.error('Não encontrei linhas nesse arquivo.'); return; }
      setArquivo(f); setHash(digital); setTabelas(tabs);
      setFonte(f.name.replace(/\.[^.]+$/, ''));
      // Já importado? Pelo conteúdo (mesmo renomeado) e pelo nome (conteúdo pode ter mudado).
      const [{ data: porConteudo }, { data: porNome }] = await Promise.all([
        supabase.from('b2b_importacoes').select('*').eq('arquivo_hash', digital).order('created_at', { ascending: false }).limit(1),
        supabase.from('b2b_importacoes').select('*').eq('arquivo', f.name).order('created_at', { ascending: false }).limit(1),
      ]);
      const igual = (porConteudo as Importacao[] | null)?.[0] ?? null;
      const nome = (porNome as Importacao[] | null)?.[0] ?? null;
      setMesmoArquivo(igual);
      setMesmoNome(!igual && nome && nome.arquivo_hash !== digital ? nome : null);
      if (tabs.length === 1) usarTabela(tabs[0]); else setEtapa('tabela');
    } catch (e) {
      toast.error('Não consegui ler o arquivo: ' + (e instanceof Error ? e.message : ''));
    } finally { setLendo(false); }
  }

  function usarTabela(t: Tabela) {
    setTabela(t);
    let salvo: Record<string, Campo | null> | null = null;
    try { salvo = JSON.parse(localStorage.getItem(chaveDoFormato(t.cabecalhos)) ?? 'null'); } catch { salvo = null; }
    setMapa(salvo ?? sugerirPorValores(sugerirMapeamento(t.cabecalhos), t.linhas));
    setEtapa('colunas');
  }

  /** Todas as tabelas/abas com as mesmas colunas viram uma só. */
  const podeJuntar = tabelas.length > 1 && tabelas.every(t => t.cabecalhos.join('|') === tabelas[0].cabecalhos.join('|'));
  const juntarTodas = () => usarTabela({ nome: `Todas as ${tabelas.length} tabelas`, cabecalhos: tabelas[0].cabecalhos, linhas: tabelas.flatMap(t => t.linhas) });

  const linhasBrutas = tabela?.linhas ?? [];
  const normalizadas = useMemo(() => linhasBrutas.map(b => {
    const r: Partial<Record<Campo, unknown>> = {};
    for (const [col, campo] of Object.entries(mapa)) {
      if (!campo || !b[col]) continue;
      r[campo] = r[campo] ? `${r[campo]} · ${b[col]}` : b[col];
    }
    return normalizarLinha(r);
  }), [linhasBrutas, mapa]);

  const validas = normalizadas.filter(n => n.valida).map(n => n.linha);
  const cnpjInvalidos = normalizadas.filter(n => n.cnpjInvalido).length;
  const semIdentificacao = normalizadas.filter(n => !n.valida && !n.cnpjInvalido).length;
  const comCnpj = validas.filter(l => l.cnpj);
  const cnpjsUnicos = new Set(comCnpj.map(l => l.cnpj)).size;
  const semCnpj = validas.length - comCnpj.length;

  async function irParaPrevia() {
    const usados = Object.values(mapa);
    if (!usados.some(Boolean)) { toast.error('Indique ao menos uma coluna.'); return; }
    if (!usados.includes('cnpj') && !(usados.includes('municipio') && (usados.includes('razao_social') || usados.includes('nome_fantasia')))) {
      toast.error('Sem CNPJ, é preciso ter nome e município para identificar a empresa.'); return;
    }
    try { if (tabela) localStorage.setItem(chaveDoFormato(tabela.cabecalhos), JSON.stringify(mapa)); } catch { /* sem armazenamento */ }
    setLendo(true);
    const cnpjs = [...new Set(normalizadas.map(n => n.linha.cnpj).filter(Boolean) as string[])];
    const achados = new Set<string>();
    for (let i = 0; i < cnpjs.length; i += 1000) {
      const { data } = await supabase.rpc('b2b_cnpjs_existentes', { p_cnpjs: cnpjs.slice(i, i + 1000) });
      (data as string[] | null)?.forEach(c => achados.add(c));
    }
    setExistentes(achados); setLendo(false); setEtapa('previa');
  }

  async function gravar() {
    if (!fonte.trim()) { toast.error('Dê um nome para a fonte (ex.: "ABIC 2026").'); return; }
    setEtapa('gravando');
    const { data: imp, error: ei } = await supabase.rpc('b2b_importacao_iniciar', {
      p_fonte: fonte.trim(), p_arquivo: arquivo?.name ?? null, p_hash: hash, p_tamanho: arquivo?.size ?? null, p_linhas: linhasBrutas.length,
    });
    if (ei) { toast.error('Não consegui abrir a importação: ' + ei.message); setEtapa('previa'); return; }
    const total = { novas: 0, completadas: 0, iguais: 0, invalidas: 0, divergencias: 0 };
    for (let i = 0; i < validas.length; i += LOTE) {
      const { data, error } = await supabase.rpc('b2b_mesclar', {
        p_fonte: fonte.trim(), p_linhas: validas.slice(i, i + LOTE), p_arquivo: arquivo?.name ?? null, p_importacao: imp as string,
      });
      if (error) { toast.error(`Parou no lote ${i / LOTE + 1}: ${error.message}. O que já foi gravado continua.`); break; }
      const r = data as typeof total;
      (Object.keys(total) as (keyof typeof total)[]).forEach(k => { total[k] += r[k] ?? 0; });
      setProgresso(Math.min(validas.length, i + LOTE));
    }
    await supabase.rpc('b2b_importacao_concluir', { p_importacao: imp as string });
    setResultado(total); setEtapa('pronto'); aoConcluir();
  }

  const amostra: LinhaB2B[] = validas.slice(0, 8);
  const numero = (n: number) => n.toLocaleString('pt-BR');

  const aviso = (etapa === 'colunas' || etapa === 'previa' || etapa === 'tabela') && (mesmoArquivo || mesmoNome) && (
    <div className="flex gap-2 items-start rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm px-3 py-2 mb-4" data-campo="aviso-repetido">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      {mesmoArquivo ? (
        <span>
          <b>Este arquivo já foi importado</b> em {quando(mesmoArquivo.created_at)}{mesmoArquivo.arquivo && mesmoArquivo.arquivo !== arquivo?.name ? ` com o nome "${mesmoArquivo.arquivo}"` : ''} (fonte "{mesmoArquivo.fonte}"):
          {' '}{numero(mesmoArquivo.novas)} novas, {numero(mesmoArquivo.completadas)} completadas. Importar de novo não duplica nada, só confirma o que já está lá.
        </span>
      ) : mesmoNome && (
        <span>
          <b>Já existe uma importação com esse nome</b>, em {quando(mesmoNome.created_at)} (fonte "{mesmoNome.fonte}"), mas <b>o conteúdo mudou</b>. A prévia mostra o que é novo.
        </span>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={etapa === 'gravando' ? undefined : aoFechar}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl" onClick={e => e.stopPropagation()} role="dialog" aria-label="Importar lista">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="font-bold text-gray-900">Importar lista de empresas</h3>
          {etapa !== 'gravando' && <button onClick={aoFechar} aria-label="Fechar" className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>}
        </div>

        <div className="p-5">
          {aviso}

          {etapa === 'arquivo' && (
            <>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-saporino">
                {lendo ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" /> : <Upload className="w-6 h-6 text-gray-400" />}
                <span className="text-sm font-semibold text-gray-700">Escolha o arquivo</span>
                <span className="text-xs text-gray-500 text-center">CSV, Excel (todas as abas), HTML (tabelas e listas embutidas), JSON ou XML.<br />Receita, ABIC, Google, planilhas próprias: o sistema reconhece as colunas.</span>
                <input type="file" accept=".csv,.txt,.tsv,.xlsx,.xlsm,.xlsb,.xls,.ods,.html,.htm,.json,.jsonl,.ndjson,.xml" className="hidden"
                  onChange={e => e.target.files?.[0] && escolher(e.target.files[0])} />
              </label>
              {historico.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5"><History className="w-4 h-4" /> Importações anteriores</h4>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-left text-gray-500">
                        <tr>{['Quando', 'Fonte', 'Arquivo', 'Linhas', 'Novas', 'Completadas', 'Divergências'].map(h => <th key={h} className="px-2 py-1.5 whitespace-nowrap">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {historico.map(h => (
                          <tr key={h.id} className="border-t border-gray-100">
                            <td className="px-2 py-1 whitespace-nowrap">{quando(h.created_at)}</td>
                            <td className="px-2 py-1">{h.fonte}</td>
                            <td className="px-2 py-1 text-gray-500">{h.arquivo ?? '—'} {h.arquivo_tamanho ? <span className="text-gray-400">({kb(h.arquivo_tamanho)})</span> : null}</td>
                            {[h.linhas, h.novas, h.completadas, h.divergencias].map((n, i) => <td key={i} className="px-2 py-1 tabular-nums text-right">{numero(n)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {etapa === 'tabela' && (
            <div>
              <p className="text-sm text-gray-600 mb-3"><b>{arquivo?.name}</b> tem {tabelas.length} tabelas ou abas. Escolha qual importar.</p>
              <div className="space-y-2 mb-4">
                {tabelas.map((t, i) => (
                  <button key={i} onClick={() => usarTabela(t)}
                    className="w-full text-left border border-gray-200 rounded-lg px-3 py-2 hover:border-saporino">
                    <div className="text-sm font-semibold text-gray-900">{t.nome}</div>
                    <div className="text-xs text-gray-500 truncate">{numero(t.linhas.length)} linhas · colunas: {t.cabecalhos.slice(0, 8).join(', ')}{t.cabecalhos.length > 8 ? '…' : ''}</div>
                  </button>
                ))}
              </div>
              {podeJuntar && (
                <button onClick={juntarTodas} className="px-3 py-2 rounded-lg border border-saporino/40 text-saporino text-sm font-semibold hover:bg-[#f5f0ef]">
                  Importar todas juntas ({numero(tabelas.reduce((s, t) => s + t.linhas.length, 0))} linhas, mesmas colunas)
                </button>
              )}
            </div>
          )}

          {etapa === 'colunas' && tabela && (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                <b>{arquivo?.name}</b>{tabelas.length > 1 ? ` › ${tabela.nome}` : ''} · {numero(linhasBrutas.length)} linhas. Confira a que campo cada coluna corresponde. Colunas em "ignorar" não entram.
              </p>
              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500"><tr><th className="px-3 py-2">Coluna do arquivo</th><th className="px-3 py-2">Exemplo</th><th className="px-3 py-2">Vai para</th></tr></thead>
                  <tbody>
                    {tabela.cabecalhos.map(h => (
                      <tr key={h} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 font-medium text-gray-800">{h}</td>
                        <td className="px-3 py-1.5 text-gray-500 max-w-[260px] truncate">{linhasBrutas.find(b => b[h])?.[h] ?? ''}</td>
                        <td className="px-3 py-1.5">
                          <select value={mapa[h] ?? ''} onChange={e => setMapa(m => ({ ...m, [h]: (e.target.value || null) as Campo | null }))}
                            className={`px-2 py-1 rounded border text-sm ${mapa[h] ? 'border-saporino/50 text-gray-900' : 'border-gray-300 text-gray-400'}`}>
                            <option value="">ignorar</option>
                            {CAMPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEtapa(tabelas.length > 1 ? 'tabela' : 'arquivo')} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
                  {tabelas.length > 1 ? 'Trocar tabela' : 'Trocar arquivo'}
                </button>
                <button onClick={irParaPrevia} disabled={lendo} className="px-4 py-2 rounded-lg bg-saporino text-white text-sm font-semibold disabled:opacity-50">
                  {lendo ? 'Conferindo…' : 'Ver prévia'}
                </button>
              </div>
            </div>
          )}

          {etapa === 'previa' && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[['Linhas no arquivo', linhasBrutas.length], ['Empresas novas (CNPJ)', cnpjsUnicos - existentes.size],
                  ['Já existem: serão completadas', existentes.size], ['Fora: CNPJ inválido ou sem identificação', cnpjInvalidos + semIdentificacao]].map(([l, n]) => (
                  <div key={l as string} className="bg-white border border-gray-200 rounded-xl p-3">
                    <div className="text-xs text-gray-500">{l}</div>
                    <div className="text-xl font-bold text-gray-900 tabular-nums">{numero(Number(n))}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {semCnpj > 0 && <>{numero(semCnpj)} {semCnpj === 1 ? 'linha sem CNPJ será juntada' : 'linhas sem CNPJ serão juntadas'} pelo nome + cidade quando houver uma única ficha igual. </>}
                Linhas repetidas no próprio arquivo viram uma só ficha. Nada é sobrescrito: o vazio é completado e, se o arquivo trouxer um valor diferente do que já existe, a diferença fica na ficha para você decidir.
              </p>
              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-left text-gray-500"><tr>{['CNPJ', 'Nome', 'Tipo', 'Cidade/UF', 'Telefone', 'E-mail'].map(h => <th key={h} className="px-2 py-1.5">{h}</th>)}</tr></thead>
                  <tbody>
                    {amostra.map((l, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1 tabular-nums whitespace-nowrap">{l.cnpj ? formatarCnpj(l.cnpj) : '—'}</td>
                        <td className="px-2 py-1">{l.nome_fantasia || l.razao_social}</td>
                        <td className="px-2 py-1">{ROTULO_DO_TIPO[l.tipo]}</td>
                        <td className="px-2 py-1">{[l.municipio, l.uf].filter(Boolean).join('/')}</td>
                        <td className="px-2 py-1 tabular-nums whitespace-nowrap">{formatarTelefone(l.telefone)}</td>
                        <td className="px-2 py-1">{l.email ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">Nome da fonte (aparece na ficha como origem dos dados)</label>
                  <input value={fonte} onChange={e => setFonte(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm w-72" data-campo="fonte" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEtapa('colunas')} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">Voltar às colunas</button>
                  <button onClick={gravar} disabled={!validas.length} className="px-4 py-2 rounded-lg bg-saporino text-white text-sm font-semibold disabled:opacity-50">
                    {mesmoArquivo ? 'Importar de novo mesmo assim' : `Importar ${numero(validas.length)} linhas`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {etapa === 'gravando' && (
            <div className="py-6">
              <p className="text-sm text-gray-700 mb-2">Gravando… {numero(progresso)} de {numero(validas.length)}</p>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-saporino transition-all" style={{ width: `${validas.length ? (progresso / validas.length) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {etapa === 'pronto' && (
            <div className="py-4">
              <p className="text-sm text-gray-800 mb-3 font-semibold">Importação concluída — fonte "{fonte}".</p>
              <ul className="text-sm text-gray-700 space-y-1 mb-4 tabular-nums">
                <li>{numero(resultado.novas)} empresas novas</li>
                <li>{numero(resultado.completadas)} fichas existentes completadas</li>
                <li>{numero(resultado.iguais)} sem novidade</li>
                <li>{numero(resultado.divergencias)} divergências para decidir (filtro "Com divergências" na lista)</li>
                <li>{numero(resultado.invalidas)} recusadas pelo banco</li>
              </ul>
              <button onClick={aoFechar} className="px-4 py-2 rounded-lg bg-saporino text-white text-sm font-semibold">Fechar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
