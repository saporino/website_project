import { useState } from 'react';

const SINGLE = [5, 7, 10, 14, 15, 21, 25, 28, 30, 35, 42, 45, 60, 90];

const COMBOS: { label: string; offsets: number[] }[] = [
  { label: '14/28', offsets: [14, 28] },
  { label: '21/28', offsets: [21, 28] },
  { label: '15/30', offsets: [15, 30] },
  { label: '5/30', offsets: [5, 30] },
  { label: '20/40', offsets: [20, 40] },
  { label: '30/35', offsets: [30, 35] },
  { label: '30/40', offsets: [30, 40] },
  { label: '28/42', offsets: [28, 42] },
  { label: '30/45', offsets: [30, 45] },
  { label: '30/60', offsets: [30, 60] },
  { label: '20/40/60', offsets: [20, 40, 60] },
  { label: '30/45/60', offsets: [30, 45, 60] },
  { label: '30/60/90', offsets: [30, 60, 90] },
];

function parseCustom(s: string): number[] {
  return s
    .split(/[^0-9]+/)
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function offsetsFor(key: string, custom: string): number[] {
  if (key === 'avista') return [];
  if (key === 'custom') return parseCustom(custom);
  if (key[0] === 's') return [parseInt(key.slice(1), 10)];
  if (key[0] === 'c') return COMBOS[parseInt(key.slice(1), 10)].offsets;
  return [];
}

function keyForOffsets(offs: number[]): { key: string; custom: string } {
  if (!offs || offs.length === 0) return { key: 'avista', custom: '' };
  if (offs.length === 1 && SINGLE.includes(offs[0])) return { key: 's' + offs[0], custom: '' };
  const ci = COMBOS.findIndex(c => c.offsets.length === offs.length && c.offsets.every((v, i) => v === offs[i]));
  if (ci >= 0) return { key: 'c' + ci, custom: '' };
  return { key: 'custom', custom: offs.join(', ') };
}

type Props = {
  onChange: (offsets: number[]) => void;
  baseTerm?: number; // compatibilidade — não utilizado
  initialOffsets?: number[];
};

export function BoletoCombinationPicker({ onChange, initialOffsets }: Props) {
  const _init = keyForOffsets(initialOffsets || []);
  const [sel, setSel] = useState(_init.key);
  const [custom, setCustom] = useState(_init.custom);

  const offsets = offsetsFor(sel, custom);

  function pick(key: string) {
    setSel(key);
    onChange(offsetsFor(key, custom));
  }

  function typeCustom(value: string) {
    setCustom(value);
    if (sel === 'custom') onChange(parseCustom(value));
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Condição de pagamento</label>
      <select
        value={sel}
        onChange={(e) => pick(e.target.value)}
        className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded focus:outline-none"
      >
        <optgroup label="À vista">
          <option value="avista">À vista / PIX</option>
        </optgroup>
        <optgroup label="Boleto — parcela única">
          {SINGLE.map((n) => (
            <option key={'s' + n} value={'s' + n}>
              {n} dias
            </option>
          ))}
        </optgroup>
        <optgroup label="Boleto — parcelado">
          {COMBOS.map((c, i) => (
            <option key={'c' + i} value={'c' + i}>
              {c.label} dias
            </option>
          ))}
        </optgroup>
        <optgroup label="Outro">
          <option value="custom">Personalizado…</option>
        </optgroup>
      </select>

      {sel === 'custom' && (
        <div className="mt-2">
          <input
            type="text"
            value={custom}
            onChange={(e) => typeCustom(e.target.value)}
            placeholder="Ex: 30, 60, 90"
            className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-gray-500">Dias de vencimento separados por vírgula.</p>
        </div>
      )}

      <p className="mt-1 text-[11px] text-gray-600">
        {offsets.length === 0
          ? 'À vista no PIX (sem boleto).'
          : offsets.length === 1
          ? `1 boleto: vencimento em D+${offsets[0]}.`
          : `${offsets.length} boletos: vencimentos em ${offsets.map((o) => 'D+' + o).join(', ')}.`}
      </p>
    </div>
  );
}

export default BoletoCombinationPicker;
