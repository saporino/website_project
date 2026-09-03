// ABERTURA do site Saporino: em "/" renderiza SÓ o HERO (nada abaixo → o scroll termina no fim dele).
// Só o clique em "CONHEÇA A SAPORINO" sai da abertura e entra na HOME (AppContent). Decisão do Vlademir
// (03/09/2026): "o HERO fica por si só até a pessoa clicar". A abertura aparece em TODA entrada no site
// (cada carregamento de "/"); navegar dentro do site de volta para "/" não a repete (estado do AppRouter).
import HeroExperience from './HeroExperience';

export default function HeroGate({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="bg-black text-white min-h-screen">
      <HeroExperience onCta={onEnter} />
    </div>
  );
}
