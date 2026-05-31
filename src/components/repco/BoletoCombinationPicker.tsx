import { useState } from 'react';

const PRESETS: { label: string; offsets: number[] }[] = [
  { label: '\u00c0 vista / PIX',    offsets: [] },
  { label: '1x',                  offsets: [30] },
  { label: '2x (30/60)',          offsets: [30, 60] },
  { label: '2x (14/28)',          offsets: [14, 28] },
  { label: '3x (30/60/90)',       offsets: [30, 60, 90] },
  { label: '4x (30/60/90/120)',   offsets: [30, 60, 90, 120] },
  { label: '5x (30/60/90/120/150)', offsets: [30, 60, 90, 120, 150] },
  { label: '1x7d',                offsets: [7] },
  { label: '1x14d',               offsets: [14] },
  { label: '1x28d',               offsets: [28] },
  { label: 'Personalizado',       offsets: [] },
];

interface Props {
  baseTerm: number;
  onChange: (offsets: number[]) => void;
}

export default function BoletoCombinationPicker({ baseTerm, onChange }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState<string>('');
  const isCustom = selected !== null && PRESETS[selected]?.label === 'Personalizado';

  function select(idx: number) {
    setSelected(idx);
    const preset = PRESETS[idx];
    if (preset.label === 'Personalizado') {
      const parsed = parseCustom(custom);
      onChange(parsed);
    } else {
      onChange(preset.offsets.length ? preset.offsets : [baseTerm]);
    }
  }

  function parseCustom(raw: string): number[] {
    return raw
      .split(/[,\s\/]+/)
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n) && n > 0 && n <= 365)
      .slice(0, 5);
  }

  function handleCustomChange(val: string) {
    setCustom(val);
    onChange(parseCustom(val));
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600">Combina\u00e7\u00e3o de vencimentos (dias a partir de hoje)</p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.filter(p => p.label !== '\u00c0 vista / PIX').map((p, idx) => (
          <button
            key={p.label}
            type="button"
            onClick={() => select(idx + 1)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              selected === idx + 1
                ? 'border-[#a4240e] bg-red-50 text-[#a4240e]'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {isCustom && (
        <div className="space-y-1">
          <input
            type="text"
            value={custom}
            onChange={e => handleCustomChange(e.target.value)}
            placeholder="Ex: 30, 60, 90  (dias separados por v\u00edrgula, m\u00e1x 5)"
            className="w-full h-[34px] px-3 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#a4240e]"
          />
          <p className="text-xs text-gray-400">
            Dias de vencimento separados por v\u00edrgula (ex: 30, 60 = 2 boletos)
          </p>
        </div>
      )}
      {selected !== null && !isCustom && PRESETS[selected]?.offsets.length > 0 && (
        <p className="text-xs text-gray-500">
          {PRESETS[selected].offsets.length} boleto{PRESETS[selected].offsets.length > 1 ? 's' : ''}: vencimentos em{' '}
          {PRESETS[selected].offsets.map(d => `D+${d}`).join(', ')}
        </p>
      )}
    </div>
  );
}
