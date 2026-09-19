// Rodapé da COFICO — entrada do Coffee LiVRE (apresentação a convidados).
// O código não vai na URL: fica na sessão da aba e o portão do Coffee LiVRE o confere.
import { useState } from 'react';
import { CHAVE_CODIGO_PENDENTE, CHAVE_MODO_PENDENTE } from '../coffeelivre/config';

export default function AcessoCoffeeLivre() {
  const [codigo, setCodigo] = useState('');

  function ir(modo: 'codigo' | 'entrar') {
    try {
      if (modo === 'codigo' && codigo.trim()) sessionStorage.setItem(CHAVE_CODIGO_PENDENTE, codigo.trim());
      if (modo === 'entrar') sessionStorage.setItem(CHAVE_MODO_PENDENTE, 'entrar');
    } catch { /* sem armazenamento: o portão pede de novo */ }
    window.location.assign('/coffeelivre');
  }

  return (
    <form onSubmit={e => { e.preventDefault(); ir('codigo'); }} className="mt-1 max-w-xs" aria-label="Entrar no Coffee LiVRE" data-rodape="coffeelivre">
      <p className="font-semibold text-white mb-2">Coffee LiVRE</p>
      <div className="flex gap-2">
        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Código de convite" aria-label="Código de convite"
          autoComplete="off" className="min-w-0 flex-1 rounded-md bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-white/60" />
        <button type="submit" disabled={!codigo.trim()} className="rounded-md bg-cofico-dark px-3 py-2 text-sm font-semibold text-white hover:bg-cofico-ink disabled:opacity-50">Entrar</button>
      </div>
      <button type="button" onClick={() => ir('entrar')} className="mt-2 text-xs text-white/70 underline hover:text-white">Já tenho cadastro</button>
    </form>
  );
}
