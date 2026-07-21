import { toast } from 'sonner';

// "Guia: pra onde foi" — modo de aprendizagem. Quando ligado, cada ação
// importante mostra um aviso curto dizendo PARA ONDE o dado foi / ONDE encontrá-lo.
// Ajuda a aprender o mapeamento do site enquanto ele fica complexo.
// Guardado no navegador; padrão LIGADO (desligue quando pegar o jeito).
const GUIDE_KEY = 'guide-mode';

export function isGuideOn(): boolean {
  const v = localStorage.getItem(GUIDE_KEY);
  return v === null ? true : v === '1';
}

export function setGuideOn(on: boolean) {
  localStorage.setItem(GUIDE_KEY, on ? '1' : '0');
  window.dispatchEvent(new CustomEvent('guide-mode-changed', { detail: { on } }));
}

/**
 * Mostra "pra onde foi" — SÓ quando o guia está ligado.
 * @param action  o que acabou de acontecer (ex.: "Lista de prospecção enviada")
 * @param destino onde encontrar agora (ex.: "RepCo → aba Prospecção")
 */
export function guide(action: string, destino: string) {
  if (!isGuideOn()) return;
  toast(action, {
    description: `📍 Onde encontrar: ${destino}`,
    icon: '🧭',
    duration: 6500,
  });
}
