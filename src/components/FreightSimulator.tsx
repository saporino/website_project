// Simulador de frete — mostra ao cliente por que vale a pena levar mais.
//
// A transportadora cobra por FAIXA de peso: até 10 kg custa o mesmo. Então
// quem leva um pacote paga quase o mesmo frete de quem leva um fardo — só que
// diluído em dez vezes menos café. Esse é o argumento de venda, e ele fica
// invisível se o cliente só vê o total do próprio carrinho.
//
// Aqui ele vê a escada inteira e decide sozinho.
import { useEffect, useState } from 'react';
import { Truck, Loader2 } from 'lucide-react';
import { cotarFrete, pesoBrutoKg, brl, type Cotacao } from '../lib/freight';

type Degrau = {
  rotulo: string;
  pacotes: number;
  /** Preço estimado do café, só para a coluna de frete por quilo fazer sentido. */
  destaque?: boolean;
};

// Até 4 pacotes a venda é avulsa; de 5 kg em diante o cliente compra em fardos.
const DEGRAUS: Degrau[] = [
  { rotulo: '1 pacote', pacotes: 1 },
  { rotulo: '2 pacotes', pacotes: 2 },
  { rotulo: '3 pacotes', pacotes: 3 },
  { rotulo: '4 pacotes', pacotes: 4 },
  { rotulo: '1 fardo (5 kg)', pacotes: 10, destaque: true },
  { rotulo: '2 fardos (10 kg)', pacotes: 20 },
  { rotulo: '4 fardos (20 kg)', pacotes: 40 },
  { rotulo: '10 fardos (50 kg)', pacotes: 100 },
  { rotulo: '20 fardos (100 kg)', pacotes: 200 },
];

type Linha = Degrau & { peso: number; cotacao: Cotacao | null };

export default function FreightSimulator({
  cep,
  precoPorPacote,
}: {
  cep: string;
  /** Usado só para calcular seguro e o custo por quilo. */
  precoPorPacote: number;
}) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [semCobertura, setSemCobertura] = useState(false);

  useEffect(() => {
    const digitos = (cep || '').replace(/\D/g, '');
    if (digitos.length !== 8) { setLinhas([]); return; }

    let cancelado = false;
    (async () => {
      setCarregando(true);
      setSemCobertura(false);
      const resultado: Linha[] = [];
      for (const d of DEGRAUS) {
        const peso = await pesoBrutoKg(d.pacotes);
        const cotacao = await cotarFrete(cep, peso, d.pacotes * precoPorPacote);
        resultado.push({ ...d, peso, cotacao });
      }
      if (cancelado) return;
      setSemCobertura(resultado.every((l) => !l.cotacao?.atendido));
      setLinhas(resultado);
      setCarregando(false);
    })();
    return () => { cancelado = true; };
  }, [cep, precoPorPacote]);

  const digitos = (cep || '').replace(/\D/g, '');
  if (digitos.length !== 8) return null;

  if (carregando) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calculando o frete para cada quantidade…
      </div>
    );
  }

  if (semCobertura || linhas.length === 0) return null;

  const atendidas = linhas.filter((l) => l.cotacao?.atendido);
  if (atendidas.length === 0) return null;

  const primeira = atendidas[0];
  const melhor = atendidas.reduce((a, b) =>
    (b.cotacao!.preco / b.peso) < (a.cotacao!.preco / a.peso) ? b : a);
  const quedaPct = Math.round(
    (1 - (melhor.cotacao!.preco / melhor.peso) / (primeira.cotacao!.preco / primeira.peso)) * 100);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-start gap-3 border-b border-gray-200 bg-[#f5f0ef] px-4 py-3">
        <Truck className="mt-0.5 h-5 w-5 shrink-0 text-[#8B2214]" />
        <div>
          <p className="text-sm font-semibold text-gray-900">Quanto mais você leva, mais barato fica o frete</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
            A transportadora cobra por faixa de peso, não por quilo. Levando mais,
            você divide o mesmo frete por mais café — a economia chega a {quedaPct}% por quilo.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2 text-left font-medium">Quantidade</th>
              <th className="px-4 py-2 text-right font-medium">Peso</th>
              <th className="px-4 py-2 text-right font-medium">Frete</th>
              <th className="px-4 py-2 text-right font-medium">Frete por kg</th>
            </tr>
          </thead>
          <tbody>
            {atendidas.map((l) => {
              const porKg = l.cotacao!.preco / l.peso;
              const ehMelhor = l.rotulo === melhor.rotulo;
              return (
                <tr key={l.rotulo} className={`border-t border-gray-100 ${l.destaque ? 'bg-[#faf8f7]' : ''}`}>
                  <td className="px-4 py-2.5 text-gray-900">
                    {l.rotulo}
                    {ehMelhor && (
                      <span className="ml-2 rounded-full bg-[#8B2214] px-2 py-0.5 text-[10px] font-semibold text-white">
                        melhor frete
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                    {l.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{brl(l.cotacao!.preco)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${ehMelhor ? 'text-[#8B2214]' : 'text-gray-700'}`}>
                    {brl(porKg)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
        Entrega para {primeira.cotacao!.cidade}/{primeira.cotacao!.uf}
        {primeira.cotacao!.dias ? ` em até ${primeira.cotacao!.dias} dias úteis` : ''}.
        Valores já com o desconto de envio da loja.
      </p>
    </div>
  );
}
