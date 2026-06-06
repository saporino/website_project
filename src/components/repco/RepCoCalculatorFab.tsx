import { useState } from 'react';
import { Calculator, X } from 'lucide-react';
import RepCoCalculator from './RepCoCalculator';

// Botão flutuante (FAB) + modal da Calculadora de Preço RepCo.
// Disponível em todas as telas do RepCoWeb e RepCoApp.
// contained=true → posiciona dentro de um frame relative (ex.: espelho do admin).
export default function RepCoCalculatorFab({ contained = false }: { contained?: boolean }) {
  const [open, setOpen] = useState(false);

  const fabPos = contained
    ? 'absolute bottom-3 right-3'
    : 'fixed bottom-20 md:bottom-6 right-4';
  const overlayPos = contained ? 'absolute inset-0' : 'fixed inset-0';

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Calculadora de Preço"
          className={`${fabPos} z-40 flex items-center gap-2 rounded-full bg-[#8B2214] px-3.5 py-2.5 text-white shadow-lg hover:bg-[#6d1a10] active:scale-95 transition-all`}
        >
          <Calculator className="w-5 h-5" />
          <span className="text-sm font-semibold hidden sm:inline">Calculadora</span>
        </button>
      )}

      {open && (
        <div className={`${overlayPos} z-[70] flex flex-col bg-black/40`} onClick={() => setOpen(false)}>
          <div
            className={`${contained ? 'mt-auto rounded-t-2xl' : 'mt-auto md:mt-0 md:m-auto md:max-w-lg md:rounded-2xl rounded-t-2xl'} w-full bg-[#f8f7f5] shadow-2xl flex flex-col max-h-[92vh]`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#8B2214] rounded-t-2xl flex-shrink-0">
              <div className="flex items-center gap-2 text-white">
                <Calculator className="w-5 h-5" />
                <span className="font-bold text-sm">Calculadora de Preço RepCo</span>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white" title="Fechar e voltar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <RepCoCalculator />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
