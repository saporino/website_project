// Coffee LiVRE — candidaturas de vendedor.
//
// Fila de análise. Aprovar aqui é um ato deliberado: cria o vendedor e a
// loja em rascunho, e é só nesse momento que a marca passa a existir na
// plataforma. Nada disso acontece sozinho quando alguém preenche o
// formulário, e é essa curadoria que protege quem já está dentro.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { Store, Check, X, Loader2, Mail, Phone, MapPin } from 'lucide-react';

interface Candidatura {
  id: string;
  cnpj: string | null;
  razao_social: string | null;
  nome_marca: string;
  tipo: string;
  responsavel: string;
  email: string;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  tipos_de_cafe: string | null;
  volume_mensal: string | null;
  prazo_expedicao: string | null;
  emite_nfe: boolean | null;
  mensagem: string | null;
  status: string;
  seller_id: string | null;
  created_at: string;
  lv_plans: { nome: string } | null;
}

const SITUACOES: Record<string, { rotulo: string; classe: string }> = {
  interessado: { rotulo: 'Interessado', classe: 'bg-amber-50 text-amber-800' },
  em_analise: { rotulo: 'Em análise', classe: 'bg-blue-50 text-blue-800' },
  aprovado: { rotulo: 'Aprovado', classe: 'bg-green-50 text-green-800' },
  recusado: { rotulo: 'Recusado', classe: 'bg-gray-100 text-gray-500' },
};

/** Slug estável a partir do nome da marca. É a URL da loja, e ela é permanente. */
function slugificar(nome: string): string {
  return nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export default function LivreVendedores() {
  const [fila, setFila] = useState<Candidatura[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  // Loja de cada vendedor aprovado, para publicar ou tirar do ar daqui.
  const [lojas, setLojas] = useState<Record<string, { id: string; slug: string; ativa: boolean }>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('lv_seller_applications')
      .select('*, lv_plans(nome)')
      .order('created_at', { ascending: false });
    if (error) toast.error('Não foi possível ler as candidaturas.');
    const lista = (data as Candidatura[]) ?? [];
    setFila(lista);
    const vendedores = lista.map(c => c.seller_id).filter((x): x is string => !!x);
    if (vendedores.length) {
      const { data: ls } = await supabase.from('lv_stores').select('id, slug, ativa, seller_id').in('seller_id', vendedores);
      const mapa: Record<string, { id: string; slug: string; ativa: boolean }> = {};
      for (const l of (ls ?? []) as { id: string; slug: string; ativa: boolean; seller_id: string }[]) mapa[l.seller_id] = l;
      setLojas(mapa);
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function mover(c: Candidatura, status: string) {
    setOcupado(c.id);
    const { error } = await supabase.from('lv_seller_applications')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', c.id);
    setOcupado(null);
    if (error) { toast.error('Não foi possível alterar.'); return; }
    toast.success('Situação atualizada.');
    carregar();
  }

  /**
   * Aprovar cria o vendedor E a loja, em rascunho.
   *
   * A loja nasce inativa de propósito: aprovar o cadastro não é o mesmo
   * que colocar a vitrine no ar. Quem publica é quem revisa o conteúdo.
   */
  async function aprovar(c: Candidatura) {
    setOcupado(c.id);
    try {
      const { data: vendedor, error: e1 } = await supabase.from('lv_sellers').insert({
        nome_fantasia: c.nome_marca,
        razao_social: c.razao_social,
        cnpj: c.cnpj,
        tipo: c.tipo,
        cidade: c.cidade,
        uf: c.uf,
        responsavel: c.responsavel,
        email: c.email,
        telefone: c.telefone,
        status: 'aprovado',
        is_demo: false,
      }).select('id').single();
      if (e1 || !vendedor) throw e1 ?? new Error('sem vendedor');

      // Slug único: se a marca já existe, o segundo ganha sufixo em vez de
      // falhar. Trocar o slug depois quebraria link publicado.
      let slug = slugificar(c.nome_marca);
      const { data: existe } = await supabase.from('lv_stores').select('id').eq('slug', slug).maybeSingle();
      if (existe) slug = `${slug}-${vendedor.id.slice(0, 6)}`;

      const { error: e2 } = await supabase.from('lv_stores').insert({
        seller_id: vendedor.id,
        slug,
        nome: c.nome_marca,
        cidade: c.cidade,
        uf: c.uf,
        iniciais: c.nome_marca.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase(),
        ativa: false,
        is_demo: false,
      });
      if (e2) throw e2;

      await supabase.from('lv_seller_applications')
        .update({ status: 'aprovado', seller_id: vendedor.id, updated_at: new Date().toISOString() })
        .eq('id', c.id);

      toast.success(`${c.nome_marca} aprovada. A loja nasceu inativa: publique quando revisar.`);
      carregar();
    } catch (e) {
      toast.error('Não foi possível aprovar: ' + (e instanceof Error ? e.message : 'erro'));
    } finally {
      setOcupado(null);
    }
  }

  /**
   * Publicar a loja e decisao da plataforma. O vendedor edita os dados no
   * Seller Central mas nao liga a propria vitrine: a guarda do banco devolve
   * o valor que era. E aqui que se liga.
   */
  async function alternarLoja(c: Candidatura) {
    const loja = c.seller_id ? lojas[c.seller_id] : null;
    if (!loja) return;
    setOcupado(c.id);
    const { error } = await supabase.from('lv_stores').update({ ativa: !loja.ativa }).eq('id', loja.id);
    setOcupado(null);
    if (error) { toast.error('Não foi possível alterar a loja.'); return; }
    toast.success(loja.ativa ? `Loja de ${c.nome_marca} fora do ar.` : `Loja de ${c.nome_marca} publicada.`);
    carregar();
  }

  const quando = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-gray-900">Vendedores</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          Quem pediu entrada por <code className="text-xs">/coffeelivre/vender</code>. Nenhum pedido é
          aprovado automaticamente.
        </p>
      </div>

      {carregando ? (
        <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">Carregando…</p>
      ) : fila.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <Store className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            Nenhuma candidatura ainda. Elas aparecem aqui assim que alguém enviar o formulário.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {fila.map(c => {
            const s = SITUACOES[c.status] ?? SITUACOES.interessado;
            const detalhada = aberta === c.id;
            return (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <button className="flex-1 text-left" onClick={() => setAberta(detalhada ? null : c.id)}>
                    <span className="font-semibold text-gray-900">{c.nome_marca}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      {c.tipo} · {[c.cidade, c.uf].filter(Boolean).join('/') || 'sem local'} · {quando(c.created_at)}
                    </span>
                  </button>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${s.classe}`}>{s.rotulo}</span>
                  {c.status === 'aprovado' && c.seller_id && lojas[c.seller_id] && (
                    <button
                      onClick={() => alternarLoja(c)}
                      disabled={ocupado === c.id}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                        lojas[c.seller_id].ativa
                          ? 'border border-gray-300 text-gray-600 hover:border-red-400 hover:text-red-700'
                          : 'bg-[#8B2214] text-white hover:bg-[#6d1a10]'
                      }`}
                    >
                      {lojas[c.seller_id].ativa ? 'Tirar loja do ar' : 'Publicar loja'}
                    </button>
                  )}

                  {c.status !== 'aprovado' && (
                    <>
                      {c.status === 'interessado' && (
                        <button
                          onClick={() => mover(c, 'em_analise')}
                          disabled={ocupado === c.id}
                          className="text-xs font-semibold text-gray-600 hover:text-[#8B2214]"
                        >
                          Analisar
                        </button>
                      )}
                      <button
                        onClick={() => aprovar(c)}
                        disabled={ocupado === c.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                      >
                        {ocupado === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aprovar
                      </button>
                      <button
                        onClick={() => mover(c, 'recusado')}
                        disabled={ocupado === c.id}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-red-700"
                      >
                        <X className="h-3.5 w-3.5" /> Recusar
                      </button>
                    </>
                  )}
                </div>

                {detalhada && (
                  <div className="grid gap-3 border-t border-gray-100 p-4 text-sm sm:grid-cols-2">
                    <p className="flex items-center gap-1.5 text-gray-600"><Mail className="h-3.5 w-3.5 text-gray-400" /> {c.email}</p>
                    {c.telefone && <p className="flex items-center gap-1.5 text-gray-600"><Phone className="h-3.5 w-3.5 text-gray-400" /> {c.telefone}</p>}
                    <p className="text-gray-600"><span className="text-gray-400">Responsável:</span> {c.responsavel}</p>
                    {c.cnpj && <p className="text-gray-600"><span className="text-gray-400">CNPJ:</span> {c.cnpj}</p>}
                    {c.razao_social && <p className="text-gray-600"><span className="text-gray-400">Razão social:</span> {c.razao_social}</p>}
                    {(c.cidade || c.uf) && <p className="flex items-center gap-1.5 text-gray-600"><MapPin className="h-3.5 w-3.5 text-gray-400" /> {[c.cidade, c.uf].filter(Boolean).join(' · ')}</p>}
                    {c.lv_plans && <p className="text-gray-600"><span className="text-gray-400">Plano de interesse:</span> {c.lv_plans.nome}</p>}
                    {c.tipos_de_cafe && <p className="text-gray-600 sm:col-span-2"><span className="text-gray-400">Cafés:</span> {c.tipos_de_cafe}</p>}
                    {c.volume_mensal && <p className="text-gray-600"><span className="text-gray-400">Volume/mês:</span> {c.volume_mensal}</p>}
                    {c.prazo_expedicao && <p className="text-gray-600"><span className="text-gray-400">Despacho:</span> {c.prazo_expedicao}</p>}
                    {c.emite_nfe !== null && <p className="text-gray-600"><span className="text-gray-400">NF-e:</span> {c.emite_nfe ? 'emite' : 'ainda não'}</p>}
                    {c.mensagem && <p className="text-gray-600 sm:col-span-2"><span className="text-gray-400">Mensagem:</span> {c.mensagem}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
