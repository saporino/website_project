// Coffee LiVRE — painel da plataforma.
//
// Casca do admin. As sub-abas nascem aqui e vão sendo preenchidas por
// unidade: hoje só "Acesso" tem conteúdo, e as outras dizem honestamente
// que ainda não existem em vez de mostrar tela vazia.
//
// Dizer "em construção" é melhor que fingir: numa demonstração para
// investidor, uma aba vazia parece defeito; uma aba que explica o que vem
// parece plano.
import { useState } from 'react';
import { KeyRound, LayoutDashboard, Image, LayoutGrid, Store, Package, Tags } from 'lucide-react';
import LivreAcesso from './LivreAcesso';

type Sub = 'painel' | 'site' | 'vitrine' | 'lojas' | 'produtos' | 'categorias' | 'acesso';

const ABAS: { id: Sub; label: string; icon: typeof KeyRound; pronto: boolean }[] = [
  { id: 'painel', label: 'Painel', icon: LayoutDashboard, pronto: false },
  { id: 'site', label: 'Site', icon: Image, pronto: false },
  { id: 'vitrine', label: 'Vitrine', icon: LayoutGrid, pronto: false },
  { id: 'lojas', label: 'Lojas', icon: Store, pronto: false },
  { id: 'produtos', label: 'Produtos', icon: Package, pronto: false },
  { id: 'categorias', label: 'Categorias', icon: Tags, pronto: false },
  { id: 'acesso', label: 'Acesso', icon: KeyRound, pronto: true },
];

const APRESENTACAO: Record<Exclude<Sub, 'acesso'>, string> = {
  painel: 'Vendedores, produtos, visitas e GMV. Os números de demonstração virão marcados como simulação, para nunca serem confundidos com venda real.',
  site: 'Hero, banners e blocos da home: ligar, desligar, reordenar e trocar imagem de desktop e de celular sem publicar código.',
  vitrine: 'Quais cafés entram em Ofertas do dia e em Mais vendidos, quais lojas aparecem em destaque e em que ordem.',
  lojas: 'Cadastro de produtores, torrefações e marcas: razão social, CNPJ, tipo, cidade, logo, capa e história.',
  produtos: 'Catálogo por vendedor, com os atributos do café que o Coffee Passport usa.',
  categorias: 'Categorias e atributos dinâmicos do universo do café.',
};

export default function CoffeeLivreAdmin() {
  const [sub, setSub] = useState<Sub>('acesso');
  const atual = ABAS.find(a => a.id === sub)!;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Coffee LiVRE</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Marketplace vertical de café. A demonstração privada fica em{' '}
          <a href="/coffeelivre" className="font-semibold text-[#8B2214] hover:underline">/coffeelivre</a>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ABAS.map(a => (
          <button
            key={a.id}
            onClick={() => setSub(a.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              sub === a.id
                ? 'border-[#8B2214] bg-[#8B2214] text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-[#8B2214]'
            }`}
          >
            <a.icon className="h-3.5 w-3.5" /> {a.label}
            {!a.pronto && <span className="ml-0.5 text-[10px] opacity-60">em breve</span>}
          </button>
        ))}
      </div>

      {sub === 'acesso' ? (
        <LivreAcesso />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="flex items-center gap-2 font-bold text-gray-900">
            <atual.icon className="h-4 w-4 text-[#8B2214]" /> {atual.label}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
            {APRESENTACAO[sub as Exclude<Sub, 'acesso'>]}
          </p>
          <p className="mt-3 text-xs text-gray-400">
            Ainda não construído. A home continua lendo dados de demonstração do próprio código
            até esta área existir.
          </p>
        </div>
      )}
    </div>
  );
}
