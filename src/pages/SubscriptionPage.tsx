import { useState, useEffect, FormEvent } from 'react';
import { X, Check, Coffee, Package, Calendar, Truck, Shield, Award, Home, LogOut, User, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { SubscriptionCheckout } from '../components/SubscriptionCheckout';
import { AuthModal } from '../components/AuthModal';

const coffeeFieldImage = '/coffee-field.webp';
const logoImage = '/SAPORINO LOGO transparente big-PNG.png';
const cafeLogoImage = '/cafe-logo-saporino copy.png';

type AccountType = 'PF' | 'PJ' | null;

interface SelectedCoffee {
  id: string;
  name: string;
  description: string;
  roast: string;
  forWho: string;
}

const COFFEE_OPTIONS: SelectedCoffee[] = [
  {
    id: 'tradicional',
    name: 'Café Saporino Tradicional',
    description: 'Torra média. Notas de chocolate e caramelo. Equilibrado e perfeito para o dia a dia.',
    roast: 'Torra média',
    forWho: 'Famílias e quem busca constância',
  },
  {
    id: 'extra-forte',
    name: 'Café Saporino Extra Forte',
    description: 'Torra escura. Intenso, encorpado e com final marcante.',
    roast: 'Torra escura',
    forWho: 'Quem gosta de café forte',
  },
  {
    id: 'classico',
    name: 'Café Saporino Clássico',
    description: 'Torra média-clara. Aroma floral, acidez leve e doçura natural.',
    roast: 'Torra média-clara',
    forWho: 'Quem aprecia cafés suaves e aromáticos',
  },
  {
    id: 'gourmet',
    name: 'Café Saporino Gourmet',
    description: 'Torra média. Notas de frutas secas, chocolate ao leite e toque de noz.',
    roast: 'Torra média',
    forWho: 'Quem gosta de equilíbrio e sofisticação',
  },
  {
    id: 'premium',
    name: 'Café Saporino Premium',
    description: 'Torra média-escura. Cacau, especiarias e leve cítrico.',
    roast: 'Torra média-escura',
    forWho: 'Quem busca cafés mais intensos',
  },
  {
    id: 'tradicao',
    name: 'Café Saporino Tradição',
    description: 'Torra média. Sabor caseiro, redondo e com leve defumado.',
    roast: 'Torra média',
    forWho: 'Quem gosta do clássico sabor de família',
  },
];

export const SubscriptionPage = () => {
  const { user, profile, signOut } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [selectedCoffees, setSelectedCoffees] = useState<Set<string>>(new Set());
  const [grindType, setGrindType] = useState<'beans' | 'coado' | 'espresso'>('beans');
  const [shippingDate, setShippingDate] = useState<1 | 15>(1);
  const [showFAQ, setShowFAQ] = useState<string | null>(null);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    window.scrollTo(0, 0); // Scroll to top when page loads
  }, []);

  const goHome = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleCoffeeSelection = (coffeeId: string) => {
    const newSelection = new Set(selectedCoffees);
    if (newSelection.has(coffeeId)) {
      newSelection.delete(coffeeId);
    } else {
      if (newSelection.size < 4) {
        newSelection.add(coffeeId);
      }
    }
    setSelectedCoffees(newSelection);
  };

  const handleSubscribe = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    if (selectedCoffees.size < 2) {
      toast.error('Selecione pelo menos 2 tipos de café');
      return;
    }

    try {
      const { error } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        account_type: accountType,
        selected_coffees: Array.from(selectedCoffees),
        grind_type: grindType,
        shipping_date: shippingDate,
        status: 'active',
      });

      if (error) throw error;

      toast.success('Assinatura criada com sucesso!');
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast.error('Erro ao criar assinatura. Tente novamente.');
    }
  };

  const handleCheckoutSuccess = () => {
    setShowCheckout(false);
    window.location.reload();
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/50 to-transparent">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="relative flex justify-between items-center py-6">
            <button
              onClick={goHome}
              className="cursor-pointer group z-50"
            >
              <img
                src={logoImage}
                alt="Saporino"
                className="h-[70px] w-auto transition-transform duration-300 group-hover:scale-105 drop-shadow-2xl"
              />
            </button>

            <nav className="flex items-center space-x-4">
              <button
                onClick={goHome}
                className="flex items-center space-x-2 text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#a4240e] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
              >
                <Home className="w-5 h-5" />
                <span>INÍCIO</span>
              </button>

              {user && profile ? (
                <div className="relative">
                  <button
                    onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                    className="flex items-center space-x-2 text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#a4240e] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
                  >
                    <User className="w-5 h-5" />
                    <span>MINHA CONTA</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {accountDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                      <div className="p-4 border-b border-gray-100 bg-stone-50">
                        <p className="font-semibold text-gray-900 truncate">{profile.full_name}</p>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        {profile.is_admin && (
                          <span className="inline-block mt-2 px-2 py-1 bg-[#a4240e] text-white text-xs font-semibold rounded">
                            Administrador
                          </span>
                        )}
                      </div>
                      {profile.is_admin && (
                        <button
                          onClick={() => {
                            window.history.pushState({}, '', '/admin');
                            window.dispatchEvent(new PopStateEvent('popstate'));
                            setAccountDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 text-gray-700 hover:bg-stone-50 transition-colors flex items-center space-x-3 border-b border-gray-100"
                        >
                          <svg className="w-5 h-5 text-[#a4240e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                          </svg>
                          <span className="font-semibold">Painel Admin</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          window.history.pushState({}, '', '/meu-perfil');
                          window.dispatchEvent(new PopStateEvent('popstate'));
                          setAccountDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-stone-50 transition-colors flex items-center space-x-3 border-b border-gray-100"
                      >
                        <User className="w-5 h-5 text-[#a4240e]" />
                        <span>Meu Perfil</span>
                      </button>
                      <button
                        onClick={() => {
                          signOut();
                          goHome();
                        }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-stone-50 transition-colors flex items-center space-x-3"
                      >
                        <LogOut className="w-5 h-5 text-gray-400" />
                        <span>Sair</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => openAuthModal('login')}
                  className="text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#a4240e] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
                >
                  ENTRAR
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${coffeeFieldImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        <div className="relative z-10 text-center text-white px-6 max-w-5xl mx-auto">
          <div className="relative inline-block mb-12">
            <img
              src={logoImage}
              alt="Saporino"
              className="h-44 md:h-72 w-auto mx-auto drop-shadow-2xl relative"
            />
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight -mt-16">
            Assinatura Café Saporino
          </h1>

          <p className="text-lg md:text-xl mb-4 max-w-4xl mx-auto font-light leading-relaxed">
            Café de família, 100% arábica de Minas, entregue todo mês na sua casa.
          </p>

          <p className="text-base md:text-lg mb-6 max-w-3xl mx-auto leading-relaxed italic">
            "Café que você toma de manhã, à tarde e depois do almoço, sem enjoar."
          </p>

          <p className="text-base md:text-lg mb-12 max-w-4xl mx-auto font-light leading-relaxed">
            Assine e receba cafés selecionados, sempre frescos, com origem em Minas Gerais e torra feita a cada 15 dias. É simples, direto e feito para quem gosta de tomar café todos os dias, sem complicação.
          </p>

          <button
            onClick={() => scrollToSection('cadastro')}
            className="bg-[#a4240e] hover:bg-[#8a1f0c] text-white px-10 py-4 rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-2xl"
          >
            Assinar Café Saporino
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      <section id="cadastro" className="py-20 bg-gradient-to-b from-white to-stone-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Escolha como deseja se cadastrar
            </h2>
            <div className="w-24 h-1.5 bg-[#a4240e] mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div
              onClick={() => {
                setAccountType('PF');
                setShowCheckout(true);
              }}
              className="bg-white rounded-3xl p-10 shadow-xl cursor-pointer transition-all duration-300 transform hover:scale-105 hover:ring-4 hover:ring-[#a4240e]/50"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-3xl font-bold text-gray-900">Pessoa Física (PF)</h3>
                <div className="text-[#a4240e]">→</div>
              </div>
              <p className="text-lg text-gray-600 mb-6">Ideal para consumo em casa.</p>
              <ul className="space-y-3">
                {[
                  'Cadastro vai para a base PF',
                  'Visualiza apenas preços PF',
                  'Acesso à assinatura mensal familiar',
                  'Experiência simples e direta',
                ].map((item) => (
                  <li key={item} className="flex items-start space-x-3">
                    <Check className="w-5 h-5 text-[#a4240e] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 text-center">
                <span className="inline-block bg-[#a4240e] text-white px-6 py-3 rounded-full font-semibold">
                  Clique para cadastrar
                </span>
              </div>
            </div>

            <div
              onClick={() => {
                setAccountType('PJ');
                setShowCheckout(true);
              }}
              className="bg-white rounded-3xl p-10 shadow-xl cursor-pointer transition-all duration-300 transform hover:scale-105 hover:ring-4 hover:ring-[#a4240e]/50"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-3xl font-bold text-gray-900">Pessoa Jurídica (PJ)</h3>
                <div className="text-[#a4240e]">→</div>
              </div>
              <p className="text-lg text-gray-600 mb-6">
                Ideal para mercados, empresas e estabelecimentos.
              </p>
              <ul className="space-y-3">
                {[
                  'Cadastro vai para a base PJ',
                  'Visualiza somente preços corporativos',
                  'Acesso a condições especiais e pedido mínimo',
                ].map((item) => (
                  <li key={item} className="flex items-start space-x-3">
                    <Check className="w-5 h-5 text-[#a4240e] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 text-center">
                <span className="inline-block bg-[#a4240e] text-white px-6 py-3 rounded-full font-semibold">
                  Clique para cadastrar
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {accountType === 'PF' && (
        <>
          <section id="como-funciona" className="py-20 bg-white">
            <div className="max-w-5xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                  Como funciona a assinatura
                </h2>
                <div className="w-24 h-1.5 bg-[#a4240e] mx-auto rounded-full"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  {
                    icon: Coffee,
                    title: 'Escolha de 2 a 4 tipos de café',
                    description: 'Mínimo 1 kg por mês',
                  },
                  {
                    icon: Package,
                    title: 'Escolha a moagem',
                    description: 'Em grãos, coado ou espresso',
                  },
                  {
                    icon: Calendar,
                    title: 'Selecione a data de envio',
                    description: 'Dia 1 ou 15',
                  },
                  {
                    icon: Truck,
                    title: 'Café sempre fresco',
                    description: 'Torra quinzenal alinhada à sua data',
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start space-x-4 bg-stone-50 rounded-2xl p-8">
                    <div className="w-16 h-16 bg-[#a4240e] rounded-2xl flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                      <p className="text-gray-600">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="estrutura-comercial" className="py-20 bg-stone-50">
            <div className="max-w-5xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                  Monte sua assinatura
                </h2>
                <div className="w-24 h-1.5 bg-[#a4240e] mx-auto rounded-full"></div>
              </div>

              <div className="bg-white rounded-3xl p-10 shadow-xl">
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    'Assinatura mensal',
                    'Um envio por mês',
                    'Mínimo de 1 kg/mês (2 pacotes de 500g)',
                    'Seleção de 2 a 4 cafés todo mês',
                    'Desconto progressivo para 3 ou 4 tipos',
                    'Frete grátis acima de um valor mínimo',
                    'Sem fidelidade',
                  ].map((item) => (
                    <li key={item} className="flex items-start space-x-3">
                      <Check className="w-6 h-6 text-[#a4240e] flex-shrink-0 mt-0.5" />
                      <span className="text-lg text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section id="cafes-saporino" className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                  Escolha seus cafés Saporino
                </h2>
                <div className="w-24 h-1.5 bg-[#a4240e] mx-auto mb-6 rounded-full"></div>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Todos os cafés são 100% arábica de Minas Gerais, com origem principal em Patrocínio – MG.
                  Torra e moagem feitas em lotes quinzenais.
                </p>
                <p className="text-lg font-semibold text-[#a4240e] mt-4">
                  Selecione de 2 a 4 cafés ({selectedCoffees.size} selecionados)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {COFFEE_OPTIONS.map((coffee) => (
                  <div
                    key={coffee.id}
                    onClick={() => handleCoffeeSelection(coffee.id)}
                    className={`bg-white rounded-3xl p-8 shadow-lg cursor-pointer transition-all duration-300 transform hover:scale-105 ${selectedCoffees.has(coffee.id) ? 'ring-4 ring-[#a4240e]' : ''
                      }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center">
                        <Coffee className="w-8 h-8 text-[#a4240e]" />
                      </div>
                      {selectedCoffees.has(coffee.id) && (
                        <Check className="w-8 h-8 text-[#a4240e]" />
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      {coffee.name} – 500g
                    </h3>
                    <p className="text-gray-600 mb-3">{coffee.description}</p>
                    <p className="text-sm text-[#a4240e] font-semibold">
                      Para quem é: {coffee.forWho}
                    </p>
                  </div>
                ))}
              </div>

              {selectedCoffees.size >= 2 && (
                <div className="mt-12 max-w-3xl mx-auto">
                  <div className="bg-stone-50 rounded-3xl p-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">
                      Configure sua assinatura
                    </h3>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-lg font-semibold text-gray-900 mb-3">
                          Tipo de moagem:
                        </label>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { value: 'beans', label: 'Em Grãos' },
                            { value: 'coado', label: 'Coado' },
                            { value: 'espresso', label: 'Espresso' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              onClick={() => setGrindType(option.value as any)}
                              className={`py-3 px-4 rounded-xl font-semibold transition-all ${grindType === option.value
                                ? 'bg-[#a4240e] text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-lg font-semibold text-gray-900 mb-3">
                          Data de envio:
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { value: 1, label: 'Dia 1' },
                            { value: 15, label: 'Dia 15' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              onClick={() => setShippingDate(option.value as any)}
                              className={`py-3 px-4 rounded-xl font-semibold transition-all ${shippingDate === option.value
                                ? 'bg-[#a4240e] text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSubscribe}
                      className="w-full mt-8 bg-[#a4240e] hover:bg-[#8a1f0c] text-white py-4 rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
                    >
                      Confirmar Assinatura
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section id="beneficios" className="py-20 bg-stone-50">
            <div className="max-w-5xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                  Benefícios da assinatura
                </h2>
                <div className="w-24 h-1.5 bg-[#a4240e] mx-auto rounded-full"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { icon: Award, text: 'Café 100% arábica de Minas Gerais' },
                  { icon: Coffee, text: 'Origem principal em Patrocínio – MG' },
                  { icon: Package, text: 'Torra e moagem quinzenais' },
                  { icon: Shield, text: 'Café sempre fresco' },
                  { icon: Truck, text: 'Um envio por mês' },
                  { icon: Check, text: 'Desconto progressivo' },
                  { icon: Check, text: 'Frete grátis acima do valor mínimo' },
                  { icon: Check, text: 'Sem fidelidade' },
                ].map((benefit, idx) => (
                  <div key={idx} className="flex items-center space-x-4 bg-white rounded-2xl p-6 shadow-md">
                    <benefit.icon className="w-8 h-8 text-[#a4240e] flex-shrink-0" />
                    <span className="text-lg text-gray-700">{benefit.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="faq" className="py-20 bg-white">
            <div className="max-w-4xl mx-auto px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                  Perguntas Frequentes
                </h2>
                <div className="w-24 h-1.5 bg-[#a4240e] mx-auto rounded-full"></div>
              </div>

              <div className="space-y-4">
                {[
                  {
                    q: 'Quando a cobrança é feita?',
                    a: 'A cobrança é mensal, com renovação automática.',
                  },
                  {
                    q: 'Posso escolher entre dia 1 ou 15?',
                    a: 'Sim, você escolhe a data preferida para receber o café.',
                  },
                  {
                    q: 'O café é fresco?',
                    a: 'Sim. Todos os lotes são torrados a cada 15 dias.',
                  },
                  {
                    q: 'Posso trocar os cafés do mês?',
                    a: 'Sim, basta alterar antes da renovação da assinatura.',
                  },
                  {
                    q: 'Posso mudar a moagem?',
                    a: 'Sim, pode alterar quando quiser.',
                  },
                  {
                    q: 'Como funciona o frete grátis?',
                    a: 'É aplicado acima de um valor mínimo configurado pela empresa.',
                  },
                  {
                    q: 'Posso cancelar?',
                    a: 'Sim. A assinatura não tem fidelidade.',
                  },
                ].map((faq, idx) => (
                  <div
                    key={idx}
                    className="bg-stone-50 rounded-2xl overflow-hidden shadow-md"
                  >
                    <button
                      onClick={() => setShowFAQ(showFAQ === faq.q ? null : faq.q)}
                      className="w-full text-left p-6 flex items-center justify-between hover:bg-stone-100 transition-colors"
                    >
                      <h3 className="text-lg font-bold text-gray-900">{faq.q}</h3>
                      <span className="text-2xl text-[#a4240e]">
                        {showFAQ === faq.q ? '−' : '+'}
                      </span>
                    </button>
                    {showFAQ === faq.q && (
                      <div className="px-6 pb-6">
                        <p className="text-gray-700">{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {accountType === 'PJ' && (
        <section id="pj" className="py-20 bg-white">
          <div className="max-w-5xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Condições para Pessoa Jurídica (PJ)
              </h2>
              <div className="w-24 h-1.5 bg-[#a4240e] mx-auto mb-6 rounded-full"></div>
              <p className="text-xl text-gray-600">
                Fornecimento especial para empresas, mercados, empórios, cafeterias e escritórios.
              </p>
            </div>

            <div className="space-y-8">
              <div className="bg-stone-50 rounded-3xl p-10">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  Pedido mínimo por distância
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { distance: 'Até 50 km', minimum: 'Mínimo 100 kg' },
                    { distance: 'Até 100 km', minimum: 'Mínimo 200 kg' },
                    { distance: 'Até 150 km', minimum: 'Mínimo 300 kg' },
                    { distance: 'Até 200 km', minimum: 'Mínimo 400 kg' },
                  ].map((tier) => (
                    <div
                      key={tier.distance}
                      className="flex items-center justify-between bg-white rounded-xl p-6"
                    >
                      <span className="text-lg font-semibold text-gray-900">{tier.distance}</span>
                      <span className="text-lg text-[#a4240e] font-bold">{tier.minimum}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-10 shadow-xl">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Entregas</h3>
                <p className="text-lg text-gray-700 mb-8">
                  Até 1 vez por semana, de segunda a sexta, conforme rota logística.
                </p>

                <h3 className="text-2xl font-bold text-gray-900 mb-6">Pagamento</h3>
                <p className="text-lg text-gray-700 mb-8">À vista, com desconto para PIX.</p>

                <div className="bg-[#a4240e] text-white rounded-2xl p-8">
                  <h3 className="text-2xl font-bold mb-4">Mensagem para empresas</h3>
                  <p className="text-lg leading-relaxed">
                    Café arábica de Minas, padrão estável, entrega programada e volume constante.
                    Ideal para quem precisa de qualidade e regularidade no fornecimento.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section id="cta-final" className="py-20 bg-gradient-to-b from-stone-50 to-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-8">
            Por que assinar Café Saporino?
          </h2>
          <div className="w-24 h-1.5 bg-[#a4240e] mx-auto mb-12 rounded-full"></div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
            {['Simples', 'Honesto', 'Café de família', 'Origem de Minas', 'Café fresco todo mês', 'Qualidade sem complicação'].map(
              (reason) => (
                <div
                  key={reason}
                  className="bg-white rounded-2xl p-6 shadow-lg transform transition-all duration-300 hover:scale-105"
                >
                  <Check className="w-8 h-8 text-[#a4240e] mx-auto mb-3" />
                  <p className="text-lg font-semibold text-gray-900">{reason}</p>
                </div>
              )
            )}
          </div>

          <button
            onClick={() => scrollToSection('cadastro')}
            className="bg-[#a4240e] hover:bg-[#8a1f0c] text-white px-12 py-5 rounded-full text-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-2xl"
          >
            Quero Assinar Agora
          </button>
        </div>
      </section>

      {showCheckout && accountType && (
        <SubscriptionCheckout
          accountType={accountType}
          selectedCoffees={[]}
          grindType="beans"
          shippingDate={1}
          onClose={() => {
            setShowCheckout(false);
            setAccountType(null);
          }}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
};
