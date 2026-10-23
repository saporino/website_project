// PREÇO POR CANAL — a tela onde se separa o que antes era um preço só.
//
// Vive dentro da ficha do produto, logo abaixo do preço. O preço de cima
// continua sendo o da loja da Saporino; aqui ficam os outros canais, cada um com
// o seu valor e a sua promoção.
//
// Duas decisões que explicam o desenho:
//
// 1. SEM PREÇO É UM ESTADO, não um campo vazio. Enquanto a COFICO não tiver
//    preço, o cartão diz "sem preço — não vende por aqui", e isso é correto:
//    herdar o preço da Saporino foi o defeito que esta tela existe para
//    corrigir. Ela nunca sugere o preço do outro canal.
//
// 2. O RepCo NÃO aparece aqui. Ele tem Listas de Preço, com preço por segmento
//    e desconto por volume. Mostrá-lo nesta tela criaria dois lugares para
//    mudar o mesmo preço — e um deles estaria sempre errado.
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Store, Building2, ShoppingCart, Check, Trash2, AlertCircle } from 'lucide-react';

type Canal = 'saporino' | 'cofico' | 'marketplaces';

const CANAIS: { id: Canal; nome: string; onde: string; Icone: typeof Store }[] = [
  { id: 'saporino', nome: 'Loja Saporino', onde: 'cafesaporino.com.br', Icone: Store },
  { id: 'cofico', nome: 'COFICO', onde: 'coficobrasil.com.br', Icone: Building2 },
  { id: 'marketplaces', nome: 'CASA COFICO', onde: 'ML, Shopee, Amazon, TikTok', Icone: ShoppingCart },
];

interface LinhaCanal {
  canal: Canal;
  price: number | null;
  promotional_price: number | null;
  preco_final: number | null;
  definido: boolean;
  fonte: 'canal' | 'produto' | 'indefinido';
}

const brl = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : 'R$ ' + Number(n).toFixed(2).replace('.', ',');

export default function PrecoPorCanal({ productId }: { productId: string }) {
  const [linhas, setLinhas] = useState<LinhaCanal[] | null>(null);
  const [editando, setEditando] = useState<Canal | null>(null);
  const [preco, setPreco] = useState('');
  const [promo, setPromo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('vw_precos_por_canal')
      .select('canal, price, promotional_price, preco_final, definido, fonte')
      .eq('product_id', productId);
    setLinhas((data as LinhaCanal[]) ?? []);
  }, [productId]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrir = (canal: Canal) => {
    const l = linhas?.find(x => x.canal === canal);
    // Abre com o valor DO CANAL, não com o da Saporino. Pré-preencher com o
    // preço do outro canal é como o vazamento começa.
    setPreco(l?.fonte === 'canal' && l.price ? String(l.price) : '');
    setPromo(l?.fonte === 'canal' && l.promotional_price ? String(l.promotional_price) : '');
    setErro(null);
    setEditando(canal);
  };

  const salvar = async () => {
    if (!editando) return;
    const p = Number(preco.replace(',', '.'));
    const pr = promo.trim() ? Number(promo.replace(',', '.')) : null;
    if (!(p > 0)) { setErro('Informe um preço maior que zero.'); return; }
    if (pr !== null && !(pr < p)) { setErro('A promoção precisa ser menor que o preço.'); return; }

    setSalvando(true);
    const { error } = await supabase.from('product_channel_prices')
      .upsert({ product_id: productId, channel: editando, price: p, promotional_price: pr, is_active: true },
        { onConflict: 'product_id,channel' });
    setSalvando(false);
    if (error) {
      // A bancada pegou isto: sem papel de admin, o Postgres devolve
      // "new row violates row-level security policy" e a tela mostrava a frase
      // crua, em inglês. Quem lê não tem como saber que o problema é permissão.
      setErro(/row-level security|42501/i.test(error.message)
        ? 'Você não tem permissão para definir preços. Fale com um administrador.'
        : error.message);
      return;
    }
    setEditando(null);
    carregar();
  };

  const remover = async (canal: Canal) => {
    await supabase.from('product_channel_prices').delete().eq('product_id', productId).eq('channel', canal);
    carregar();
  };

  if (!linhas) return null;

  return (
    <div className="md:col-span-2 rounded-xl border border-gray-200 p-4">
      <div className="flex items-start gap-2 mb-1">
        <h4 className="text-sm font-semibold text-gray-800">Preço por canal</h4>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Cada canal tem o seu preço. Sem preço cadastrado, o produto não é vendido naquele canal —
        o preço de um canal nunca é usado em outro. O RepCo usa Listas de Preço, não esta tela.
      </p>

      <div className="grid gap-2 md:grid-cols-3">
        {CANAIS.map(({ id, nome, onde, Icone }) => {
          const l = linhas.find(x => x.canal === id);
          const proprio = l?.fonte === 'canal';
          const herdado = l?.fonte === 'produto';
          return (
            <div key={id} className={`rounded-lg border-2 p-3 ${proprio ? 'border-[#8B2214] bg-[#f5f0ef]' : 'border-gray-200'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icone className="h-4 w-4 flex-shrink-0 text-[#8B2214]" />
                <span className="text-sm font-semibold text-gray-800 truncate">{nome}</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-2 truncate">{onde}</p>

              {editando === id ? (
                <div className="space-y-2">
                  <input autoFocus value={preco} onChange={e => setPreco(e.target.value)} placeholder="Preço"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" />
                  <input value={promo} onChange={e => setPromo(e.target.value)} placeholder="Promoção (opcional)"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" />
                  {erro && <p className="text-[11px] text-[#8B2214]">{erro}</p>}
                  <div className="flex gap-1.5">
                    <button type="button" onClick={salvar} disabled={salvando}
                      className="flex-1 inline-flex items-center justify-center gap-1 bg-[#8B2214] text-white text-xs font-semibold py-1.5 rounded disabled:opacity-50">
                      <Check className="h-3 w-3" /> {salvando ? 'Salvando…' : 'Salvar'}
                    </button>
                    <button type="button" onClick={() => setEditando(null)}
                      className="px-2 text-xs font-medium text-gray-600 border border-gray-300 rounded">Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  {proprio && (
                    <p className="text-base font-bold text-gray-900">
                      {brl(l.preco_final)}
                      {l.promotional_price && <span className="ml-1 text-xs font-normal text-gray-400 line-through">{brl(l.price)}</span>}
                    </p>
                  )}
                  {herdado && (
                    <p className="text-base font-bold text-gray-900">
                      {brl(l.preco_final)}
                      <span className="block text-[11px] font-normal text-gray-400">do preço do produto, acima</span>
                    </p>
                  )}
                  {!l?.definido && (
                    <p className="flex items-start gap-1 text-[11px] text-amber-700">
                      <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      Sem preço — não vende por aqui.
                    </p>
                  )}
                  <div className="mt-2 flex gap-1.5">
                    <button type="button" onClick={() => abrir(id)}
                      className="flex-1 text-xs font-semibold text-[#8B2214] border border-[#8B2214] rounded py-1 hover:bg-white">
                      {proprio ? 'Alterar' : 'Definir preço'}
                    </button>
                    {proprio && (
                      <button type="button" onClick={() => remover(id)} title="Remover o preço deste canal"
                        className="px-2 text-gray-400 hover:text-[#8B2214]">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
