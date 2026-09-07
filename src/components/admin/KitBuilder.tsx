// Criar os kits de um café a partir da tela de edição do produto.
//
// Cada degrau vira um produto próprio, com SKU e peso, porque marketplace e
// supermercado exigem assim. O que eles NÃO têm é estoque próprio: um kit de 3
// vendido tira 3 pacotes do lote do café.
//
// A trava do R$/kg mora no banco, não aqui: o preço por quilo tem que cair a
// cada degrau. A tela só mostra o número antes, para a pessoa ver o que vai
// acontecer — quem recusa é a função.
import { useEffect, useState } from 'react';
import { Layers, Loader2, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Degrau = { quantidade: number; precoPorPacote: string; marcado: boolean };

type KitExistente = {
  id: string; name: string; sku: string | null; price: number;
  kit_quantity: number; weight_grams: number | null;
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function KitBuilder({
  produtoId, produtoNome, precoBase, gramas,
}: {
  produtoId: string; produtoNome: string; precoBase: number; gramas: number;
}) {
  const pesoKg = (gramas || 500) / 1000;
  const porKgBase = precoBase / pesoKg;

  // Sugestão inicial: R$ 1,00 a menos por pacote a cada degrau, que é a régua
  // usada no Tropeiro. A pessoa muda o que quiser antes de criar.
  const [degraus, setDegraus] = useState<Degrau[]>([
    { quantidade: 2, precoPorPacote: (precoBase - 1).toFixed(2), marcado: true },
    { quantidade: 3, precoPorPacote: (precoBase - 2).toFixed(2), marcado: true },
    { quantidade: 4, precoPorPacote: (precoBase - 3).toFixed(2), marcado: true },
    { quantidade: 10, precoPorPacote: (precoBase - 4).toFixed(2), marcado: true },
  ]);
  const [existentes, setExistentes] = useState<KitExistente[]>([]);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => { carregar(); }, [produtoId]);

  const carregar = async () => {
    const { data } = await supabase.from('products')
      .select('id, name, sku, price, kit_quantity, weight_grams')
      .eq('kit_of_product_id', produtoId)
      .order('kit_quantity');
    setExistentes((data ?? []) as KitExistente[]);
  };

  const alterar = (q: number, campo: keyof Degrau, valor: unknown) =>
    setDegraus((ds) => ds.map((d) => (d.quantidade === q ? { ...d, [campo]: valor } : d)));

  const criar = async () => {
    setErro(''); setOk(''); setCriando(true);
    try {
      const escolhidos = degraus.filter((d) => d.marcado).map((d) => ({
        quantidade: d.quantidade,
        preco_por_pacote: Number(String(d.precoPorPacote).replace(',', '.')),
      }));
      if (escolhidos.length === 0) { setErro('Marque pelo menos um degrau.'); return; }

      const { data, error } = await supabase.rpc('criar_kits', {
        p_produto_id: produtoId, p_degraus: escolhidos,
      });
      if (error) { setErro(error.message); return; }
      setOk(`${data?.length ?? 0} ${data?.length === 1 ? 'kit criado' : 'kits criados'}.`);
      carregar();
    } finally {
      setCriando(false);
    }
  };

  // Prévia: o mesmo cálculo que o banco vai fazer, para a pessoa ver antes.
  const previa = degraus.filter((d) => d.marcado).map((d) => {
    const ppp = Number(String(d.precoPorPacote).replace(',', '.')) || 0;
    const total = ppp * d.quantidade;
    return { ...d, total, porKg: total / (d.quantidade * pesoKg) };
  });

  // Mesma regra da trava: cada degrau tem que ficar abaixo do anterior.
  let anterior = porKgBase;
  const quebrados = new Set<number>();
  for (const p of previa) {
    if (p.porKg >= anterior) quebrados.add(p.quantidade);
    else anterior = p.porKg;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-1 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5f0ef]">
          <Layers className="h-4.5 w-4.5 text-[#8B2214]" />
        </div>
        <h4 className="text-base font-bold text-gray-900">Kits e fardos</h4>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        O mesmo café em 2, 3, 4 pacotes e no fardo. Cada um vira um produto com SKU próprio,
        mas o estoque continua sendo um só — um kit de 3 tira 3 pacotes do lote.
      </p>

      <div className="mb-4 rounded-lg bg-[#faf8f7] px-4 py-2.5 text-sm">
        <span className="text-gray-600">Avulso: </span>
        <span className="font-semibold text-gray-900">{brl(precoBase)}</span>
        <span className="text-gray-600"> · </span>
        <span className="font-mono text-[13px] text-[#8B2214]">{brl(porKgBase)}/kg</span>
        <span className="ml-1 text-gray-500">— nenhum kit pode passar disso por quilo.</span>
      </div>

      <div className="space-y-2">
        {degraus.map((d) => {
          const p = previa.find((x) => x.quantidade === d.quantidade);
          const ruim = quebrados.has(d.quantidade);
          return (
            <div key={d.quantidade}
              className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${
                ruim ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}>
              <label className="flex min-w-[7.5rem] items-center gap-2 text-sm font-medium text-gray-800">
                <input type="checkbox" checked={d.marcado}
                  onChange={(e) => alterar(d.quantidade, 'marcado', e.target.checked)}
                  className="h-4 w-4 accent-[#8B2214]" />
                {d.quantidade >= 10 ? `Fardo (${d.quantidade})` : `${d.quantidade} pacotes`}
              </label>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">R$</span>
                <input type="text" inputMode="decimal" value={d.precoPorPacote}
                  onChange={(e) => alterar(d.quantidade, 'precoPorPacote', e.target.value)}
                  disabled={!d.marcado}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50" />
                <span className="text-xs text-gray-500">por pacote</span>
              </div>

              {d.marcado && p && (
                <span className="ml-auto flex items-center gap-3 font-mono text-[13px] tabular-nums">
                  <span className="text-gray-900">{brl(p.total)}</span>
                  <span className={ruim ? 'font-semibold text-red-700' : 'text-[#8B2214]'}>
                    {brl(p.porKg)}/kg
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {quebrados.size > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          O preço por quilo tem que cair a cada degrau. Nos marcados em vermelho o cliente
          pagaria mais por quilo do que num kit maior — e provavelmente compraria o maior,
          ou nenhum.
        </p>
      )}

      {erro && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">{erro}</p>
      )}
      {ok && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-800">
          <Check className="h-3.5 w-3.5" /> {ok}
        </p>
      )}

      <button type="button" onClick={criar} disabled={criando || quebrados.size > 0}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#8B2214] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6d1a10] disabled:opacity-50">
        {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
        {existentes.length > 0 ? 'Atualizar kits' : 'Criar kits'}
      </button>

      {existentes.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Já no catálogo
          </p>
          <div className="space-y-1.5">
            {existentes.map((k) => (
              <div key={k.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
                <span className="font-mono text-xs text-gray-500">{k.sku}</span>
                <span className="text-gray-800">{k.name.replace(produtoNome, '').replace(/^\s*—\s*/, '')}</span>
                <span className="ml-auto font-mono tabular-nums text-gray-900">{brl(k.price)}</span>
                <span className="font-mono text-xs tabular-nums text-gray-500">
                  {brl(k.price / ((k.weight_grams ?? 0) / 1000 || 1))}/kg
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            Falta o código de barras de cada kit. Cada um é um produto diferente para o
            varejo e precisa do próprio EAN-13, emitido no GS1 Brasil com o prefixo da
            empresa — código inventado aponta para o produto de outra companhia.
          </p>
        </div>
      )}
    </div>
  );
}
