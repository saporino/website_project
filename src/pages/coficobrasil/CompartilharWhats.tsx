import { MessageCircle } from 'lucide-react';

// Compartilhar um produto no WhatsApp, direto — sem janela de "escolha a rede".
// O cliente aperta, o WhatsApp abre com o nome do produto e o link da página, e ele
// escolhe para quem manda. É como o comprador B2B repassa um item para o sócio ou o chefe.
//
// O endereço é lido na hora do clique (window.location), então funciona em qualquer
// domínio e já leva a âncora da seção.
export default function CompartilharWhats({ titulo, ancora }: { titulo: string; ancora?: string }) {
  function abrir() {
    const base = `${window.location.origin}${window.location.pathname}`;
    const url = ancora ? `${base}#${ancora}` : `${base}${window.location.hash}`;
    const texto = `${titulo} — COFICO Brasil\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer');
  }
  return (
    <button type="button" onClick={abrir}
      title="Compartilhar este produto no WhatsApp"
      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-cofico-ink transition-colors">
      <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> Compartilhar no WhatsApp
    </button>
  );
}
