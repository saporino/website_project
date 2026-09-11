import { useState } from 'react';
import type { MostrarToast } from './tipos';

export default function Newsletter({ aoAvisar }: { aoAvisar: MostrarToast }) {
  const [email, setEmail] = useState('');
  return (
    <section className="news">
      <div className="wrap">
        <div>
          <b>Receba ofertas e lançamentos de café</b><br />
          <span style={{ opacity: .85, fontSize: '13px' }}>Novas safras, microlotes e cupons exclusivos.</span>
        </div>
        <form onSubmit={e => { e.preventDefault(); aoAvisar({ antes: 'Cadastro recebido (mockup)' }); setEmail(''); }}>
          <input type="email" required placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <button>Cadastrar</button>
        </form>
      </div>
    </section>
  );
}
