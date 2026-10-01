import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { Camera, Download, Loader2, Plus, Trash2, Upload, Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import { montarFolhaDePrecos, nomeDoArquivo, lerMargens, brl } from '../../lib/intelPdf';

// PESQUISA DE GÔNDOLA — a visita à loja vira a mesma folha da inteligência de preços.
// Fluxo: nova pesquisa → anexa fotos (ou PDF) → a IA lê a etiqueta → VOCÊ confere → PDF.
// Nada entra no PDF sem revisão: etiqueta engana (preço do vizinho, "leve 3 pague 2").
const BRAND = '#B03220';

interface Pesquisa {
  id: string; rede: string; loja: string | null; cidade: string | null; uf: string | null;
  data_visita: string; observacao: string | null; created_at: string;
}
interface Item {
  id: string; foto_path: string | null; produto: string | null; marca: string | null;
  peso_g: number | null; preco: number | null; preco_regular: number | null; em_promocao: boolean;
  lido_pela_ia: boolean; nao_li: string | null; confianca: string | null; revisado: boolean; ordem: number;
}

export default function GondolaPesquisa() {
  const { activeCompanyId } = useCompany();
  const [pesquisas, setPesquisas] = useState<Pesquisa[]>([]);
  const [aberta, setAberta] = useState<Pesquisa | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [fotos, setFotos] = useState<Record<string, string>>({}); // path -> url assinada
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState('');
  const [lendo, setLendo] = useState(false);
  const [msg, setMsg] = useState('');
  // RASCUNHO: o que você digita fica guardado no navegador enquanto não cria a pesquisa.
  // Serve para o caso real — sair para outra aba copiar o endereço da loja e voltar.
  // Some sozinho quando a pesquisa é criada.
  const RASCUNHO = 'gondola-rascunho';
  const [nova, setNova] = useState(() => {
    try { const s = localStorage.getItem(RASCUNHO); if (s) return JSON.parse(s); } catch { /* sem rascunho */ }
    return { rede: '', loja: '', cidade: '', uf: 'SP' };
  });
  useEffect(() => {
    try {
      const vazio = !nova.rede && !nova.loja && !nova.cidade;
      if (vazio) localStorage.removeItem(RASCUNHO); else localStorage.setItem(RASCUNHO, JSON.stringify(nova));
    } catch { /* navegador sem espaço */ }
  }, [nova]);
  const [margens, setMargens] = useState(() => localStorage.getItem('intel-margens') || '20; 22,5; 25');
  const listaMargens = useMemo(() => lerMargens(margens), [margens]);

  const carregarPesquisas = useCallback(async () => {
    const { data } = await supabase.from('gondola_pesquisas').select('*').order('data_visita', { ascending: false }).limit(60);
    setPesquisas((data as Pesquisa[]) ?? []);
    setCarregando(false);
  }, []);
  useEffect(() => { carregarPesquisas(); }, [carregarPesquisas]);

  const carregarItens = useCallback(async (pesquisaId: string) => {
    const { data } = await supabase.from('gondola_itens').select('*').eq('pesquisa_id', pesquisaId).order('ordem');
    const lista = (data as Item[]) ?? [];
    setItens(lista);
    const caminhos = [...new Set(lista.map(i => i.foto_path).filter(Boolean) as string[])];
    if (caminhos.length) {
      const { data: assinadas } = await supabase.storage.from('gondola').createSignedUrls(caminhos, 3600);
      setFotos(Object.fromEntries((assinadas ?? []).map((a: any) => [a.path, a.signedUrl])));
    } else setFotos({});
  }, []);

  async function abrir(p: Pesquisa) { setAberta(p); setMsg(''); await carregarItens(p.id); }

  async function criar() {
    if (!nova.rede.trim()) { setMsg('Diga a rede (ex.: Supermercado Lopes).'); return; }
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('gondola_pesquisas').insert({
      company_id: activeCompanyId, rede: nova.rede.trim(), loja: nova.loja.trim() || null,
      cidade: nova.cidade.trim() || null, uf: nova.uf.trim().toUpperCase() || null,
      criado_por: user.user?.id ?? null,
    }).select().single();
    if (error) { setMsg('Erro ao criar: ' + error.message); return; }
    setNova({ rede: '', loja: '', cidade: '', uf: 'SP' });
    try { localStorage.removeItem(RASCUNHO); } catch { /* ignora */ }
    await carregarPesquisas();
    abrir(data as Pesquisa);
  }

  async function anexar(arquivos: FileList | null) {
    if (!arquivos?.length || !aberta) return;
    const caminhos: string[] = [];
    let n = 0;
    for (const arquivo of Array.from(arquivos)) {
      n++;
      setEnviando(`Enviando ${n} de ${arquivos.length}…`);
      const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase();
      const caminho = `${aberta.id}/${Date.now()}-${n}.${ext}`;
      const { error } = await supabase.storage.from('gondola').upload(caminho, arquivo, { contentType: arquivo.type || undefined });
      if (error) { setMsg('Erro ao enviar ' + arquivo.name + ': ' + error.message); continue; }
      caminhos.push(caminho);
    }
    setEnviando('');
    if (!caminhos.length) return;
    setLendo(true);
    setMsg(`Lendo ${caminhos.length} arquivo(s) com a IA… isso leva alguns segundos por foto.`);
    const { data, error } = await supabase.functions.invoke('gondola-ler-foto', { body: { pesquisa_id: aberta.id, paths: caminhos } });
    setLendo(false);
    if (error || (data as any)?.error) { setMsg('Erro na leitura: ' + ((data as any)?.error || error?.message)); return; }
    const falhas = ((data as any)?.fotos ?? []).filter((f: any) => f.erro);
    setMsg(falhas.length ? `Pronto, com ${falhas.length} arquivo(s) que não deram certo. Confira os itens abaixo.` : 'Leitura pronta. Confira item por item antes de gerar o PDF.');
    carregarItens(aberta.id);
  }

  async function salvarItem(id: string, campos: Partial<Item>) {
    setItens(is => is.map(i => i.id === id ? { ...i, ...campos } : i));
    await supabase.from('gondola_itens').update(campos).eq('id', id);
  }
  async function apagarItem(id: string) {
    setItens(is => is.filter(i => i.id !== id));
    await supabase.from('gondola_itens').delete().eq('id', id);
  }
  async function apagarPesquisa(p: Pesquisa) {
    if (!confirm(`Excluir a pesquisa "${p.rede}${p.loja ? ' — ' + p.loja : ''}" e todos os itens dela?`)) return;
    const { data: arquivos } = await supabase.storage.from('gondola').list(p.id);
    if (arquivos?.length) await supabase.storage.from('gondola').remove(arquivos.map(a => `${p.id}/${a.name}`));
    await supabase.from('gondola_pesquisas').delete().eq('id', p.id);
    setAberta(null); carregarPesquisas();
  }

  const prontos = itens.filter(i => i.preco && i.preco > 0 && i.produto);
  const revisados = prontos.filter(i => i.revisado);
  const porKg = (i: Item) => i.peso_g && i.preco ? +(i.preco / (i.peso_g / 1000)).toFixed(2) : null;

  function gerarPdf() {
    if (!aberta || !revisados.length) return;
    const ordenados = [...revisados].sort((a, b) => (porKg(b) ?? 0) - (porKg(a) ?? 0));
    const precos = ordenados.map(porKg).filter(Boolean) as number[];
    const ordenadosPorKg = [...precos].sort((a, b) => a - b);
    const meio = Math.floor(ordenadosPorKg.length / 2);
    const mediana = !ordenadosPorKg.length ? 0
      : ordenadosPorKg.length % 2 ? ordenadosPorKg[meio] : (ordenadosPorKg[meio - 1] + ordenadosPorKg[meio]) / 2;
    const mercado = [aberta.rede, aberta.loja].filter(Boolean).join(' — ')
      + (aberta.cidade ? `, ${aberta.cidade}${aberta.uf ? '/' + aberta.uf : ''}` : '');
    const dataVisita = new Date(aberta.data_visita + 'T12:00:00');
    const html = montarFolhaDePrecos({
      mercado,
      atualizadoEm: dataVisita.toLocaleDateString('pt-BR'),
      geradoEm: new Date().toLocaleString('pt-BR'),
      recorte: 'Levantamento visual de gôndola',
      margens: listaMargens,
      medianaPorKg: mediana,
      faixa: [precos.length ? Math.min(...precos) : 0, precos.length ? Math.max(...precos) : 0],
      promoPct: ordenados.length ? Math.round(100 * ordenados.filter(i => i.em_promocao).length / ordenados.length) : 0,
      linhas: ordenados.map(i => ({
        titulo: [i.marca, i.produto].filter(Boolean).join(' ').trim() || i.produto || '—',
        fotoUrl: i.foto_path ? fotos[i.foto_path] : null,
        precoPrateleira: i.preco || 0,
        precoPorKg: porKg(i),
        pesoG: i.peso_g,
        descontoPct: i.em_promocao && i.preco_regular && i.preco_regular > (i.preco || 0)
          ? Math.round(100 * (1 - (i.preco || 0) / i.preco_regular)) : null,
      })),
    }, nomeDoArquivo(mercado, dataVisita));
    const janela = window.open('', '_blank');
    if (janela) { janela.document.write(html); janela.document.close(); janela.addEventListener('load', () => setTimeout(() => janela.print(), 500)); return; }
    const quadro = document.createElement('iframe');
    quadro.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(quadro);
    const doc = quadro.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { quadro.contentWindow?.focus(); quadro.contentWindow?.print(); setTimeout(() => quadro.remove(), 60000); }, 900);
  }

  if (carregando) return <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin" style={{ color: BRAND }} /></div>;

  // ---------- lista de pesquisas ----------
  if (!aberta) return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900">Pesquisa de gôndola</h3>
        <p className="text-sm text-gray-500">Foto da prateleira na visita à loja. A IA lê a etiqueta, você confere e sai o mesmo PDF da inteligência de preços.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-800 mb-3">Nova pesquisa</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input value={nova.rede} onChange={e => setNova({ ...nova, rede: e.target.value })} placeholder="Rede (ex.: Supermercado Lopes)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2" />
          <input value={nova.loja} onChange={e => setNova({ ...nova, loja: e.target.value })} placeholder="Loja (ex.: Cipava)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <input value={nova.cidade} onChange={e => setNova({ ...nova, cidade: e.target.value })} placeholder="Cidade" className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1" />
            <input value={nova.uf} onChange={e => setNova({ ...nova, uf: e.target.value })} maxLength={2} className="border border-gray-300 rounded-lg px-2 py-2 text-sm w-14 uppercase" />
          </div>
        </div>
        <button onClick={criar} className="mt-3 inline-flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: BRAND }}>
          <Plus className="w-4 h-4" /> Criar e anexar fotos
        </button>
        {msg && <p className="text-xs text-gray-600 mt-2">{msg}</p>}
      </div>

      <div className="space-y-2">
        {pesquisas.map(p => (
          <div key={p.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
            <Camera className="w-5 h-5 text-gray-300 flex-shrink-0" />
            <button onClick={() => abrir(p)} className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{p.rede}{p.loja ? ` — ${p.loja}` : ''}</p>
              <p className="text-xs text-gray-500">{p.cidade ? `${p.cidade}${p.uf ? '/' + p.uf : ''} · ` : ''}visita de {new Date(p.data_visita + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
            </button>
            <button onClick={() => apagarPesquisa(p)} className="p-1.5 rounded text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {!pesquisas.length && <p className="text-sm text-gray-400 text-center py-6">Nenhuma pesquisa ainda.</p>}
      </div>
    </div>
  );

  // ---------- uma pesquisa aberta ----------
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => { setAberta(null); carregarPesquisas(); }} className="p-1.5 rounded text-gray-500 hover:bg-gray-100"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{aberta.rede}{aberta.loja ? ` — ${aberta.loja}` : ''}</h3>
            <p className="text-sm text-gray-500">
              {aberta.cidade ? `${aberta.cidade}${aberta.uf ? '/' + aberta.uf : ''} · ` : ''}
              visita de {new Date(aberta.data_visita + 'T12:00:00').toLocaleDateString('pt-BR')} · {itens.length} itens lidos · {revisados.length} conferidos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border bg-white border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer ${enviando || lendo ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4" /> Anexar fotos ou PDF
            <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={e => { anexar(e.target.files); e.target.value = ''; }} />
          </label>
          <button onClick={gerarPdf} disabled={!revisados.length}
            title={revisados.length ? 'Gera o PDF com os itens conferidos' : 'Marque os itens conferidos para liberar o PDF'}
            className="inline-flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: BRAND }}>
            <Download className="w-4 h-4" /> Gerar PDF ({revisados.length})
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-gray-700">Margens do mercado:</span>
        <input value={margens} onChange={e => { setMargens(e.target.value); localStorage.setItem('intel-margens', e.target.value); }}
          className="w-40 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
        <span className="text-xs text-gray-400">viram as colunas de quanto a rede pagaria</span>
      </div>

      {(enviando || lendo) && (
        <p className="text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> {enviando || 'Lendo as fotos com a IA…'}
        </p>
      )}
      {msg && !enviando && !lendo && <p className="text-xs p-2 rounded bg-gray-50 border border-gray-100 text-gray-700">{msg}</p>}

      {!itens.length ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          Anexe as fotos da gôndola (ou um PDF de outra fonte). A IA lê a etiqueta de cada uma e traz os cafés para você conferir.
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Confira cada linha e marque <strong>Conferido</strong>. Só o que estiver conferido entra no PDF — etiqueta de gôndola engana, e preço errado vira proposta errada.
          </p>
          {itens.map(i => (
            <div key={i.id} className={`flex flex-wrap items-center gap-2 bg-white border rounded-lg p-2 ${i.revisado ? 'border-green-300' : i.preco ? 'border-gray-200' : 'border-amber-300'}`}>
              {i.foto_path && fotos[i.foto_path]
                ? <img src={fotos[i.foto_path]} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                : <span className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">📄</span>}
              <input value={i.marca ?? ''} onChange={e => salvarItem(i.id, { marca: e.target.value })} placeholder="marca"
                className="border border-gray-200 rounded px-2 py-1 text-sm w-28" />
              <input value={i.produto ?? ''} onChange={e => salvarItem(i.id, { produto: e.target.value })} placeholder="produto"
                className="border border-gray-200 rounded px-2 py-1 text-sm flex-1 min-w-[160px]" />
              <input value={i.peso_g ?? ''} onChange={e => salvarItem(i.id, { peso_g: e.target.value ? Number(e.target.value) : null })} placeholder="g"
                className="border border-gray-200 rounded px-2 py-1 text-sm w-16" />
              <input value={i.preco ?? ''} onChange={e => salvarItem(i.id, { preco: e.target.value ? Number(String(e.target.value).replace(',', '.')) : null })} placeholder="preço"
                className="border border-gray-200 rounded px-2 py-1 text-sm w-20 font-semibold" />
              <span className="text-xs text-gray-500 w-20 text-right">{porKg(i) ? `${brl(porKg(i)!)}/kg` : '—'}</span>
              {i.nao_li && <span className="inline-flex items-center gap-1 text-[11px] text-amber-700"><AlertTriangle className="w-3.5 h-3.5" /> {i.nao_li}</span>}
              {i.confianca && i.confianca !== 'alta' && !i.nao_li && <span className="text-[11px] text-amber-600">leitura {i.confianca}</span>}
              <label className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 cursor-pointer">
                <input type="checkbox" checked={i.revisado} onChange={e => salvarItem(i.id, { revisado: e.target.checked })} /> Conferido
              </label>
              <button onClick={() => apagarItem(i.id)} className="p-1 rounded text-gray-300 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => itens.filter(i => i.preco && i.produto && !i.revisado).forEach(i => salvarItem(i.id, { revisado: true }))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">
              <Check className="w-3.5 h-3.5" /> Marcar todos com preço como conferidos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
