// Leads › B2B Prospecção — cadastro único das empresas do café, por estado e tipo.
//
// Uma ficha por CNPJ (a mescla acontece no banco: b2b_mesclar). "Não ativos" vem primeiro;
// quando a empresa ganha um vínculo ativo com algum negócio nosso, passa para "Ativos",
// e nunca sai do B2B. Só admin enxerga (RLS).
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search, Upload, MessageCircle, MapPin, FileText, Phone } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { ROTULO_DO_TIPO, TIPOS, formatarCnpj, formatarTelefone, type Tipo } from '../../../lib/b2b/normalizar';
import FichaB2B from './FichaB2B';
import ImportadorB2B from './ImportadorB2B';

const POR_PAGINA = 50;

interface Linha {
  id: string; cnpj: string | null; razao_social: string | null; nome_fantasia: string | null; tipo: Tipo;
  uf: string | null; municipio: string | null; telefone: string | null; whatsapp: string | null; email: string | null;
  site: string | null; marcas: string[]; trabalhado: boolean; ativo: boolean; fontes: string[]; pessoa_fisica: boolean;
  situacao_cadastral: string | null; porte: string | null; divergencias_abertas: number;
}

const COLUNAS = 'id,cnpj,razao_social,nome_fantasia,tipo,uf,municipio,telefone,whatsapp,email,site,marcas,trabalhado,ativo,fontes,pessoa_fisica,situacao_cadastral,porte,divergencias_abertas';

export default function B2BProspeccao() {
  const [busca, setBusca] = useState('');
  const [buscaEfetiva, setBuscaEfetiva] = useState('');
  const [uf, setUf] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string>('');
  const [aba, setAba] = useState<'nao_ativos' | 'ativos'>('nao_ativos');
  const [soTelefone, setSoTelefone] = useState(false);
  const [naoTrabalhadas, setNaoTrabalhadas] = useState(false);
  const [comDivergencias, setComDivergencias] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [total, setTotal] = useState(0);
  const [totais, setTotais] = useState({ ativos: 0, naoAtivos: 0 });
  const [porUf, setPorUf] = useState<{ uf: string; n: number }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  useEffect(() => { const t = setTimeout(() => setBuscaEfetiva(busca.trim()), 350); return () => clearTimeout(t); }, [busca]);
  useEffect(() => { setPagina(0); }, [buscaEfetiva, uf, tipo, aba, soTelefone, naoTrabalhadas, comDivergencias]);

  const aplicarFiltros = useCallback(<Q extends { eq: Function; or: Function; is: Function; not: Function }>(q: Q, comUf: boolean): Q => {
    let r: any = q;
    if (comUf && uf) r = uf === '—' ? r.is('uf', null) : r.eq('uf', uf);
    if (tipo) r = r.eq('tipo', tipo);
    // O padronizador sempre preenche telefone quando há WhatsApp; um filtro simples basta.
    if (soTelefone) r = r.not('telefone', 'is', null);
    if (naoTrabalhadas) r = r.eq('trabalhado', false);
    if (comDivergencias) r = r.gt('divergencias_abertas', 0);
    if (buscaEfetiva) {
      const b = buscaEfetiva.replace(/[,()%*]/g, ' ').trim();
      const d = b.replace(/\D/g, '');
      const partes = [`razao_social.ilike.%${b}%`, `nome_fantasia.ilike.%${b}%`, `municipio.ilike.%${b}%`];
      if (d.length >= 4) partes.push(`cnpj.like.${d}%`);
      r = r.or(partes.join(','));
    }
    return r;
  }, [uf, tipo, soTelefone, naoTrabalhadas, comDivergencias, buscaEfetiva]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const base = () => supabase.from('b2b_empresas');
    const lista = aplicarFiltros(base().select(COLUNAS, { count: 'exact' }) as any, true)
      .eq('ativo', aba === 'ativos')
      .order('nome_fantasia', { ascending: true, nullsFirst: false }).order('razao_social', { ascending: true })
      .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
    const ativos = aplicarFiltros(base().select('id', { count: 'exact', head: true }) as any, true).eq('ativo', true);
    const naoAtivos = aplicarFiltros(base().select('id', { count: 'exact', head: true }) as any, true).eq('ativo', false);
    const contagem = supabase.rpc('b2b_contagem', {
      p_busca: buscaEfetiva || null, p_tipo: tipo || null, p_ativo: aba === 'ativos',
      p_so_telefone: soTelefone, p_nao_trabalhadas: naoTrabalhadas, p_com_divergencias: comDivergencias,
    });
    const [l, a, n, c] = await Promise.all([lista, ativos, naoAtivos, contagem]);
    setLinhas((l.data as Linha[]) ?? []);
    setTotal(l.count ?? 0);
    setTotais({ ativos: a.count ?? 0, naoAtivos: n.count ?? 0 });
    setPorUf(((c.data as { uf: string; n: number }[]) ?? []).map(x => ({ uf: x.uf, n: Number(x.n) })));
    setCarregando(false);
  }, [aplicarFiltros, aba, pagina, buscaEfetiva, tipo, soTelefone, naoTrabalhadas, comDivergencias]);

  useEffect(() => { carregar(); }, [carregar]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const chip = (on: boolean) => `px-2.5 py-1 rounded-lg text-xs font-semibold border tabular-nums ${on ? 'bg-saporino text-white border-saporino' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, cidade ou CNPJ…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-sm" />
        </div>
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm">
          <option value="">Todos os tipos</option>
          {TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button onClick={() => setSoTelefone(v => !v)} className={chip(soTelefone)}>Só com telefone</button>
        <button onClick={() => setNaoTrabalhadas(v => !v)} className={chip(naoTrabalhadas)}>Só não trabalhadas</button>
        <button onClick={() => setComDivergencias(v => !v)} className={chip(comDivergencias)}>Com divergências</button>
        <button onClick={() => setImportando(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-saporino text-white text-sm font-semibold hover:bg-saporino-deep">
          <Upload className="w-4 h-4" /> Importar lista
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4" aria-label="Estados">
        <button onClick={() => setUf(null)} className={chip(uf == null)}>Todos</button>
        {porUf.map(x => (
          <button key={x.uf} onClick={() => setUf(u => u === x.uf ? null : x.uf)} className={chip(uf === x.uf)}>
            {x.uf} <span className="opacity-70 font-normal">{x.n.toLocaleString('pt-BR')}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3 border-b border-gray-200">
        {([['nao_ativos', 'Não ativos', totais.naoAtivos], ['ativos', 'Ativos', totais.ativos]] as const).map(([k, l, n]) => (
          <button key={k} onClick={() => setAba(k)}
            className={`px-3 py-2 text-sm font-semibold -mb-px border-b-2 ${aba === k ? 'border-saporino text-saporino' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l} <span className="tabular-nums font-normal">({n.toLocaleString('pt-BR')})</span>
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 hidden sm:inline">
          {aba === 'nao_ativos' ? 'Prospecção: ainda sem negócio ativo com o grupo.' : 'Com algum vínculo ativo: cliente, Coffee LiVRE, marketplaces ou fornecedor.'}
        </span>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-gray-500 p-6"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : linhas.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
          Nenhuma empresa neste filtro. {aba === 'ativos' ? 'Empresas aparecem aqui quando ganham um vínculo ativo na ficha.' : 'Importe uma lista para começar.'}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {linhas.map(l => {
            const tel = l.whatsapp ?? l.telefone;
            const nome = l.nome_fantasia || l.razao_social || '—';
            return (
              <div key={l.id} data-linha-b2b={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button onClick={() => setFichaId(l.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{nome}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#f5f0ef] text-saporino font-semibold">{ROTULO_DO_TIPO[l.tipo]}</span>
                    {l.trabalhado
                      ? <span className="text-[11px] px-2 py-0.5 rounded bg-green-50 text-green-700 font-medium">Trabalhada</span>
                      : <span className="text-[11px] px-2 py-0.5 rounded border border-gray-200 text-gray-500">Não trabalhada</span>}
                    {l.divergencias_abertas > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold" data-campo="badge-divergencias">
                        {l.divergencias_abertas} {l.divergencias_abertas === 1 ? 'divergência' : 'divergências'}
                      </span>
                    )}
                    {l.situacao_cadastral && l.situacao_cadastral !== 'Ativa' && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">Receita: {l.situacao_cadastral}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {[l.nome_fantasia && l.razao_social && l.razao_social !== l.nome_fantasia ? l.razao_social : null,
                      l.municipio && `${l.municipio}${l.uf ? ', ' + l.uf : ''}`,
                      l.cnpj && formatarCnpj(l.cnpj), l.pessoa_fisica ? 'MEI / pessoa física' : null,
                      l.marcas?.length ? `marcas: ${l.marcas.slice(0, 3).join(', ')}${l.marcas.length > 3 ? '…' : ''}` : null,
                      `${l.fontes.length} ${l.fontes.length === 1 ? 'fonte' : 'fontes'}`].filter(Boolean).join(' · ')}
                  </p>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  {tel && <span className="text-sm text-gray-700 tabular-nums mr-1 inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" />{formatarTelefone(tel)}</span>}
                  {l.whatsapp && (
                    <a href={`https://wa.me/55${l.whatsapp}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-50">
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  )}
                  {l.municipio && (
                    <a href={`https://www.google.com/maps/search/${encodeURIComponent(`${nome} ${l.municipio} ${l.uf ?? ''}`)}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50">
                      <MapPin className="w-3.5 h-3.5" /> Maps
                    </a>
                  )}
                  <button onClick={() => setFichaId(l.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-saporino/40 text-saporino text-xs font-semibold hover:bg-[#f5f0ef]">
                    <FileText className="w-3.5 h-3.5" /> Ficha
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > POR_PAGINA && (
        <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
          <span className="tabular-nums">{(pagina * POR_PAGINA + 1).toLocaleString('pt-BR')}–{Math.min(total, (pagina + 1) * POR_PAGINA).toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}</span>
          <div className="flex gap-2">
            <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white disabled:opacity-40">Anterior</button>
            <span className="px-2 py-1.5 tabular-nums">{pagina + 1} / {paginas}</span>
            <button disabled={pagina + 1 >= paginas} onClick={() => setPagina(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white disabled:opacity-40">Próxima</button>
          </div>
        </div>
      )}

      {fichaId && <FichaB2B id={fichaId} aoFechar={() => setFichaId(null)} aoSalvar={carregar} />}
      {importando && <ImportadorB2B aoFechar={() => setImportando(false)} aoConcluir={carregar} />}
    </div>
  );
}
