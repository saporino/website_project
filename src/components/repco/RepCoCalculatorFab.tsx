import { useState, useRef, useEffect } from 'react';
import { Calculator, X } from 'lucide-react';
import RepCoCalculator from './RepCoCalculator';
import type { CalcState } from '../../lib/training';

// Botão flutuante (FAB) + modal da Calculadora de Preço RepCo.
// Disponível em todas as telas do RepCoWeb e RepCoApp.
// contained=true → posiciona dentro de um frame relative (ex.: espelho do admin).
export default function RepCoCalculatorFab({
  contained = false,
  open: openProp,
  onOpenChange,
  syncState,
  onCalcStateChange,
  readOnly = false,
  onContentScroll,
  contentScrollPct,
}: {
  contained?: boolean;
  open?: boolean;                       // controlado (ex.: sincronizado por treinamento)
  onOpenChange?: (open: boolean) => void;
  syncState?: CalcState | null;         // estado da calc vindo do instrutor
  onCalcStateChange?: (s: CalcState) => void; // emite estado da calc (instrutor)
  readOnly?: boolean;                   // mirror só-leitura (rep durante treino)
  onContentScroll?: (pct: number) => void;    // instrutor rola → emite posição
  contentScrollPct?: number;                  // rep recebe posição → aplica scroll
}) {
  const [openLocal, setOpenLocal] = useState(false);
  const open = openProp !== undefined ? openProp : openLocal;
  const setOpen = (v: boolean) => { setOpenLocal(v); onOpenChange?.(v); };
  const contentRef = useRef<HTMLDivElement>(null);

  // Aplica o scroll recebido do instrutor (rep segue).
  // syncState nos deps: reaplica após o conteúdo crescer (valores preenchidos).
  // rAF: garante que a altura já estabilizou antes de calcular o scrollTop.
  useEffect(() => {
    if (contentScrollPct === undefined || !contentRef.current) return;
    const el = contentRef.current;
    const apply = () => { el.scrollTop = contentScrollPct * (el.scrollHeight - el.clientHeight); };
    requestAnimationFrame(() => { apply(); requestAnimationFrame(apply); });
  }, [contentScrollPct, open, syncState]);

  const fabPos = contained
    ? 'absolute bottom-3 right-3 z-[800]'
    : 'fixed bottom-20 md:bottom-6 right-4 z-[40]';
  // z alto p/ ficar acima de mapas Leaflet (panes/controles ~600-1000)
  const overlayPos = contained ? 'absolute inset-0 z-[900]' : 'fixed inset-0 z-[1300]';

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Calculadora de Preço"
          className={`${fabPos} flex items-center gap-2 rounded-full bg-[#8B2214] px-3.5 py-2.5 text-white shadow-lg hover:bg-[#6d1a10] active:scale-95 transition-all`}
        >
          <Calculator className="w-5 h-5" />
          <span className="text-sm font-semibold hidden sm:inline">Calculadora</span>
        </button>
      )}

      {open && (
        <div className={`${overlayPos} flex flex-col bg-black/40`} onClick={() => setOpen(false)}>
          <div
            className={`${contained
              ? 'h-full rounded-t-2xl'                                  /* contido: preenche o frame do espelho */
              : 'mt-auto md:mt-0 md:m-auto md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[92vh]'} w-full bg-[#f8f7f5] shadow-2xl flex flex-col`}
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
            <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4"
              onScroll={() => {
                if (!onContentScroll || !contentRef.current) return;
                const el = contentRef.current;
                onContentScroll(el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 0);
              }}>
              <RepCoCalculator syncState={syncState} onStateChange={onCalcStateChange} readOnly={readOnly} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
