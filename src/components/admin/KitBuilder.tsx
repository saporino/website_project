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
import { Layers, Loader2, Check, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { textoEmFardos } from '../../lib/estoque';

type Degrau = { quantidade: number; precoPorPacote: string; marcado: boolean };

type KitExistente = {
  id: string; name: string; sku: string | null; price: number;
  kit_quantity: number; weight_grams: number | null;
  image_url: string | null; has_custom_image: boolean;
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function KitBuilder({
  produtoId, produtoNome, precoBase, gramas, estoquePacotes = 0,
}: {
  produtoId: string; produtoNome: string; precoBase: number; gramas: number;
  /** Pacotes no lote. Todos os degraus saem daqui — não há estoque separado. */
  estoquePacotes?: number;
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
  const [subindo, setSubindo] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => { carregar(); }, [produtoId]);

  const carregar = async () => {
    const { data } = await supabase.from('products')
      .select('id, name, sku, price, kit_quantity, weight_grams, image_url, has_custom_image')
      .eq('kit_of_product_id', produtoId)
      .order('kit_quantity');
    setExistentes((data ?? []) as KitExistente[]);
  };

  // Foto própria do kit. Um fardo de 10 pacotes com a foto de um pacote só
  // vende mal — o cliente não vê o que está levando.
  const trocarFoto = async (kit: KitExistente, file: File) => {
    setErro(''); setOk('');
    if (!file.type.startsWith('image/')) { setErro('Escolha um arquivo de imagem.'); return; }
    if (file.size > 2 * 1024 * 1024) { setErro('Imagem muito grande. O limite é 2 MB.'); return; }

    setSubindo(kit.id);
    try {
      const ext = file.name.split('.').pop();
      const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: eUp } = await supabase.storage
        .from('product-images').upload(nome, file, { cacheControl: '3600', upsert: false });
      if (eUp) { setErro(`Não deu para subir: ${eUp.message}`); return; }

      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(nome);
      const { error: eDb } = await supabase.from('products')
        .update({ image_url: publicUrl, has_custom_image: true })
        .eq('id', kit.id);
      if (eDb) { setErro(eDb.message); return; }

      setOk('Foto do kit atualizada.');
      carregar();
    } finally {
      setSubindo(null);
    }
  };

  // Volta a espelhar a foto do café, e passa a acompanhar as trocas dela.
  const voltarFotoDoCafe = async (kit: KitExistente) => {
    setSubindo(kit.id);
    const { data: base } = await supabase.from('products')
      .select('image_url').eq('id', produtoId).maybeSingle();
    await supabase.from('products')
      .update({ image_url: base?.image_url ?? null, has_custom_image: false })
      .eq('id', kit.id);
    setSubindo(null);
    setOk('O kit voltou a usar a foto do café.');
    carregar();
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

      {/* Um estoque só. Fardo e kit são formas de vender o mesmo pacote —
          vender um kit de 2 tira 2 pacotes, e o fardo cai junto. */}
      {estoquePacotes > 0 && (
        <div className="mb-4 rounded-lg border border-gray-200 px-4 py-2.5 text-sm">
          <span className="text-gray-600">Em estoque: </span>
          <span className="font-semibold text-gray-900">{textoEmFardos(estoquePacotes)}</span>
          <span className="text-gray-500"> — {estoquePacotes} pacotes ao todo, e é deles que
            saem todos os degraus abaixo.</span>
        </div>
      )}

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
          <div className="space-y-2">
            {existentes.map((k) => (
              <div key={k.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2.5">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
                  {k.image_url
                    ? <img src={k.image_url} alt={k.name} className="h-full w-full object-contain" />
                    : <ImageIcon className="h-5 w-5 text-gray-300" />}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-800">
                    {k.name.replace(produtoNome, '').replace(/^\s*—\s*/, '')}
                  </p>
                  <p className="font-mono text-[11px] text-gray-500">{k.sku}</p>
                  <p className="text-[11px] text-gray-500">
                    {k.has_custom_image
                      ? <span className="text-[#8B2214]">foto própria</span>
                      : 'usa a foto do café'}
                  </p>
                </div>

                <div className="hidden text-right sm:block">
                  <p className="font-mono text-sm tabular-nums text-gray-900">{brl(k.price)}</p>
                  <p className="font-mono text-[11px] tabular-nums text-gray-500">
                    {brl(k.price / ((k.weight_grams ?? 0) / 1000 || 1))}/kg
                  </p>
                </div>

                <div className="flex flex-shrink-0 flex-col gap-1">
                  <label className="cursor-pointer rounded-lg border border-gray-300 px-2.5 py-1.5 text-center text-[11px] font-semibold text-gray-700 hover:bg-gray-50">
                    {subindo === k.id ? 'Subindo…' : 'Trocar foto'}
                    <input type="file" accept="image/*" className="hidden" disabled={subindo === k.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) trocarFoto(k, f);
                        e.target.value = '';
                      }} />
                  </label>
                  {k.has_custom_image && (
                    <button type="button" onClick={() => voltarFotoDoCafe(k)} disabled={subindo === k.id}
                      className="rounded-lg px-2.5 py-1 text-[11px] text-gray-500 hover:text-gray-800">
                      usar a do café
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            Enquanto o kit não tiver foto própria, ele acompanha a foto do café — trocar
            lá troca em todos de uma vez. Depois de subir uma foto aqui, ela fica: nem o
            botão de atualizar kits nem a troca da foto do café mexem nela.
          </p>
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
