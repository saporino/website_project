// Mensagem do toast, em partes.
//
// No HTML o toast recebe HTML cru ("<b>X</b> foi adicionado..."). Aqui o
// negrito vira JSX: mesma aparência, sem dangerouslySetInnerHTML.
export interface MensagemToast {
  antes?: string;
  forte?: string;
  depois?: string;
}

export type MostrarToast = (m: MensagemToast) => void;
