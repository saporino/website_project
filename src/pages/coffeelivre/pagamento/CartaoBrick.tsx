// Cartão pelo Card Payment Brick oficial do Mercado Pago.
//
// Número, validade e CVV são digitados em campos do próprio Mercado Pago (padrão PCI):
// nada disso passa pelo nosso código nem pelo nosso backend. Recebemos só o token.
// ATENÇÃO (U9.1): sem credenciais de teste configuradas, este componente não foi
// exercitado de ponta a ponta; os nomes dos campos do callback seguem a documentação
// do Brick e precisam ser conferidos na U9.2.
import { useEffect, useRef, useState } from 'react';
import type { DadosDoCartao } from './dados';

type BricksBuilder = { create: (tipo: string, id: string, opcoes: unknown) => Promise<{ unmount?: () => void }> };
declare global {
  interface Window { MercadoPago?: new (chave: string, opcoes?: { locale?: string }) => { bricks: () => BricksBuilder } }
}

const SDK = 'https://sdk.mercadopago.com/js/v2';
let carregando: Promise<void> | null = null;

function carregarSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  carregando ??= new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = SDK;
    s.onload = () => ok();
    s.onerror = () => { carregando = null; falha(new Error('Não foi possível carregar o formulário de cartão.')); };
    document.head.appendChild(s);
  });
  return carregando;
}

export default function CartaoBrick({ publicKey, valorCents, aoToken }: {
  publicKey: string;
  valorCents: number;
  aoToken: (dados: DadosDoCartao) => Promise<void> | void;
}) {
  const id = useRef(`pg-cartao-${Math.random().toString(36).slice(2)}`);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    let controle: { unmount?: () => void } | undefined;
    carregarSdk()
      .then(async () => {
        if (!vivo || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
        controle = await mp.bricks().create('cardPayment', id.current, {
          initialization: { amount: valorCents / 100 },
          callbacks: {
            onError: () => setErro('Não foi possível processar o cartão. Confira os dados.'),
            onSubmit: (d: { token: string; payment_method_id: string; installments: number; issuer_id?: string; payer?: { identification?: { number?: string } } }) =>
              aoToken({ token: d.token, payment_method_id: d.payment_method_id, installments: d.installments, issuer_id: d.issuer_id ?? null, cpf: d.payer?.identification?.number ?? null }),
          },
        });
      })
      .catch(e => setErro(e instanceof Error ? e.message : 'Falha no formulário de cartão.'));
    return () => { vivo = false; controle?.unmount?.(); };
  }, [publicKey, valorCents, aoToken]);

  return (
    <div className="pg-brick">
      <div id={id.current} />
      {erro && <p className="ck-erro" role="alert">{erro}</p>}
    </div>
  );
}
