import { useState } from 'react';
import CompartilharWhats from './CompartilharWhats';
import { MINIMO_PADRAO, type EmbalagemItem } from './embalagens';

// Card de embalagem com galeria: a foto principal troca ao clicar nos quadrinhos.
// Serve para mostrar medida, usos e o que não acompanha sem poluir o card.
export default function CardEmbalagem({ item, ancora }: { item: EmbalagemItem; ancora: string }) {
  const fotos = [item.foto, ...(item.fotos ?? [])].filter(Boolean) as string[];
  const [atual, setAtual] = useState(0);
  const linha = (rotulo: string, valor?: string, mono = false) => valor ? (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-500">{rotulo}</dt>
      <dd className={`font-medium ${mono ? 'font-mono text-[13px]' : ''}`}>{valor}</dd>
    </div>
  ) : null;

  return (
    <article className="border border-neutral-200 p-6 flex flex-col">
      {fotos.length > 0 && (
        <>
          <div className="aspect-square flex items-center justify-center">
            <img src={fotos[atual]} alt={item.nome} className="w-full h-full object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          {fotos.length > 1 && (
            <div className="mt-3 flex gap-2">
              {fotos.map((f, i) => (
                <button key={f} type="button" onClick={() => setAtual(i)}
                  aria-label={`Foto ${i + 1} de ${item.nome}`} aria-current={i === atual}
                  className={`w-12 h-12 border p-1 transition-colors ${i === atual ? 'border-cofico-ink' : 'border-neutral-200 hover:border-neutral-400'}`}>
                  <img src={f} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <h3 className="mt-4 text-base font-semibold leading-snug">{item.nome}</h3>
      {item.detalhes?.length ? (
        <p className="mt-2 text-sm text-neutral-600 flex-1">{item.detalhes.join(' · ')}</p>
      ) : <span className="flex-1" />}
      <dl className="mt-4 text-sm border-t border-neutral-200 pt-3 space-y-1">
        {linha('Capacidade', item.capacidade)}
        {linha('Medidas', item.medidas)}
        {linha('Cor', item.cor)}
        {linha('Mínimo', item.minimo ?? MINIMO_PADRAO)}
        {linha('Código', item.codigo, true)}
      </dl>
      <CompartilharWhats titulo={item.nome} ancora={ancora} />
    </article>
  );
}
