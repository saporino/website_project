import type { MensagemToast } from './tipos';

/** Fica 2600 ms na tela, como no HTML oficial. A contagem vive na página. */
export default function Toast({ mensagem }: { mensagem: MensagemToast | null }) {
  return (
    <div className={`toast${mensagem ? ' on' : ''}`}>
      {mensagem?.antes}
      {mensagem?.forte ? <b>{mensagem.forte}</b> : null}
      {mensagem?.depois}
    </div>
  );
}
