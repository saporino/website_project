// Peso e dimensões da embalagem de envio.
//
// O frete é cobrado por faixa de peso, e o peso que vale é o BRUTO: café mais
// envelope. Declarar só o líquido faz o frete sair subestimado, e a diferença
// sai do nosso bolso. Por isso a tara fica aqui, editável — envelope muda de
// fornecedor, e a balança manda mais que a estimativa.
import { useEffect, useState } from 'react';
import { Package, Save, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Spec = {
  id: string;
  units: number;
  block_w_cm: number | null;
  block_d_cm: number | null;
  block_h_cm: number | null;
  envelope: string | null;
  tare_g: number;
  is_estimate: boolean;
  notes: string | null;
};

export default function PackagingSettings() {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setCarregando(true);
    const { data } = await supabase.from('packaging_specs').select('*').order('units');
    setSpecs((data ?? []) as Spec[]);
    setCarregando(false);
  };

  const alterar = (id: string, campo: keyof Spec, valor: string) => {
    setSpecs((atual) => atual.map((s) => s.id === id
      ? { ...s, [campo]: campo === 'envelope' ? valor : Number(valor) }
      : s));
  };

  const salvar = async (spec: Spec) => {
    setSalvando(spec.id);
    setAviso('');
    const { error } = await supabase.from('packaging_specs').update({
      block_w_cm: spec.block_w_cm, block_d_cm: spec.block_d_cm, block_h_cm: spec.block_h_cm,
      envelope: spec.envelope, tare_g: spec.tare_g,
      // Editado à mão deixa de ser estimativa: alguém olhou.
      is_estimate: false,
    }).eq('id', spec.id);
    setSalvando(null);
    if (error) { setAviso(`Não deu para salvar: ${error.message}`); return; }
    setAviso(`Embalagem de ${spec.units} ${spec.units === 1 ? 'pacote' : 'pacotes'} atualizada.`);
    carregar();
  };

  if (carregando) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando embalagens…
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-10 h-10 bg-[#f5f0ef] rounded-lg flex items-center justify-center">
          <Package className="w-5 h-5 text-[#8B2214]" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Embalagem de envio</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        O frete é cobrado pelo peso do pacote fechado — café mais envelope. Se a tara aqui
        estiver menor que a real, o frete sai mais barato do que deveria e a diferença é nossa.
        Confira na balança quando os envelopes chegarem.
      </p>

      {aviso && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-800">
          {aviso}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-4 text-left font-medium">Pacotes</th>
              <th className="py-2 pr-3 text-left font-medium">Largura</th>
              <th className="py-2 pr-3 text-left font-medium">Espessura</th>
              <th className="py-2 pr-3 text-left font-medium">Altura</th>
              <th className="py-2 pr-3 text-left font-medium">Envelope</th>
              <th className="py-2 pr-3 text-left font-medium">Tara (g)</th>
              <th className="py-2 pr-3 text-left font-medium">Peso bruto</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {specs.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-3 pr-4">
                  <span className="font-semibold text-gray-900">{s.units}</span>
                  {s.units === 10 && <span className="ml-1 text-xs text-gray-500">(fardo)</span>}
                  {s.is_estimate && (
                    <span title={s.notes ?? ''} className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      <AlertTriangle className="w-3 h-3" /> estimado
                    </span>
                  )}
                </td>
                {(['block_w_cm', 'block_d_cm', 'block_h_cm'] as const).map((campo) => (
                  <td key={campo} className="py-3 pr-3">
                    <input type="number" step="0.5" value={s[campo] ?? ''}
                      onChange={(e) => alterar(s.id, campo, e.target.value)}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                  </td>
                ))}
                <td className="py-3 pr-3">
                  <input type="text" value={s.envelope ?? ''}
                    onChange={(e) => alterar(s.id, 'envelope', e.target.value)}
                    className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                </td>
                <td className="py-3 pr-3">
                  <input type="number" value={s.tare_g}
                    onChange={(e) => alterar(s.id, 'tare_g', e.target.value)}
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                </td>
                <td className="py-3 pr-3 tabular-nums text-gray-700">
                  {((s.units * 500 + s.tare_g) / 1000).toFixed(3)} kg
                </td>
                <td className="py-3">
                  <button onClick={() => salvar(s)} disabled={salvando === s.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B2214] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6d1a10] disabled:opacity-50">
                    {salvando === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Salvar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Quantidades entre as faixas usam a faixa maior mais próxima, e acima da última o
        sistema extrapola pela tara por unidade. Erra para mais de propósito: cobrar frete
        a menos é prejuízo, cobrar centavos a mais não perde venda.
      </p>
    </div>
  );
}
