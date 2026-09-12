import type { MensagemToast } from './tipos';

/** Fica 2600 ms na tela, como no HTML oficial. A contagem vive na página. */
export default function Toast({ mensagem }: { mensagem: MensagemToast | null }) {
  return (
    <div className={`toast${mensagem ? ' on' : ''}`}>
      {/* Tudo dentro de UM span. O `.toast` do HTML original e' flex, e
          tres filhos soltos viravam tres colunas espremidas no celular,
          quebrando a frase no meio. Com um filho so, ela volta a fluir
          como texto. */}
      <span>
        {mensagem?.antes}
        {mensagem?.forte ? <b>{mensagem.forte}</b> : null}
        {mensagem?.depois}
      </span>
    </div>
  );
}
