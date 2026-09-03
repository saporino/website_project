// Rota de teste /experiencia — renderiza o mesmo HeroExperience usado na HOME (sem fade-pra-branco,
// porque aqui não há seção depois). Serve como palco de iteração visual do hero.
import { useEffect } from 'react';
import HeroExperience from '../components/HeroExperience';

function nav(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function HeroExperiencePage() {
  useEffect(() => { document.title = 'Experiência — Café Saporino'; }, []);
  return (
    <div className="bg-black text-white">
      <HeroExperience onCta={() => nav('/')} />
    </div>
  );
}
