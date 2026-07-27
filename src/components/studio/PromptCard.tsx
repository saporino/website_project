import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

// Card de um prompt pronto + botão Copiar.
export default function PromptCard({ label, value }: { label: string; value?: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  };
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#f8f7f5] border-b border-gray-200">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{label}</span>
        <button onClick={copy} className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B2214] hover:underline">
          {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
        </button>
      </div>
      <pre className="p-3 text-xs text-gray-700 whitespace-pre-wrap break-words max-h-56 overflow-auto font-sans leading-relaxed">{value}</pre>
    </div>
  );
}
