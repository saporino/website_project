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
import { cotarSuperFrete, cotarFrete, pesoBrutoKg, brl, type Cotacao } from '../lib/freight';

type Degrau = {
  rotulo: string;
  pacotes: number;
  /** Preço estimado do café, só para a coluna de frete por quilo fazer sentido. */
  destaque?: boolean;
};

// Até 4 pacotes a venda é avulsa; de 5 kg em diante o cliente compra em fardos.
//
// A escada para em 4 fardos porque é onde as transportadoras param: medido no
// dia 08/09/2026, 20 kg ainda é cotado por Jadlog, Loggi, SEDEX e PAC, e a
// 50 kg nenhuma delas aceita. Mostrar 50 ou 100 kg dava um preço que não
// existe — vinha da tabela própria, que não tem limite de peso.
const DEGRAUS: Degrau[] = [
  { rotulo: '1 pacote', pacotes: 1 },
  { rotulo: '2 pacotes', pacotes: 2 },
  { rotulo: '3 pacotes', pacotes: 3 },
  { rotulo: '4 pacotes', pacotes: 4 },
  { rotulo: '1 fardo (5 kg)', pacotes: 10, destaque: true },
  { rotulo: '2 fardos (10 kg)', pacotes: 20 },
  { rotulo: '4 fardos (20 kg)', pacotes: 40 },
  // Acima de 20 kg o agregador recusa e a entrega é da COFICO, com a tabela
  // por faixa de CEP. Continua sendo venda ao consumidor, só que na nossa
  // própria logística.
  { rotulo: '10 fardos (50 kg)', pacotes: 100 },
  { rotulo: '20 fardos (100 kg)', pacotes: 200 },
];

type Linha = Degrau & { peso: number; cotacao: Cotacao | null; transportadora?: string | null };

export default function FreightSimulator({
  cep,
  precoPorPacote,
  pacotesNoCarrinho,
  aoEscolher,
}: {
  cep: string;
  /** Usado para calcular seguro, o custo por quilo e o total de cada degrau. */
  precoPorPacote: number;
  /** Quantos pacotes já estão na sacola, para marcar a linha atual. */
  pacotesNoCarrinho?: number;
  /**
   * Trocar a quantidade direto da tabela. Sem isto o cliente vê a vantagem do
   * fardo e precisa voltar à sacola somando pacote por pacote — mostrar o
   * benefício sem dar o caminho é só frustrar.
   * Ausente quando a sacola tem produtos diferentes: aí não dá para saber de
   * qual café ele quer o fardo.
   */
  aoEscolher?: (pacotes: number) => void;
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
        const valor = d.pacotes * precoPorPacote;

        // Preço real do agregador primeiro: é o que o cliente vai pagar de
        // verdade no checkout. A tabela própria fica de reserva para quando o
        // agregador não responder ou não atender aquele CEP.
        const sf = await cotarSuperFrete(cep, d.pacotes, valor);
        const melhorOpcao = sf?.opcoes?.[0];

        // Acima de ~20 kg o agregador recusa tudo; aí quem entrega é a COFICO,
        // com a tabela por faixa de CEP. Abaixo disso o agregador sempre ganha.
        const daCasa = melhorOpcao ? null : await cotarFrete(cep, peso, valor, d.pacotes);

        const cotacao: Cotacao | null = melhorOpcao
          ? {
              atendido: true, zona: null, uf: null, cidade: null,
              dias: melhorOpcao.prazo_dias,
              transporte: melhorOpcao.preco_base,
              // O agregador entrega um preço fechado: seguro e GRIS já estão
              // dentro dele, sem discriminar. Só a tabela própria abre a conta.
              seguro: 0,
              gris: 0,
              desconto: melhorOpcao.desconto,
              preco: melhorOpcao.preco,
            }
          : (daCasa?.atendido ? daCasa : null);

        resultado.push({
          ...d, peso, cotacao,
          transportadora: melhorOpcao ? melhorOpcao.nome : (daCasa?.atendido ? 'COFICO' : null),
        });
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
      {/* Empurrão com fato, não com apelo: mostra em reais o que o cliente ganha
          subindo um degrau. Só aparece quando ele está num degrau que não é o
          melhor negócio — quem já levou o fardo não precisa ouvir isso. */}
      {(() => {
        if (!aoEscolher || !pacotesNoCarrinho) return null;
        const atual = atendidas.find((l) => l.pacotes === pacotesNoCarrinho);
        const proximo = atendidas.find((l) => l.pacotes > pacotesNoCarrinho);
        if (!atual || !proximo) return null;

        const porKgAtual = atual.cotacao!.preco / atual.peso;
        const porKgProximo = proximo.cotacao!.preco / proximo.peso;
        if (porKgProximo >= porKgAtual) return null;

        const cafeAMais = (proximo.pacotes - atual.pacotes) * precoPorPacote;
        const freteAMais = proximo.cotacao!.preco - atual.cotacao!.preco;

        return (
          <div className="border-b border-[#8B2214]/20 bg-[#8B2214]/5 px-4 py-3">
            <p className="text-sm font-semibold text-[#8B2214]">
              Levando {proximo.rotulo.toLowerCase()}, o frete quase não muda
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-700">
              Mais {brl(cafeAMais)} de café e {freteAMais <= 0
                ? <>o frete ainda <b>diminui {brl(-freteAMais)}</b></>
                : <>só {brl(freteAMais)} a mais de frete</>}.
              O frete por quilo cai de {brl(porKgAtual)} para <b>{brl(porKgProximo)}</b>.
            </p>
            <button type="button" onClick={() => aoEscolher(proximo.pacotes)}
              className="mt-2 rounded-full bg-[#8B2214] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#6d1a10]">
              Quero {proximo.rotulo.toLowerCase()}
            </button>
          </div>
        );
      })()}

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

      {/* Linhas em vez de tabela: seis colunas não cabem na largura de um
          celular, e barra de rolagem lateral esconde justamente a coluna do
          total. Aqui cada degrau é uma linha inteira clicável, que encolhe
          junto com a tela. */}
      <ul className="divide-y divide-gray-100">
        {atendidas.map((l) => {
          const porKg = l.cotacao!.preco / l.peso;
          const cafe = l.pacotes * precoPorPacote;
          const ehMelhor = l.rotulo === melhor.rotulo;
          const ehAtual = pacotesNoCarrinho === l.pacotes;

          const conteudo = (
            <div className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-gray-900">
                  <span>{l.rotulo}</span>
                  {ehMelhor && (
                    <span className="rounded-full bg-[#8B2214] px-2 py-0.5 text-[10px] font-semibold text-white">
                      melhor frete
                    </span>
                  )}
                  {ehAtual && (
                    <span className="rounded-full border border-[#8B2214] px-2 py-0.5 text-[10px] font-semibold text-[#8B2214]">
                      na sacola
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
                  {/* Frete coberto por inteiro é notícia boa: mostra o valor que
                      ele deixou de pagar, riscado, em vez de esconder um zero. */}
                  {l.cotacao!.preco <= 0 && l.cotacao!.desconto > 0 ? (
                    <>
                      café {brl(cafe)} + frete{' '}
                      <span className="line-through">{brl(l.cotacao!.transporte)}</span>{' '}
                      <span className="font-bold text-green-700">GRÁTIS</span>
                    </>
                  ) : (
                    <>
                      café {brl(cafe)} + frete {brl(l.cotacao!.preco)}
                      {l.cotacao!.desconto > 0 && (
                        <span className="text-green-700"> (já com {brl(l.cotacao!.desconto)} de desconto)</span>
                      )}
                    </>
                  )}
                  <span className="block sm:inline sm:before:content-['_·_']">
                    frete {brl(porKg)}/kg
                  </span>
                  {l.transportadora && (
                    <span className="block">
                      {l.transportadora}
                      {l.cotacao!.dias ? ` · ${l.cotacao!.dias} dias` : ''}
                    </span>
                  )}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums text-gray-900">{brl(cafe + l.cotacao!.preco)}</p>
                {aoEscolher && !ehAtual && (
                  <span className="mt-0.5 inline-block text-[11px] font-semibold text-[#8B2214]">
                    Quero esta →
                  </span>
                )}
              </div>
            </div>
          );

          return (
            <li key={l.rotulo} className={l.destaque ? 'bg-[#faf8f7]' : ''}>
              {aoEscolher && !ehAtual ? (
                <button
                  type="button"
                  onClick={() => aoEscolher(l.pacotes)}
                  className="w-full transition-colors hover:bg-[#8B2214]/5"
                >
                  {conteudo}
                </button>
              ) : (
                <div className={ehAtual ? 'bg-[#8B2214]/5' : ''}>{conteudo}</div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
        {primeira.cotacao!.cidade
          ? `Entrega para ${primeira.cotacao!.cidade}/${primeira.cotacao!.uf}. `
          : 'Frete cotado ao vivo com as transportadoras. '}
        Mostramos o mais barato de cada quantidade — no checkout você escolhe entre
        elas, comparando preço e prazo.
      </p>
    </div>
  );
}
