// Coffee LiVRE — administração do portão da demonstração.
//
// Primeiro recorte do admin da plataforma. Faz três coisas e nada além:
// criar código, desativar código e mostrar quanto cada um foi usado.
//
// O código nunca volta do banco: guardamos hash. Por isso ele é exibido UMA
// vez, na hora da criação, e some. O `label` existe justamente para você
// lembrar a quem entregou cada um.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { KeyRound, Plus, Power, Loader2, Copy, Check } from 'lucide-react';

interface Codigo {
  id: string;
  label: string;
  ativo: boolean;
  uses: number;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

/** Código legível: sem 0/O e 1/I, que viram erro de digitação ao telefone. */
function sortearCodigo(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bloco = () => Array.from({ length: 4 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join('');
  return `${bloco()}-${bloco()}`;
}

export default function LivreAcesso() {
  const [codigos, setCodigos] = useState<Codigo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [rotulo, setRotulo] = useState('');
  // Mostrado uma única vez, logo após criar. Depois nem nós conseguimos ler.
  const [recemCriado, setRecemCriado] = useState<{ label: string; codigo: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('lv_demo_access')
      .select('id, label, ativo, uses, last_used_at, expires_at, created_at')
      .order('created_at', { ascending: false });
    if (error) toast.error('Não foi possível ler os códigos.');
    setCodigos((data as Codigo[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function criar() {
    const nome = rotulo.trim();
    if (nome.length < 2) { toast.error('Diga para quem é este código.'); return; }
    setCriando(true);
    const codigo = sortearCodigo();
    // O hash é calculado no banco pela mesma função que confere depois. Se
    // fosse calculado aqui, as duas pontas poderiam divergir.
    const { data: hash, error: eh } = await supabase.rpc('lv_normalizar_codigo', { bruto: codigo });
    if (eh || !hash) { toast.error('Falhou ao preparar o código.'); setCriando(false); return; }

    const { error } = await supabase.from('lv_demo_access').insert({ label: nome, code_hash: hash });
    setCriando(false);
    if (error) { toast.error('Não foi possível criar: ' + error.message); return; }
    setRecemCriado({ label: nome, codigo });
    setCopiado(false);
    setRotulo('');
    carregar();
  }

  async function alternar(c: Codigo) {
    const { error } = await supabase.from('lv_demo_access').update({ ativo: !c.ativo }).eq('id', c.id);
    if (error) { toast.error('Não foi possível alterar.'); return; }
    toast.success(c.ativo ? 'Código desativado.' : 'Código reativado.');
    carregar();
  }

  const quando = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-bold text-gray-900">Acesso à demonstração</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Quem tem um código entra em <code className="text-xs">/coffeelivre</code> e a sessão dura 30 dias.
          Barreira de apresentação, não autenticação: não use para dado sensível.
        </p>
      </div>

      {/* Aparece uma vez só. Depois o código não é mais legível por ninguém. */}
      {recemCriado && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Código de “{recemCriado.label}” criado. Copie agora: ele não será exibido de novo.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-white px-3 py-2 font-mono text-lg font-bold tracking-wider text-gray-900 border border-amber-200">
              {recemCriado.codigo}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(recemCriado.codigo);
                setCopiado(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-[#8B2214] px-3 py-2 text-sm font-semibold text-white hover:bg-[#6d1a10]"
            >
              {copiado ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar</>}
            </button>
            <button onClick={() => setRecemCriado(null)} className="text-sm text-amber-900 hover:underline">
              Já guardei
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Novo código</label>
        <div className="flex flex-wrap gap-2">
          <input
            value={rotulo}
            onChange={e => setRotulo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') criar(); }}
            placeholder="Para quem é? Ex.: Investidor João, Feira do Café"
            className="min-w-[240px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={criar}
            disabled={criando}
            className="flex items-center gap-2 rounded-lg bg-[#8B2214] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6d1a10] disabled:opacity-50"
          >
            {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Gerar
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {carregando ? (
          <p className="p-5 text-sm text-gray-500">Carregando…</p>
        ) : codigos.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">Nenhum código criado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f5f0ef] text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Para quem</th>
                  <th className="px-4 py-2.5 font-semibold">Situação</th>
                  <th className="px-4 py-2.5 font-semibold tabular-nums">Usos</th>
                  <th className="px-4 py-2.5 font-semibold">Último acesso</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {codigos.map(c => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.label}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        c.ativo ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {c.ativo ? 'Ativo' : 'Desativado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">{c.uses}</td>
                    <td className="px-4 py-3 text-gray-500">{quando(c.last_used_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => alternar(c)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#8B2214]"
                      >
                        <Power className="h-3.5 w-3.5" /> {c.ativo ? 'Desativar' : 'Reativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-gray-400">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        Os códigos são guardados como hash e conferidos no servidor. Nem o administrador relê um
        código antigo: se alguém perder o dele, gere outro e desative o anterior.
      </p>
    </div>
  );
}
