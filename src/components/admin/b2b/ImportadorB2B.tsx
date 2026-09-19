// Importador do B2B Prospecção: qualquer CSV ou Excel → padronizado → mesclado por CNPJ.
//
// 1. arquivo  2. colunas (sugestão automática; o mapeamento fica lembrado por formato de arquivo)
// 3. prévia (novas × já existentes × inválidas)  4. grava em lotes via b2b_mesclar.
// Nada é gravado antes da confirmação. Fonte nova só completa o vazio; nunca apaga.
import { useMemo, useState } from 'react';
import { Loader2, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase';
import { CAMPOS, ROTULO_DO_TIPO, formatarCnpj, formatarTelefone, normalizarLinha, sugerirMapeamento, type Campo, type LinhaB2B } from '../../../lib/b2b/normalizar';

type Bruto = Record<string, unknown>;
const LOTE = 400;
const chaveDoFormato = (cab: string[]) => 'b2b_mapa_' + [...cab].sort().join('|').slice(0, 400);

async function lerArquivo(arquivo: File): Promise<{ cabecalhos: string[]; linhas: Bruto[]; abas?: string[] }> {
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith('.csv') || nome.endsWith('.txt')) {
    const Papa = (await import('papaparse')).default;
    const texto = await arquivo.text();
    const r = Papa.parse<Bruto>(texto, { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
    return { cabecalhos: r.meta.fields ?? [], linhas: r.data };
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
  const aba = wb.SheetNames[0];
  const linhas = XLSX.utils.sheet_to_json<Bruto>(wb.Sheets[aba], { defval: '', raw: false });
  const cabecalhos = linhas.length ? Object.keys(linhas[0]) : [];
  return { cabecalhos, linhas, abas: wb.SheetNames };
}

export default function ImportadorB2B({ aoFechar, aoConcluir }: { aoFechar: () => void; aoConcluir: () => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [fonte, setFonte] = useState('');
  const [cabecalhos, setCabecalhos] = useState<string[]>([]);
  const [brutas, setBrutas] = useState<Bruto[]>([]);
  const [mapa, setMapa] = useState<Record<string, Campo | null>>({});
  const [etapa, setEtapa] = useState<'arquivo' | 'colunas' | 'previa' | 'gravando' | 'pronto'>('arquivo');
  const [existentes, setExistentes] = useState<Set<string>>(new Set());
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState({ novas: 0, completadas: 0, iguais: 0, invalidas: 0 });

  async function escolher(f: File) {
    setLendo(true);
    try {
      const r = await lerArquivo(f);
      if (!r.linhas.length) { toast.error('O arquivo não tem linhas.'); return; }
      setArquivo(f); setCabecalhos(r.cabecalhos); setBrutas(r.linhas);
      setFonte(f.name.replace(/\.[^.]+$/, ''));
      let salvo: Record<string, Campo | null> | null = null;
      try { salvo = JSON.parse(localStorage.getItem(chaveDoFormato(r.cabecalhos)) ?? 'null'); } catch { salvo = null; }
      setMapa(salvo ?? sugerirMapeamento(r.cabecalhos));
      if (r.abas && r.abas.length > 1) toast.info(`Planilha com ${r.abas.length} abas: usando a primeira (${r.abas[0]}).`);
      setEtapa('colunas');
    } catch (e) {
      toast.error('Não consegui ler o arquivo: ' + (e instanceof Error ? e.message : ''));
    } finally { setLendo(false); }
  }

  const normalizadas = useMemo(() => brutas.map(b => {
    const r: Partial<Record<Campo, unknown>> = {};
    for (const [col, campo] of Object.entries(mapa)) {
      if (!campo) continue;
      r[campo] = r[campo] ? `${r[campo]} · ${b[col] ?? ''}` : b[col];
    }
    return normalizarLinha(r);
  }), [brutas, mapa]);

  const validas = normalizadas.filter(n => n.valida).map(n => n.linha);
  const cnpjInvalidos = normalizadas.filter(n => n.cnpjInvalido).length;
  const semIdentificacao = normalizadas.filter(n => !n.valida && !n.cnpjInvalido).length;
  const comCnpj = validas.filter(l => l.cnpj);
  const cnpjsUnicos = new Set(comCnpj.map(l => l.cnpj)).size;

  async function irParaPrevia() {
    if (!Object.values(mapa).some(Boolean)) { toast.error('Indique ao menos uma coluna.'); return; }
    if (!Object.values(mapa).includes('cnpj') && !(Object.values(mapa).includes('municipio') && (Object.values(mapa).includes('razao_social') || Object.values(mapa).includes('nome_fantasia')))) {
      toast.error('Sem CNPJ, é preciso ter nome e município para identificar a empresa.'); return;
    }
    try { localStorage.setItem(chaveDoFormato(cabecalhos), JSON.stringify(mapa)); } catch { /* sem armazenamento */ }
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
    const total = { novas: 0, completadas: 0, iguais: 0, invalidas: 0 };
    for (let i = 0; i < validas.length; i += LOTE) {
      const { data, error } = await supabase.rpc('b2b_mesclar', { p_fonte: fonte.trim(), p_linhas: validas.slice(i, i + LOTE), p_arquivo: arquivo?.name ?? null });
      if (error) { toast.error(`Parou no lote ${i / LOTE + 1}: ${error.message}. O que já foi gravado continua.`); break; }
      const r = data as typeof total;
      total.novas += r.novas; total.completadas += r.completadas; total.iguais += r.iguais; total.invalidas += r.invalidas;
      setProgresso(Math.min(validas.length, i + LOTE));
    }
    setResultado(total); setEtapa('pronto'); aoConcluir();
  }

  const amostra: LinhaB2B[] = validas.slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={etapa === 'gravando' ? undefined : aoFechar}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl" onClick={e => e.stopPropagation()} role="dialog" aria-label="Importar lista">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="font-bold text-gray-900">Importar lista de empresas</h3>
          {etapa !== 'gravando' && <button onClick={aoFechar} aria-label="Fechar" className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>}
        </div>

        <div className="p-5">
          {etapa === 'arquivo' && (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-saporino">
              {lendo ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" /> : <Upload className="w-6 h-6 text-gray-400" />}
              <span className="text-sm font-semibold text-gray-700">Escolha um arquivo CSV ou Excel</span>
              <span className="text-xs text-gray-400">Receita, ABIC, Google, planilhas próprias… o sistema reconhece as colunas.</span>
              <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={e => e.target.files?.[0] && escolher(e.target.files[0])} />
            </label>
          )}

          {etapa === 'colunas' && (
            <div>
              <p className="text-sm text-gray-600 mb-3"><b>{arquivo?.name}</b> · {brutas.length.toLocaleString('pt-BR')} linhas. Confira a que campo cada coluna corresponde. Colunas em "ignorar" não entram.</p>
              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500"><tr><th className="px-3 py-2">Coluna do arquivo</th><th className="px-3 py-2">Exemplo</th><th className="px-3 py-2">Vai para</th></tr></thead>
                  <tbody>
                    {cabecalhos.map(h => (
                      <tr key={h} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 font-medium text-gray-800">{h}</td>
                        <td className="px-3 py-1.5 text-gray-500 max-w-[260px] truncate">{String(brutas.find(b => b[h])?.[h] ?? '')}</td>
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
                <button onClick={() => setEtapa('arquivo')} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">Trocar arquivo</button>
                <button onClick={irParaPrevia} disabled={lendo} className="px-4 py-2 rounded-lg bg-saporino text-white text-sm font-semibold disabled:opacity-50">
                  {lendo ? 'Conferindo…' : 'Ver prévia'}
                </button>
              </div>
            </div>
          )}

          {etapa === 'previa' && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[['Linhas no arquivo', brutas.length], ['Empresas novas (CNPJ)', cnpjsUnicos - existentes.size],
                  ['Já existem: serão completadas', existentes.size], ['Fora: CNPJ inválido ou sem identificação', cnpjInvalidos + semIdentificacao]].map(([l, n]) => (
                  <div key={l as string} className="bg-white border border-gray-200 rounded-xl p-3">
                    <div className="text-xs text-gray-500">{l}</div>
                    <div className="text-xl font-bold text-gray-900 tabular-nums">{Number(n).toLocaleString('pt-BR')}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {validas.length - comCnpj.length > 0 && <>{(validas.length - comCnpj.length).toLocaleString('pt-BR')} {validas.length - comCnpj.length === 1 ? 'linha sem CNPJ será juntada' : 'linhas sem CNPJ serão juntadas'} pelo nome + cidade quando houver uma única ficha igual. </>}
                Linhas repetidas no próprio arquivo viram uma só ficha. Nada é sobrescrito: só o que está vazio é completado.
              </p>
              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-left text-gray-500"><tr>{['CNPJ', 'Nome', 'Tipo', 'Cidade/UF', 'Telefone', 'E-mail'].map(h => <th key={h} className="px-2 py-1.5">{h}</th>)}</tr></thead>
                  <tbody>
                    {amostra.map((l, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1 tabular-nums">{l.cnpj ? formatarCnpj(l.cnpj) : '—'}</td>
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
                  <input value={fonte} onChange={e => setFonte(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-sm w-72" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEtapa('colunas')} className="px-3 py-2 rounded-lg border border-gray-300 text-sm">Voltar às colunas</button>
                  <button onClick={gravar} disabled={!validas.length} className="px-4 py-2 rounded-lg bg-saporino text-white text-sm font-semibold disabled:opacity-50">
                    Importar {validas.length.toLocaleString('pt-BR')} linhas
                  </button>
                </div>
              </div>
            </div>
          )}

          {etapa === 'gravando' && (
            <div className="py-6">
              <p className="text-sm text-gray-700 mb-2">Gravando… {progresso.toLocaleString('pt-BR')} de {validas.length.toLocaleString('pt-BR')}</p>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-saporino transition-all" style={{ width: `${validas.length ? (progresso / validas.length) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {etapa === 'pronto' && (
            <div className="py-4">
              <p className="text-sm text-gray-800 mb-3 font-semibold">Importação concluída — fonte "{fonte}".</p>
              <ul className="text-sm text-gray-700 space-y-1 mb-4 tabular-nums">
                <li>{resultado.novas.toLocaleString('pt-BR')} empresas novas</li>
                <li>{resultado.completadas.toLocaleString('pt-BR')} fichas existentes completadas</li>
                <li>{resultado.iguais.toLocaleString('pt-BR')} sem novidade</li>
                <li>{resultado.invalidas.toLocaleString('pt-BR')} recusadas pelo banco</li>
              </ul>
              <button onClick={aoFechar} className="px-4 py-2 rounded-lg bg-saporino text-white text-sm font-semibold">Fechar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
