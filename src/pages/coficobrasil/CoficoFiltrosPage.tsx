// Página FILTROS E COADORES da COFICO (#filtros) — linha própria, vendida junto com o café.
//
// REGRA DE CONTEÚDO: sem número inventado. Tamanho, marca, quantidade por caixa e preço
// saem da tabela, com o comercial. Aqui fica só o que existe de fato.
import { useEffect } from 'react';
import { ArrowRight, Filter, Layers, Recycle, ShoppingBag, Tag, Boxes, Factory } from 'lucide-react';
import CoficoHeader from './CoficoHeader';
import CoficoFooter from './CoficoFooter';
import { whatsAppCofico } from './conteudo';

// Filtros falam com o Marcelo, não com o comercial geral da COFICO. Número dele,
// combinado com o Vlademir em 26/09/2026 — vale SÓ nesta página, por enquanto.
const WHATSAPP_MARCELO = '+55 14 99174-3909';
const WA_FILTROS = whatsAppCofico(WHATSAPP_MARCELO, 'Olá! Vim pelo site da COFICO e quero a tabela de filtros e coadores.');
const WA_MARCA_PROPRIA = whatsAppCofico(WHATSAPP_MARCELO, 'Olá! Vim pelo site da COFICO e quero produzir filtro de papel com a minha marca.');

// LINHA PAPEL COFICO — dados do próprio produto (arte da caixa + códigos COFICO).
// Quantidade por caixa master ainda NÃO entra: o Vlademir precisa confirmar (10 ou 40 cartuchos).
const PAPEL = [
  { n: '100', codigo: 'COFI1003040', uso: 'Para coador nº 100 — a medida de 1 a 2 xícaras, do café feito na hora.' },
  { n: '102', codigo: 'COFI1023040', uso: 'A medida mais usada no Brasil, para coador nº 102 e cafeteira elétrica doméstica.' },
  { n: '103', codigo: 'COFI1033040', uso: 'Para coador nº 103, de volume maior — padaria, escritório e cozinha industrial.' },
];

// LINHA COADORES — cabo plástico, filtro de algodão. Dados da ficha do produto.
// A marca é COFICO ou a do cliente (marca própria) — vale para todas as categorias.
// Nome e referência são os da COFICO: o material de origem vinha como "Colonial".
const COADORES = [
  {
    ref: 'COFI19P', tamanho: 'P', nome: 'Coador de algodão com cabo plástico — P',
    diametro: '95 mm (9,5 cm)', volume: 'até 1 litro',
    foto: '/cofico/coador-cabo-plastico-p.webp',
    uso: 'O tamanho de casa e do cafezinho do balcão: prepara até 1 litro, com o sabor do café coado na hora.',
  },
  {
    ref: 'COFI20M', tamanho: 'M', nome: 'Coador de algodão com cabo plástico — M',
    diametro: '110 mm (11 cm)', volume: 'até 2 litros',
    foto: '/cofico/coador-cabo-plastico-m.webp',
    uso: 'Para servir a mesa toda de uma vez: prepara até 2 litros, com extração consistente, mais corpo e aroma.',
  },
  {
    ref: 'COFI21G', tamanho: 'G', nome: 'Coador de algodão com cabo plástico — G',
    diametro: '140 mm (14 cm)', volume: 'até 4 litros',
    foto: '/cofico/coador-cabo-plastico-g.webp',
    uso: 'O de maior volume: prepara até 4 litros de uma vez — empresa, evento e cozinha que serve muita gente.',
  },
];

// FILTROS PERMANENTES — tela e aro em polipropileno, laváveis, sem descarte de papel.
// Dados da ficha do produto; o material de origem vinha como "Colonial".
const PERMANENTES = [
  {
    ref: 'FPC80', medida: '102', porte: 'médio', volume: 'até 2 litros',
    foto: '/cofico/filtro-permanente-102.webp',
    uso: 'A medida do dia a dia: substitui o filtro de papel do coador 102, lava e usa de novo.',
  },
  {
    ref: 'FPC81', medida: '103', porte: 'grande', volume: 'até 4 litros',
    foto: '/cofico/filtro-permanente-103.webp',
    uso: 'Para volume maior — família grande, empresa e evento —, sem descartar filtro a cada café.',
  },
];

// Clientes que já produzem marca própria com a COFICO (prova real, não ilustração).
const CLIENTES_MP = [
  { marca: 'Café Capital', praca: 'Rio de Janeiro', produto: 'Coador de pano médio, 100% algodão, com a marca do cliente', foto: '/cofico/mp-cliente-capital.webp' },
];

const LINHAS = [
  { icon: Filter, t: 'Filtro de papel', d: 'Para coador de plástico e cafeteira elétrica, nos tamanhos que a sua operação usa. Caixa fechada para revenda ou consumo.' },
  { icon: Layers, t: 'Coador de pano', d: 'O coador de sempre, para quem faz café na hora. Tamanhos para casa, padaria e cozinha industrial.' },
  { icon: Recycle, t: 'Coador permanente', d: 'Coador reutilizável, sem descarte diário — opção para quem quer reduzir custo por xícara.' },
];

export default function CoficoFiltrosPage() {
  useEffect(() => { document.title = 'Filtros e coadores de café — COFICO Brasil'; window.scrollTo(0, 0); }, []);

  return (
    <div id="topo" className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-cofico-ink selection:text-white">
      <CoficoHeader />

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-16">
        <nav className="text-sm text-neutral-500" aria-label="Você está em">
          <a href="#topo" className="hover:text-cofico-ink">Início</a>
          <span className="mx-2" aria-hidden="true">›</span>
          <span className="text-neutral-800 font-medium">Filtros e coadores</span>
        </nav>

        <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">Filtros e coadores</h1>
        <p className="mt-3 text-neutral-600 max-w-2xl">
          Filtro de papel para a indústria do café. Fornecemos a linha COFICO pronta para revenda e,
          principalmente, <strong>produzimos com a marca do cliente</strong> — torrefações, indústrias e
          distribuidores que querem o filtro no próprio portfólio.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={WA_MARCA_PROPRIA} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 hover:bg-cofico-dark transition-colors">
            Filtro com a minha marca <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <a href={WA_FILTROS} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center border border-neutral-300 text-neutral-900 text-sm font-semibold px-6 py-3.5 hover:border-cofico-ink hover:text-cofico-ink transition-colors">
            Pedir a tabela
          </a>
        </div>
      </section>

      <section className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">O que temos</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {LINHAS.map(({ icon: Icon, t, d }) => (
              <article key={t} className="border border-neutral-200 p-8">
                <Icon className="w-7 h-7 text-cofico-ink" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-neutral-600">{d}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Tamanhos, marcas e quantidade por caixa: peça a tabela — cotamos em cima do seu volume.
          </p>
        </div>
      </section>

      {/* MARCA PRÓPRIA — é o negócio principal da linha de filtros: produzir com a marca do cliente.
          A linha COFICO existe como padrão de qualidade e prova do que entregamos. */}
      <section id="marca-propria" className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs font-bold uppercase tracking-wide text-cofico-ink">Marca própria</p>
          <h2 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">Filtro de papel com a sua marca</h2>
          <p className="mt-4 text-neutral-600 max-w-3xl">
            A COFICO produz filtro de papel para torrefações, indústrias de café e distribuidores que querem
            a linha no próprio portfólio. O produto sai com a sua marca na embalagem, no mesmo padrão da
            linha COFICO: 100% fibras vegetais, filtragem rápida e sem interferência no sabor do café.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Tag, t: 'A marca é sua', d: 'Arte, identidade e código do produto são do cliente. A COFICO não aparece na embalagem.' },
              { icon: Boxes, t: 'Medidas 100, 102 e 103', d: 'As três medidas de maior giro no varejo brasileiro, com 30 filtros por cartucho.' },
              { icon: Factory, t: 'Para quem já vende café', d: 'Fecha o portfólio da torrefação e do distribuidor: o cliente compra o café e o filtro da mesma marca.' },
            ].map(({ icon: Icon, t, d }) => (
              <article key={t} className="border border-neutral-200 p-8">
                <Icon className="w-7 h-7 text-cofico-ink" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-neutral-600">{d}</p>
              </article>
            ))}
          </div>
          <a href={WA_MARCA_PROPRIA} target="_blank" rel="noopener noreferrer"
            className="mt-10 inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 hover:bg-cofico-dark transition-colors">
            Quero produzir com a minha marca <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <p className="mt-4 text-sm text-neutral-500">
            Quantidade mínima, prazo de produção e condições de arte são definidos no orçamento, pelo volume do seu pedido.
          </p>
        </div>
      </section>

      {/* Linha própria da COFICO — marca, código e conteúdo saem da arte da caixa */}
      <section id="linha-papel" className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Linha Papel COFICO</h2>
          <p className="mt-3 text-neutral-600 max-w-2xl">
            A nossa linha de referência: filtro em <strong>100% fibras vegetais</strong>, filtragem rápida e sem
            gosto de papel, com <strong>30 filtros por cartucho</strong>. É este o padrão que entregamos também
            na produção com a marca do cliente.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PAPEL.map(({ n, codigo, uso }) => (
              <article key={n} className="bg-white border border-neutral-200 p-6 flex flex-col">
                <div className="aspect-square flex items-center justify-center">
                  <img src={`/cofico/filtro-papel-${n}.webp`} alt={`Filtro de papel COFICO ${n}`}
                    className="w-4/5 h-4/5 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Filtro de Papel COFICO {n}</h3>
                <p className="mt-1 text-sm text-neutral-600 flex-1">{uso}</p>
                <dl className="mt-4 text-sm border-t border-neutral-200 pt-3 space-y-1">
                  <div className="flex justify-between gap-3"><dt className="text-neutral-500">Conteúdo</dt><dd className="font-medium">30 filtros</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-neutral-500">Código</dt><dd className="font-mono text-[13px] font-medium">{codigo}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Quantidade por caixa, pedido mínimo e prazo: <a href={WA_FILTROS} target="_blank" rel="noopener noreferrer" className="font-semibold text-cofico-ink hover:underline">peça a tabela</a>.
          </p>
        </div>
      </section>

      {/* Filtros permanentes — alternativa ao papel: lava e usa de novo */}
      <section id="permanentes" className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Filtros permanentes</h2>
          <p className="mt-3 text-neutral-600 max-w-3xl">
            Tela e aro em <strong>polipropileno</strong>: lava, usa de novo e acaba o descarte diário de filtro de papel.
            Cada unidade <strong>rende até 500 cafés</strong>. Embalagem com 1 unidade.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PERMANENTES.map(p => (
              <article key={p.ref} className="border border-neutral-200 p-6 flex flex-col">
                <div className="aspect-square flex items-center justify-center">
                  <img src={p.foto} alt={`Filtro permanente COFICO ${p.medida}`} className="w-4/5 h-4/5 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Filtro permanente {p.medida}</h3>
                <p className="mt-1 text-sm text-neutral-600 flex-1">{p.uso}</p>
                <dl className="mt-4 text-sm border-t border-neutral-200 pt-3 space-y-1">
                  <div className="flex justify-between gap-3"><dt className="text-neutral-500">Porte</dt><dd className="font-medium">{p.porte}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-neutral-500">Prepara</dt><dd className="font-medium">{p.volume}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-neutral-500">Referência</dt><dd className="font-mono text-[13px] font-medium">{p.ref}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Disponível com a marca <strong>COFICO</strong> ou com a <strong>sua marca</strong> (marca própria).
            Quantidade por caixa e prazo: <a href={WA_FILTROS} target="_blank" rel="noopener noreferrer" className="font-semibold text-cofico-ink hover:underline">peça a tabela</a>.
          </p>
        </div>
      </section>

      {/* Coadores de algodão — linha própria, mesma lógica da linha de papel */}
      <section id="coadores" className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Coadores de algodão</h2>
          <p className="mt-3 text-neutral-600 max-w-3xl">
            Linha cabo plástico, com filtro em <strong>malha 100% algodão</strong>: extração suave, reutilizável e lavável.
            Cabo resistente e estrutura reforçada, para uso constante. Embalagem com 1 unidade.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {COADORES.map(c => (
              <article key={c.ref} className="border border-neutral-200 p-6 flex flex-col">
                <div className="aspect-square flex items-center justify-center">
                  <img src={c.foto} alt={c.nome} className="w-4/5 h-4/5 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Coador cabo plástico {c.tamanho}</h3>
                <p className="mt-1 text-sm text-neutral-600 flex-1">{c.uso}</p>
                <dl className="mt-4 text-sm border-t border-neutral-200 pt-3 space-y-1">
                  <div className="flex justify-between gap-3"><dt className="text-neutral-500">Diâmetro</dt><dd className="font-medium">{c.diametro}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-neutral-500">Prepara</dt><dd className="font-medium">{c.volume}</dd></div>
                  {c.ref && <div className="flex justify-between gap-3"><dt className="text-neutral-500">Referência</dt><dd className="font-mono text-[13px] font-medium">{c.ref}</dd></div>}
                </dl>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Disponível com a marca <strong>COFICO</strong> ou com a <strong>sua marca</strong> (marca própria).
            Tamanhos M e G, quantidade por caixa e prazo: <a href={WA_FILTROS} target="_blank" rel="noopener noreferrer" className="font-semibold text-cofico-ink hover:underline">peça a tabela</a>.
          </p>
        </div>
      </section>

      {/* MARCA PRÓPRIA de coador e permanente. Texto escrito do zero a partir das informações
          do Vlademir — nada copiado do material de origem. Só o que ele confirmou entra aqui. */}
      <section id="mp-coadores" className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs font-bold uppercase tracking-wide text-cofico-ink">Marca própria</p>
          <h2 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">Coador e filtro permanente com a sua marca</h2>
          <p className="mt-4 text-neutral-600 max-w-3xl">
            Produzimos e embalamos com a marca do cliente. A logo vai estampada no próprio produto, e a armação
            plástica pode ser injetada na cor da marca — não é só uma etiqueta trocada.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <article className="bg-white border border-neutral-200 p-6">
              <div className="aspect-[4/3] flex items-center justify-center">
                <img src="/cofico/mp-filtro-permanente.webp" alt="Filtro permanente com a marca do cliente" className="w-4/5 h-4/5 object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Filtro permanente</h3>
              <p className="mt-2 text-sm text-neutral-600">
                A logo do cliente vai na alça. A embalagem sai em flow pack, para volumes maiores, ou em saco
                cristal PP com cartela interna ou lapela de papel grampeada.
              </p>
            </article>

            <article className="bg-white border border-neutral-200 p-6">
              <div className="aspect-[4/3] flex items-center justify-center">
                <img src="/cofico/mp-coador-pano.webp" alt="Coador de pano com a marca do cliente" className="w-4/5 h-4/5 object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Coador de pano</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Filtro 100% algodão, em malha ou flanela, nos três tamanhos. Cabo branco é o padrão; outras cores,
                sob consulta.
              </p>
            </article>

            <article className="bg-white border border-neutral-200 p-6">
              <div className="aspect-[4/3] flex items-center justify-center">
                <img src="/cofico/mp-coador-cabo-cor.webp" alt="Coador com o cabo na cor da marca" className="w-4/5 h-4/5 object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Cabo na cor da marca</h3>
              <p className="mt-2 text-sm text-neutral-600">
                O cabo pode acompanhar a identidade visual do cliente, e a logo é impressa em uma cor.
              </p>
            </article>
          </div>

          {/* Clientes que já produzem com a COFICO. Entra marca com autorização do dono —
              é a marca dele numa página comercial nossa. */}
          <div className="mt-12 border-t border-neutral-200 pt-10">
            <h3 className="text-lg font-semibold">Marcas que já produzem com a gente</h3>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {CLIENTES_MP.map(c => (
                <article key={c.marca} className="bg-white border border-neutral-200 p-5">
                  <div className="aspect-square flex items-center justify-center">
                    <img src={c.foto} alt={`${c.marca} — ${c.produto}`} className="w-4/5 h-4/5 object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  <h4 className="mt-4 text-base font-semibold">{c.marca}</h4>
                  <p className="text-sm text-neutral-500">{c.praca}</p>
                  <p className="mt-2 text-sm text-neutral-600">{c.produto}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold">Para quem é</h3>
              <p className="mt-3 text-sm text-neutral-600">
                Torrefações, encarteladores, atacadistas, redes de supermercado e ações promocionais — quem já tem
                marca e quer o coador no próprio portfólio.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Medidas e modelos</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
                <li>Coador pequeno — 9,5 cm de diâmetro, até 1 litro</li>
                <li>Coador médio — 11 cm de diâmetro, até 2 litros</li>
                <li>Coador grande — 14 cm de diâmetro, até 4 litros</li>
                <li>Filtro 100% algodão, em malha ou flanela</li>
                <li>Filtro permanente para café — 102 e 103</li>
              </ul>
            </div>
          </div>

          <a href={WA_MARCA_PROPRIA} target="_blank" rel="noopener noreferrer"
            className="mt-10 inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 hover:bg-cofico-dark transition-colors">
            Quero coador com a minha marca <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <p className="mt-4 text-sm text-neutral-500">
            Quantidade mínima, prazo de produção e condições de arte entram no orçamento, pelo volume do pedido.
          </p>
        </div>
      </section>

      <section className="border-t border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Compre junto com o café</h2>
          <p className="mt-3 text-neutral-600 max-w-2xl">
            Café, filtro e embalagem no mesmo pedido, com pedido mínimo e frete cotado por destino.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#loja" className="inline-flex items-center gap-1.5 bg-cofico-ink text-white text-sm font-semibold px-6 py-3.5 hover:bg-cofico-dark transition-colors">
              <ShoppingBag className="w-4 h-4" aria-hidden="true" /> Ver o catálogo
            </a>
            <a href="#embalagens" className="inline-flex items-center border border-neutral-300 text-neutral-900 text-sm font-semibold px-6 py-3.5 hover:border-cofico-ink hover:text-cofico-ink transition-colors">
              Ver embalagens
            </a>
          </div>
        </div>
      </section>

      <CoficoFooter />
    </div>
  );
}
