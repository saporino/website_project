// Coffee LiVRE — destino do QR impresso.
//
// `/coffeelivre/q/ABC23456` é o endereço que vai na embalagem. O código
// nunca muda; o banco resolve para produto, variante e, no futuro, lote, e
// esta tela só troca o endereço pela página certa. Se o slug do produto for
// corrigido amanhã, nenhuma embalagem precisa ser recolhida.
import { useEffect, useState } from 'react';
import NaoEncontrado from './NaoEncontrado';
import { rota } from './config';
import { resolverQr } from './catalogo';

export default function ResolverQr({ codigo }: { codigo: string }) {
  const [falha, setFalha] = useState<'fora_do_ar' | 'desconhecido' | null>(null);

  useEffect(() => {
    let vivo = true;
    resolverQr(codigo).then(destino => {
      if (!vivo) return;
      if (destino.tipo !== 'produto') { setFalha(destino.tipo); return; }
      // replaceState, não pushState: voltar não deve cair de novo no
      // resolvedor e reabrir a mesma página em ciclo.
      const variante = destino.varianteId ? `?v=${destino.varianteId}` : '';
      window.history.replaceState({}, '', rota(`cafe/${destino.slug}`) + variante);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    return () => { vivo = false; };
  }, [codigo]);

  if (falha === 'fora_do_ar') return <NaoEncontrado oQue="Este café não está à venda no momento." />;
  if (falha) return <NaoEncontrado oQue="Este código não corresponde a nenhum café do Coffee LiVRE." />;
  return <main className="wrap"><p className="vazio" style={{ marginTop: 24 }}>Abrindo o café…</p></main>;
}
