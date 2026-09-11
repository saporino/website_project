import { navegar, rota } from './config';

/** 404 dentro do Coffee LiVRE. Nunca joga o visitante para fora da marca. */
export default function NaoEncontrado({ oQue }: { oQue: string }) {
  return (
    <main className="wrap">
      <div className="nao-achou">
        <h1>Não encontramos essa página</h1>
        <p>{oQue}</p>
        <a href={rota()} onClick={e => { e.preventDefault(); navegar(''); }}>Voltar para a home</a>
      </div>
    </main>
  );
}
