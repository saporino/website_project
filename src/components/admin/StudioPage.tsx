import { Clapperboard } from 'lucide-react';

// Saporino Studio — engenharia reversa de vídeos com IA.
// PASSO 1: só a entrada (aba + página). O conteúdo (upload, análise, campanhas)
// entra nos próximos passos do briefing.
export default function StudioPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-xl bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center">
          <Clapperboard className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saporino Studio</h1>
          <p className="text-sm text-gray-500">Engenharia reversa de vídeos com IA</p>
        </div>
      </div>

      <div className="mt-6 bg-white border border-dashed border-[#ddd0cc] rounded-2xl p-10 text-center">
        <Clapperboard className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-sm font-semibold text-gray-700">Studio em construção</p>
        <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
          Em breve: arraste um vídeo, a IA analisa e entrega relatório, prompts prontos e campanhas.
          Por enquanto esta é só a entrada do módulo (Passo 1).
        </p>
      </div>
    </div>
  );
}
