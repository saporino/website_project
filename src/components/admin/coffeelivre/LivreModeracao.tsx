// Coffee LiVRE — fila de moderação.
//
// Seção 4.3 do RAIO-X: todo produto novo, ou editado em campo sensível,
// passa por aqui antes de ir ao ar. O banco já garante que o vendedor não
// pula a fila; esta tela é onde a fila anda.
//
// Recusar exige motivo. Recusa sem motivo deixa o vendedor adivinhando o
// que corrigir, e ele reenvia igual.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { Check, X, Loader2, ShieldCheck } from 'lucide-react';

interface NaFila {
  id: string;
  titulo: string;
  preco_cents: number | null;
  sku: string | null;
  updated_at: string;
  aprovado_em: string | null;
  lv_stores: { nome: string; ativa: boolean } | null;
  lv_categories: { nome: string } | null;
}

const reais = (c: number | null) => (c == null ? '—' : `R$ ${(c / 100).toFixed(2).replace('.', ',')}`);

export default function LivreModeracao() {
  const [fila, setFila] = useState<NaFila[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.from('lv_products')
      .select('id, titulo, preco_cents, sku, updated_at, aprovado_em, lv_stores(nome, ativa), lv_categories(nome)')
      .eq('status', 'em_moderacao')
      .order('updated_at', { ascending: true });
    if (error) toast.error('Não foi possível ler a fila.');
    setFila((data as unknown as NaFila[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function decidir(p: NaFila, aprovar: boolean) {
    if (!aprovar && motivo.trim().length < 5) { toast.error('Diga ao vendedor o que corrigir.'); return; }
    setOcupado(p.id);
    const { error } = await supabase.from('lv_products').update(
      aprovar ? { status: 'ativo' } : { status: 'recusado', nota_moderacao: motivo.trim() },
    ).eq('id', p.id);
    setOcupado(null);
    if (error) { toast.error('Não foi possível registrar: ' + error.message); return; }
    toast.success(aprovar
      ? (p.lv_stores?.ativa ? `${p.titulo} aprovado e no ar.` : `${p.titulo} aprovado. Aparece quando a loja for publicada.`)
      : `${p.titulo} recusado. O vendedor vê o motivo no Seller Central.`);
    setRecusando(null);
    setMotivo('');
    carregar();
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-gray-900">Moderação</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          Produtos novos ou editados em campo sensível (nome, categoria, preço caindo mais da metade). Mais antigos primeiro.
        </p>
      </div>

      {carregando ? (
        <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">Carregando…</p>
      ) : fila.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Fila vazia. Nenhum produto esperando revisão.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fila.map(p => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{p.titulo}</p>
                  <p className="text-xs text-gray-500">
                    {p.lv_stores?.nome ?? 'sem loja'} · {p.lv_categories?.nome ?? 'sem categoria'} · {reais(p.preco_cents)}
                    {p.sku ? ` · ${p.sku}` : ''}
                    {p.aprovado_em ? ' · já foi aprovado antes (edição sensível)' : ' · primeiro envio'}
                  </p>
                </div>
                <button
                  onClick={() => decidir(p, true)}
                  disabled={ocupado === p.id}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                >
                  {ocupado === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Aprovar
                </button>
                <button
                  onClick={() => { setRecusando(recusando === p.id ? null : p.id); setMotivo(''); }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-red-700"
                >
                  <X className="h-3.5 w-3.5" /> Recusar
                </button>
              </div>
              {recusando === p.id && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  <input
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    placeholder="O que o vendedor precisa corrigir? Ex.: foto sem rótulo legível"
                    className="min-w-[240px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => decidir(p, false)}
                    disabled={ocupado === p.id}
                    className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                  >
                    Confirmar recusa
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
