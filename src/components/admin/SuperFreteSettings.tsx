// Integração com o agregador de frete.
//
// Nota sobre o token: ele NÃO é digitado nem exibido aqui. Fica nos secrets do
// servidor, porque emite etiqueta e gasta saldo de verdade — chave que passa
// pelo navegador é chave que pode vazar. Esta tela mostra só se a conexão
// funciona, e o botão de teste faz uma cotação real para provar.
import { useEffect, useState } from 'react';
import { Truck, Loader2, CheckCircle2, XCircle, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { brl } from '../../lib/freight';

type Cfg = {
  id: string;
  company_id: string;
  is_active: boolean;
  origin_cep: string | null;
  services: string;
  markup_pct: number;
  markup_fixo: number;
  last_ok_at: string | null;
  last_error: string | null;
};

type Empresa = { id: string; name: string; order_prefix: string | null };

type Opcao = { nome: string; empresa: string; preco: number; preco_base: number; desconto: number; prazo_dias: number | null };

export default function SuperFreteSettings() {
  const [cfgs, setCfgs] = useState<Cfg[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [testando, setTestando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Record<string, { ok: boolean; texto: string; opcoes?: Opcao[] }>>({});

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setCarregando(true);
    const [{ data: c }, { data: e }] = await Promise.all([
      supabase.from('superfrete_settings').select('*'),
      supabase.from('companies').select('id, name, order_prefix').in('order_prefix', ['CS', 'CO']),
    ]);
    setCfgs((c ?? []) as Cfg[]);
    setEmpresas((e ?? []) as Empresa[]);
    setCarregando(false);
  };

  const alterar = (id: string, campo: keyof Cfg, valor: unknown) =>
    setCfgs((atual) => atual.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));

  const salvar = async (c: Cfg) => {
    setSalvando(c.id);
    await supabase.from('superfrete_settings').update({
      is_active: c.is_active,
      origin_cep: (c.origin_cep || '').replace(/\D/g, ''),
      services: c.services,
      markup_pct: c.markup_pct,
      markup_fixo: c.markup_fixo,
      updated_at: new Date().toISOString(),
    }).eq('id', c.id);
    setSalvando(null);
    carregar();
  };

  // Testar é cotar de verdade. Sem isso, "configurado" não quer dizer nada:
  // o token pode estar errado e ninguém descobre até um cliente tentar comprar.
  const testar = async (c: Cfg, prefixo: string) => {
    setTestando(c.id);
    setResultado((r) => ({ ...r, [c.id]: { ok: false, texto: 'Cotando…' } }));
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/superfrete-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        // CEP de teste: Jundiaí, o mesmo usado nas comparações de frete.
        body: JSON.stringify({ cep: '13215741', pacotes: 1, valor: 32.9, empresa: prefixo }),
      });
      const j = await resp.json();
      if (!resp.ok) {
        setResultado((r) => ({ ...r, [c.id]: { ok: false, texto: j?.error ?? `Erro ${resp.status}` } }));
      } else if (!j.opcoes?.length) {
        setResultado((r) => ({ ...r, [c.id]: { ok: false, texto: 'Conectou, mas nenhuma transportadora atende esse CEP com os serviços escolhidos.' } }));
      } else {
        setResultado((r) => ({ ...r, [c.id]: { ok: true, texto: `Conectado. Pacote de ${j.peso_kg} kg para Jundiaí:`, opcoes: j.opcoes } }));
      }
    } catch (e) {
      setResultado((r) => ({ ...r, [c.id]: { ok: false, texto: String(e) } }));
    }
    setTestando(null);
    carregar();
  };

  if (carregando) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando integração de frete…
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-10 h-10 bg-[#f5f0ef] rounded-lg flex items-center justify-center">
          <Truck className="w-5 h-5 text-[#8B2214]" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Integração SuperFrete</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Cotação ao vivo de Correios, Loggi e Jadlog com preço de agregador. Bem mais
        barato que a tabela própria em pacote pequeno — a tabela da COFICO continua
        valendo para fardo pesado e para o B2B.
      </p>

      <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900">
        <p className="font-semibold mb-1">Onde fica o token</p>
        <p className="leading-relaxed">
          O token não é digitado aqui de propósito: ele emite etiqueta e gasta seu saldo.
          Cole-o nos <span className="font-mono text-xs">Secrets</span> do Supabase com o nome{' '}
          <span className="font-mono text-xs font-semibold">SUPERFRETE_TOKEN</span>. Esta tela
          só mostra se a conexão funciona.
        </p>
      </div>

      <div className="space-y-6">
        {cfgs.map((c) => {
          const empresa = empresas.find((e) => e.id === c.company_id);
          const res = resultado[c.id];
          return (
            <div key={c.id} className="rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-900">{empresa?.name ?? 'Empresa'}</p>
                  {c.last_ok_at && (
                    <p className="text-xs text-gray-500">
                      Última cotação bem-sucedida em {new Date(c.last_ok_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={c.is_active}
                    onChange={(e) => alterar(c.id, 'is_active', e.target.checked)}
                    className="w-4 h-4 accent-[#8B2214]" />
                  Ativo no checkout
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CEP de origem</label>
                  <input type="text" value={c.origin_cep ?? ''}
                    onChange={(e) => alterar(c.id, 'origin_cep', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Serviços</label>
                  <input type="text" value={c.services}
                    onChange={(e) => alterar(c.id, 'services', e.target.value)}
                    placeholder="1,2,17"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  <p className="mt-1 text-[11px] text-gray-500">Códigos do SuperFrete, separados por vírgula.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Margem (%)</label>
                  <input type="number" step="0.5" value={c.markup_pct}
                    onChange={(e) => alterar(c.id, 'markup_pct', Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Margem fixa (R$)</label>
                  <input type="number" step="0.5" value={c.markup_fixo}
                    onChange={(e) => alterar(c.id, 'markup_fixo', Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={() => salvar(c)} disabled={salvando === c.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B2214] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6d1a10] disabled:opacity-50">
                  {salvando === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </button>
                <button onClick={() => testar(c, empresa?.order_prefix ?? 'CS')} disabled={testando === c.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#8B2214] px-4 py-2 text-sm font-semibold text-[#8B2214] hover:bg-[#8B2214]/5 disabled:opacity-50">
                  {testando === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  Testar conexão
                </button>
              </div>

              {res && (
                <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                  res.ok ? 'border-green-200 bg-green-50 text-green-900' : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}>
                  <p className="flex items-center gap-1.5 font-medium">
                    {res.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {res.texto}
                  </p>
                  {res.opcoes && (
                    <table className="mt-3 w-full text-xs">
                      <tbody>
                        {res.opcoes.map((o) => (
                          <tr key={o.nome} className="border-t border-green-200/60">
                            <td className="py-1.5 pr-3">{o.empresa} — {o.nome}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{brl(o.preco_base)}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">−{brl(o.desconto)}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums font-semibold">{brl(o.preco)}</td>
                            <td className="py-1.5 text-right text-gray-600">
                              {o.prazo_dias != null ? `${o.prazo_dias} dias` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {c.last_error && !res?.ok && (
                <p className="mt-2 text-xs text-red-600 break-all">Último erro: {c.last_error.slice(0, 200)}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
