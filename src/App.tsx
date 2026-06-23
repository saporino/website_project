import { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { ShoppingCart, Plus, Minus, X, Trash2, ShoppingBag, Menu, Instagram, Send, User, ChevronDown, ChevronLeft, ChevronRight, LogOut, CreditCard, Facebook, Linkedin, Lock, Truck, Briefcase, MapPin, Flame, Coffee, Mail } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider, useCart } from './contexts/CartContext';
import { AuthModal } from './components/AuthModal';
import { bannerButtonStyle } from './lib/bannerButton';
import { AdminDashboard } from './pages/AdminDashboard';
import { ResetPassword } from './pages/ResetPassword';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { UserProfile } from './pages/UserProfile';
import { supabase } from './lib/supabase';
import { Product, CartItem } from './types';
import { createPreference, MERCADO_PAGO_PUBLIC_KEY } from './lib/mercadopago';
import { getCarrierQuotes, lookupCEP, formatCEP, calculateCartWeight, CarrierQuote } from './lib/shipping';
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react';
import { PrivacyPolicy, ShippingPolicy, RefundPolicy, TermsOfService, SubscriptionPolicy, CookiePolicy, CareersPage, PressPage, PrivateLabelPage, GreenCoffeePage, BusinessPage } from './pages/PolicyPages';
import CookieConsent from './components/CookieConsent';
import { HistoryPage } from './pages/HistoryPage';
import BrandPage from './pages/BrandPage';
import { PaymentSuccess, PaymentFailure, PaymentPending } from './pages/PaymentPages';
import { TrackingPage } from './pages/TrackingPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { RepCoDashboard } from './pages/RepCoDashboard';
import RepCoIntelligence from './pages/RepCoIntelligence';
import RepCoCoverageMap from './pages/RepCoCoverageMap';
import ProductDetail from './components/ProductDetail';
import PromoPopup from './components/PromoPopup';
import { trackVisit } from './lib/trackVisit';
import StoreLocator from './components/StoreLocator';
import NotFound from './components/NotFound';

const logoImage = '/saporino-logo.png';
const heroImage = '/hero-colheita.webp';

// Slides do carrossel de banners (entre o hero e "Nossa Linha de Cafes").
// SUBSTITUIR pelos 4 banners gerados — ideal 1920x600px, kebab-case em /public:
// promo-1.png ... promo-4.png. href opcional define para onde o clique leva.
// (As imagens abaixo sao TEMPORARIAS so para visualizar o comportamento.)
const PROMO_SLIDES: { src: string; alt: string; href?: string }[] = [
  { src: '/hero-colheita.webp',      alt: 'Siga nas redes sociais' },
  { src: '/lavoura-cerrado.webp',    alt: 'Seja um Representante Comercial' },
  { src: '/coffee-field.webp',      alt: 'Vendas para varejo e atacado' },
  { src: '/torrefacao-saporino.jpg', alt: 'Conheca a Linha de Cafes' },
];

if (MERCADO_PAGO_PUBLIC_KEY) {
  initMercadoPago(MERCADO_PAGO_PUBLIC_KEY, { locale: 'pt-BR' });
}

function App() {
  // Keep-alive: pings Supabase every 4 days to prevent the free plan from pausing
  useEffect(() => {
    const keepAlive = async () => {
      try {
        await supabase.from('products').select('id').limit(1);
      } catch (_) {
        // silently ignore errors
      }
    };
    // Run once on load, then every 4 days
    keepAlive();
    trackVisit(); // registra a visita por IP (1x por sessao)
    const interval = setInterval(keepAlive, 4 * 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        <AppRouter />
      </CartProvider>
    </AuthProvider>
  );
}

function AppRouter() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (currentPath === '/admin') {
    return <AdminDashboard />;
  }

  if (currentPath === '/assinatura' || currentPath === '/subscription') {
    return <SubscriptionPage />;
  }

  if (currentPath === '/meu-perfil' || currentPath === '/profile') {
    return <UserProfile />;
  }

  if (currentPath === '/repco/inteligencia/cobertura') {
    return <RepCoCoverageMap />;
  }

  if (currentPath === '/repco/inteligencia') {
    return <RepCoIntelligence />;
  }

  if (currentPath === '/repco') {
    return <RepCoDashboard />;
  }

  if (currentPath === '/reset-password' || window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token')) {
    return <ResetPassword />;
  }

  if (currentPath === '/politica-privacidade') return <PrivacyPolicy />;
  if (currentPath === '/politica-frete') return <ShippingPolicy />;
  if (currentPath === '/politica-reembolso') return <RefundPolicy />;
  if (currentPath === '/termos-servico') return <TermsOfService />;
  if (currentPath === '/politica-assinatura') return <SubscriptionPolicy />;
  if (currentPath === '/politica-cookies') return <CookiePolicy />;
  if (currentPath === '/trabalhe-conosco') return <CareersPage />;
  if (currentPath === '/imprensa') return <PressPage />;
  if (currentPath.startsWith('/marcas/')) return <BrandPage slug={currentPath.split('/')[2] || ''} />;
  if (currentPath === '/marca-propria') return <PrivateLabelPage />;
  if (currentPath === '/cafe-cru') return <GreenCoffeePage />;
  if (currentPath === '/para-seu-negocio') return <BusinessPage />;
  if (currentPath === '/nossa-historia' || currentPath === '/sobre') return <HistoryPage />;

  // Payment callback routes
  if (currentPath === '/payment/success') return <PaymentSuccess />;
  if (currentPath === '/payment/failure') return <PaymentFailure />;
  if (currentPath === '/payment/pending') return <PaymentPending />;

  // Tracking & order detail routes
  if (currentPath === '/rastrear') {
    return <TrackingPage />;
  }

  if (currentPath.startsWith('/meu-pedido/')) {
    const orderId = currentPath.replace('/meu-pedido/', '');
    return <OrderDetailPage orderId={orderId} />;
  }

  // Home (default) — rotas conhecidas acima; o resto e 404.
  if (currentPath === '/' || currentPath === '' || currentPath === '/index.html') {
    return <AppContent />;
  }
  return <NotFound />;
}

function AppContent() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [authLoginContext, setAuthLoginContext] = useState<'client' | 'admin'>('client');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
    window.scrollTo(0, 0); // Scroll to top on page load/refresh
    const handleVis = () => { if (document.visibilityState === 'visible') loadProducts(); };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      setProducts((data || []).sort((a, b) => {
        // Treat 0 as "infinity" (put at the end)
        const orderA = a.display_order === 0 ? Number.MAX_SAFE_INTEGER : a.display_order;
        const orderB = b.display_order === 0 ? Number.MAX_SAFE_INTEGER : b.display_order;
        return orderA - orderB;
      }));
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  const openAuth = (mode: 'login' | 'register', context: 'client' | 'admin' = 'client') => {
    setAuthModalMode(mode);
    setAuthLoginContext(context);
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        scrollToSection={scrollToSection}
        onCartOpen={() => setIsCartOpen(true)}
        onAuthOpen={openAuth}
      />
      {!selectedProduct && <Hero scrollToSection={scrollToSection} />}
      {!selectedProduct && <PromoCarousel onAuthOpen={openAuth} />}
      <Products
        products={products}
        loading={loading}
        addedProducts={addedProducts}
        setAddedProducts={setAddedProducts}
        selectedProduct={selectedProduct}
        setSelectedProduct={setSelectedProduct}
        onAuthOpen={openAuth}
      />
      {!selectedProduct && <StoreLocator />}
      {!selectedProduct && <About />}
      {!selectedProduct && <Contact />}
      <Footer scrollToSection={scrollToSection} />
      <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} onAuthOpen={openAuth} />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
        loginContext={authLoginContext}
      />
      <PromoPopup onAction={(link) => openAuth(link === 'cadastro' ? 'register' : 'login')} />
      <CookieConsent />
      <Toaster position="top-center" richColors />
    </div>
  );
}

const Header = ({ isMobileMenuOpen, setIsMobileMenuOpen, scrollToSection, onCartOpen, onAuthOpen }: any) => {
  const { getCartCount } = useCart();
  const { user, profile, signOut } = useAuth();
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [isRepresentative, setIsRepresentative] = useState(false);

  useEffect(() => {
    if (user) {
      supabase
        .from('representatives')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()
        .then(({ data }) => setIsRepresentative(!!data));
    } else {
      setIsRepresentative(false);
    }
  }, [user]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/50 to-transparent">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="relative flex justify-center items-center py-6">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="absolute left-0 cursor-pointer group z-50"
            >
              <img
                src={logoImage}
                alt="Saporino"
                className="h-[70px] w-auto transition-transform duration-300 group-hover:scale-105 drop-shadow-2xl"
              />
            </button>

            <nav className="hidden lg:flex items-center space-x-1">
              <button
                onClick={() => scrollToSection('products')}
                className="text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#8B2214] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
              >
                LOJA
              </button>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/assinatura');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#8B2214] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
              >
                ASSINATURA
              </button>
              <button
                onClick={() => { window.history.pushState({}, '', '/nossa-historia'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                className="text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#8B2214] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
              >
                SOBRE
              </button>
              <button
                onClick={() => scrollToSection('journey')}
                className="text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#8B2214] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
              >
                JORNADA
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#8B2214] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
              >
                CONTATO
              </button>

              <div className="w-px h-6 bg-white/20 mx-2"></div>

              {user && profile ? (
                <div className="relative">
                  <button
                    onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                    className="flex items-center space-x-2 text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#8B2214] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
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
                          <span className="inline-block mt-2 px-2 py-1 bg-[#8B2214] text-white text-xs font-semibold rounded">
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
                          <svg className="w-5 h-5 text-[#8B2214]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <User className="w-5 h-5 text-[#8B2214]" />
                        <span>Meu Perfil</span>
                      </button>
                      {(profile.is_admin || isRepresentative) && (
                        <button
                          onClick={() => {
                            window.history.pushState({}, '', '/repco');
                            window.dispatchEvent(new PopStateEvent('popstate'));
                            setAccountDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 text-gray-700 hover:bg-stone-50 transition-colors flex items-center space-x-3 border-b border-gray-100"
                        >
                          <svg className="w-5 h-5 text-[#8B2214]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="font-medium">Portal RepCo</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          window.history.pushState({}, '', '/rastrear');
                          window.dispatchEvent(new PopStateEvent('popstate'));
                          setAccountDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-stone-50 transition-colors flex items-center space-x-3"
                      >
                        <Truck className="w-5 h-5 text-[#8B2214]" />
                        <span>Rastrear Pedido</span>
                      </button>
                      <button
                        onClick={() => {
                          signOut();
                          setAccountDropdownOpen(false);
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
                <div
                  className="relative"
                  onMouseEnter={() => setAccountDropdownOpen(true)}
                  onMouseLeave={() => setAccountDropdownOpen(false)}
                >
                  <button
                    className="flex items-center space-x-2 text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#8B2214] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
                  >
                    <span>ENTRAR</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {accountDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                      <button
                        onClick={() => {
                          onAuthOpen('login');
                          setAccountDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-stone-50 transition-colors flex items-center space-x-3 border-b border-gray-100"
                      >
                        <User className="w-5 h-5 text-[#8B2214]" />
                        <span>Cliente (PF)</span>
                      </button>
                      <button
                        onClick={() => {
                          onAuthOpen('login');
                          setAccountDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-stone-50 transition-colors flex items-center space-x-3 border-b border-gray-100"
                      >
                        <svg className="w-5 h-5 text-[#8B2214]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span>Empresa (PJ)</span>
                      </button>
                      <button
                        onClick={() => {
                          onAuthOpen('login', 'rep');
                          setAccountDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-stone-50 transition-colors flex items-center space-x-3 border-b border-gray-100"
                      >
                        <Briefcase className="w-5 h-5 text-[#8B2214]" />
                        <span>Representante (RepCo)</span>
                      </button>
                      <button
                        onClick={() => {
                          onAuthOpen('login', 'admin');
                          setAccountDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-stone-50 transition-colors flex items-center space-x-3"
                      >
                        <Lock className="w-5 h-5 text-[#8B2214]" />
                        <span>Administrador</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <a
                href="https://www.instagram.com/cafesaporino"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-full transition-all duration-300 text-white hover:bg-white/10 hover:text-[#8B2214]"
              >
                <Instagram className="w-5 h-5" />
              </a>

              <button
                onClick={onCartOpen}
                className="relative p-3 rounded-full transition-all duration-300 text-white hover:bg-white/10 hover:text-[#8B2214] cursor-pointer"
              >
                <ShoppingCart className="w-6 h-6" />
                {getCartCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#8B2214] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                    {getCartCount()}
                  </span>
                )}
              </button>
            </nav>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-lg transition-all duration-300 text-white hover:bg-white/10 ml-auto"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </header>

      {/* Menu mobile (drawer) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-white pt-24 px-6 pb-8 overflow-y-auto">
          <nav className="flex flex-col gap-1 max-w-md mx-auto">
            {[
              { label: 'Loja', act: () => scrollToSection('products') },
              { label: 'Assinatura', act: () => { window.history.pushState({}, '', '/assinatura'); window.dispatchEvent(new PopStateEvent('popstate')); setIsMobileMenuOpen(false); } },
              { label: 'Sobre', act: () => { window.history.pushState({}, '', '/nossa-historia'); window.dispatchEvent(new PopStateEvent('popstate')); setIsMobileMenuOpen(false); } },
              { label: 'Jornada', act: () => scrollToSection('journey') },
              { label: 'Contato', act: () => scrollToSection('contact') },
            ].map((it) => (
              <button key={it.label} onClick={it.act}
                className="w-full text-left text-lg font-semibold text-gray-900 py-4 px-3 rounded-xl hover:bg-stone-50 border-b border-gray-100">
                {it.label}
              </button>
            ))}

            <div className="h-3" />

            {user && profile ? (
              <>
                {profile.is_admin && (
                  <button onClick={() => { window.history.pushState({}, '', '/admin'); window.dispatchEvent(new PopStateEvent('popstate')); setIsMobileMenuOpen(false); }}
                    className="w-full text-left text-base font-medium text-[#8B2214] py-3.5 px-3 rounded-xl hover:bg-stone-50">Painel Admin</button>
                )}
                {(profile.is_admin || isRepresentative) && (
                  <button onClick={() => { window.history.pushState({}, '', '/repco'); window.dispatchEvent(new PopStateEvent('popstate')); setIsMobileMenuOpen(false); }}
                    className="w-full text-left text-base font-medium text-[#8B2214] py-3.5 px-3 rounded-xl hover:bg-stone-50">Portal RepCo</button>
                )}
                <button onClick={() => { window.history.pushState({}, '', '/meu-perfil'); window.dispatchEvent(new PopStateEvent('popstate')); setIsMobileMenuOpen(false); }}
                  className="w-full text-left text-base font-medium text-gray-700 py-3.5 px-3 rounded-xl hover:bg-stone-50">Meu Perfil</button>
                <button onClick={() => { signOut(); setIsMobileMenuOpen(false); }}
                  className="w-full text-left text-base font-medium text-gray-500 py-3.5 px-3 rounded-xl hover:bg-stone-50">Sair</button>
              </>
            ) : (
              <button onClick={() => { onAuthOpen('login'); setIsMobileMenuOpen(false); }}
                className="w-full bg-[#8B2214] text-white text-lg font-semibold py-4 rounded-full hover:bg-[#6d1a10]">Entrar</button>
            )}

            <button onClick={() => { onCartOpen(); setIsMobileMenuOpen(false); }}
              className="w-full mt-2 flex items-center justify-center gap-2 border border-gray-200 text-gray-900 text-base font-semibold py-3.5 rounded-full hover:bg-stone-50">
              <ShoppingCart className="w-5 h-5" /> Carrinho{getCartCount() > 0 ? ` (${getCartCount()})` : ''}
            </button>

            <a href="https://www.instagram.com/cafesaporino" target="_blank" rel="noopener noreferrer"
              className="w-full mt-2 flex items-center justify-center gap-2 text-gray-600 text-base font-medium py-3.5 rounded-full hover:bg-stone-50">
              <Instagram className="w-5 h-5" /> Instagram
            </a>
          </nav>
        </div>
      )}
    </>
  );
};

const Hero = ({ scrollToSection }: any) => (
  <section id="hero" className="relative h-screen flex items-center justify-center overflow-hidden">
    <div
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: `url(${heroImage})` }}
    >
      {/* foto fica VIVIDA — fade suave so no terco inferior (atras do texto + transicao) */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
    </div>

    <div className="relative z-10 text-center text-white px-6 max-w-5xl mx-auto">
      <div className="relative inline-block mb-12">
        {/* halo radial sutil atras do badge — destaca o logo sem escurecer a foto */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.28) 40%, rgba(0,0,0,0) 70%)' }}
        />
        <img
          src={logoImage}
          alt="Café Saporino"
          className="h-52 md:h-[340px] w-auto mx-auto drop-shadow-2xl animate-fade-in relative"
        />
      </div>

      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight animate-fade-in-up whitespace-nowrap [text-shadow:_0_2px_12px_rgb(0_0_0_/_70%)]">
        O Verdadeiro Sabor de Minas
      </h1>

      <p className="text-lg md:text-xl mb-12 max-w-4xl mx-auto font-light leading-relaxed animate-fade-in-up animation-delay-200 [text-shadow:_0_1px_8px_rgb(0_0_0_/_70%)]">
        Torra artesanal em pequenos lotes, direto do Cerrado Mineiro.
      </p>

      <button
        onClick={() => scrollToSection('products')}
        className="bg-[#8B2214] hover:bg-[#8a1f0c] text-white px-10 py-4 rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-2xl animate-fade-in-up animation-delay-400"
      >
        Conheça Nossos Cafés
      </button>
    </div>

    <div className="absolute bottom-0 left-0 right-0 h-36 md:h-44 bg-gradient-to-t from-white via-white/70 to-transparent" />
  </section>
);

// Carrossel de banners (estilo Melitta): auto-rotacao em loop, setas, bolinhas,
// pausa no hover e swipe no celular. Cada slide e uma imagem full-width.
// Le os banners do banco (gerenciados em Admin > Configuracoes da Loja).
// Sem banners cadastrados → usa PROMO_SLIDES como fallback (imagens temporarias).
interface PromoSlide {
  src: string; alt: string; href?: string;
  buttonText?: string; buttonLink?: string; buttonX?: number; buttonY?: number; buttonScale?: number;
  overlayUrl?: string; overlayX?: number; overlayY?: number; overlayScale?: number;
}
const PromoCarousel = ({ onAuthOpen }: { onAuthOpen?: (mode: 'login' | 'register') => void }) => {
  const [slides, setSlides] = useState<PromoSlide[]>(PROMO_SLIDES);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('promo_banners')
        .select('image_url, title, link_url, button_text, button_link, button_x, button_y, button_scale, overlay_image_url, overlay_x, overlay_y, overlay_scale')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (data && data.length) {
        setSlides(data.map((b: any) => ({
          src: b.image_url, alt: b.title || 'Banner', href: b.link_url || undefined,
          buttonText: b.button_text || undefined, buttonLink: b.button_link || undefined,
          buttonX: b.button_x ?? 50, buttonY: b.button_y ?? 85, buttonScale: b.button_scale ?? 1,
          overlayUrl: b.overlay_image_url || undefined,
          overlayX: b.overlay_x ?? 50, overlayY: b.overlay_y ?? 50, overlayScale: b.overlay_scale ?? 1,
        })));
        setIndex(0);
      }
    })();
  }, []);

  // Acao de um destino (botao do banner ou link do slide inteiro).
  const goTo = (dest?: string) => {
    if (!dest) return;
    if (dest === 'cadastro') { onAuthOpen?.('register'); return; }
    if (dest === 'login') { onAuthOpen?.('login'); return; }
    if (/^https?:\/\//.test(dest)) { window.open(dest, '_blank', 'noopener'); return; }
    if (dest.startsWith('#')) {
      document.querySelector(dest)?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    window.history.pushState({}, '', dest);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const touchX = useRef<number | null>(null);
  const n = slides.length;
  const go = (i: number) => setIndex(((i % n) + n) % n);

  // Auto-rotacao robusta: timer reinicia a cada troca de slide (manual ou automatica),
  // entao cada banner fica exatamente 5s e nunca trava. (Antes um ref de "pausa" no
  // hover/toque podia ficar preso em true — ex.: touchcancel ao rolar no celular — e o
  // carrossel congelava.)
  useEffect(() => {
    if (n <= 1) return;
    const id = setTimeout(() => setIndex(p => (p + 1) % n), 5000);
    return () => clearTimeout(id);
  }, [index, n]);

  if (!n) return null;
  return (
    <section
      className="relative w-full overflow-hidden bg-[#f8f7f5] select-none"
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
      aria-roledescription="carrossel"
    >
      <div
        className="flex transition-transform duration-700 ease-out aspect-[3/1]"
        /* aspect 3:1 = mesma proporcao dos banners (2172x724 ~ 1920x640) → sem corte */
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div key={i} className="relative w-full h-full flex-shrink-0" style={{ containerType: 'inline-size' }}>
            <img
              src={s.src} alt={s.alt} draggable={false}
              onClick={() => goTo(s.href)}
              className={`w-full h-full object-cover ${s.href ? 'cursor-pointer' : ''}`}
            />
            {s.overlayUrl && (
              <img
                src={s.overlayUrl} alt="" draggable={false}
                style={{ left: `${s.overlayX ?? 50}%`, top: `${s.overlayY ?? 50}%`, transform: 'translate(-50%, -50%)', width: `${20 * (s.overlayScale ?? 1)}cqw` }}
                className="absolute pointer-events-none drop-shadow-lg rounded-md"
              />
            )}
            {s.buttonText && (
              <button
                onClick={(e) => { e.stopPropagation(); goTo(s.buttonLink); }}
                style={bannerButtonStyle(s.buttonX ?? 50, s.buttonY ?? 85, s.buttonScale ?? 1)}
                className="absolute bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold rounded-full shadow-lg active:scale-95 transition whitespace-nowrap"
              >
                {s.buttonText}
              </button>
            )}
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button onClick={() => go(index - 1)} aria-label="Anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 md:w-11 md:h-11 rounded-full bg-white/80 hover:bg-white text-[#8B2214] shadow-lg flex items-center justify-center transition">
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <button onClick={() => go(index + 1)} aria-label="Próximo"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 md:w-11 md:h-11 rounded-full bg-white/80 hover:bg-white text-[#8B2214] shadow-lg flex items-center justify-center transition">
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            {slides.map((_, i) => (
              <button key={i} onClick={() => go(i)} aria-label={`Ir para o slide ${i + 1}`}
                className={`h-2.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2.5 bg-white/60 hover:bg-white/90'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

const Products = ({ products, loading, addedProducts, setAddedProducts, selectedProduct, setSelectedProduct, onAuthOpen }: any) => {
  const { addToCart } = useCart();

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    setAddedProducts((prev: Set<string>) => new Set(prev).add(product.id));
    setTimeout(() => {
      setAddedProducts((prev: Set<string>) => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }, 2000);
  };


  if (selectedProduct) {
    return <ProductDetail product={selectedProduct} onBack={() => setSelectedProduct(null)} onAddToCart={handleAddToCart} isAdded={addedProducts.has(selectedProduct.id)} onOpenAuth={() => onAuthOpen('login')} />;
  }

  if (loading) {
    return (
      <section id="products" className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#8B2214] mx-auto"></div>
        </div>
      </section>
    );
  }


  return (
    <section id="products" className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Nossa Linha de Cafés</h2>
          <div className="w-16 h-1 bg-[#8B2214] mx-auto mb-4 rounded-full"></div>
          <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
            Do tradicional ao gourmet — um café para cada momento.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product: Product) => (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)} className="bg-white overflow-hidden transition-all duration-300 group flex flex-col cursor-pointer"
            >
              <div className="relative aspect-square bg-white overflow-hidden flex items-center justify-center">
                {/* halo suave atras da embalagem (separa o pacote do fundo branco) */}
                <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 46%, rgba(139,34,20,0.09) 0%, rgba(0,0,0,0.045) 38%, transparent 68%)' }} />
                <img
                  src={(product.is_active && product.image_url && product.image_url.trim() !== '' ? product.image_url : '/saporino-logo.png')}
                  alt={product.name}
                  onError={(e) => {
                    e.currentTarget.src = '/saporino-logo.png';
                  }}
                  className="relative z-10 w-4/5 h-4/5 object-contain transition-transform duration-500 group-hover:scale-105"
                />
                {product.featured && (
                  <div className="absolute top-2 right-2 bg-[#8B2214] text-white px-2 py-0.5 rounded-full text-[10px] font-semibold shadow">
                    Destaque
                  </div>
                )}
              </div>

              <div className="p-3 flex-1 flex flex-col">
                <div className="mb-1">
                  <span className="inline-block bg-[#8B2214] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    {product.category}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1 leading-snug">{product.name}</h3>
                {product.description && (
                  <p className="text-gray-400 mb-1 text-[10px] line-clamp-2 hidden sm:block">{product.description}</p>
                )}
                {(product as any).pj_only && (
                  <p className="text-[11px] font-bold text-[#8B2214] mb-1">Venda somente para PJ</p>
                )}

                <div className="mt-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">{product.weight_grams}g</span>
                    {product.stock > 0 && product.is_active && (
                      <span className="text-sm font-bold text-[#8B2214]">R$ {product.price.toFixed(2)}</span>
                    )}
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                    disabled={product.stock <= 0 || !product.is_active}
                    className={`w-full py-2 px-3 rounded-full text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-1 ${product.stock <= 0 || !product.is_active
                      ? 'bg-white border border-[#8B2214] text-[#8B2214] cursor-not-allowed'
                      : addedProducts.has(product.id)
                        ? 'bg-green-600 text-white'
                        : 'bg-[#8B2214] text-white hover:bg-[#6d1a10]'
                      }`}
                  >
                    {product.stock <= 0 || !product.is_active ? (
                      <span>Esgotado</span>
                    ) : addedProducts.has(product.id) ? (
                      <>
                        <span>Adicionado à Sacola</span>
                        <Plus className="w-5 h-5" />
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-5 h-5" />
                        <span>Adicionar à Sacola</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Cart = ({ isOpen, onClose, onAuthOpen }: any) => {
  const { cart, removeFromCart, updateQuantity, clearCart, getCartTotal } = useCart();
  const { user } = useAuth();
  const [isCheckout, setIsCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess] = useState(false);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });

  // Shipping address state
  const [isGift, setIsGift] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Carriers
  const [carriers, setCarriers] = useState<CarrierQuote[]>([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [carriersLoading, setCarriersLoading] = useState(false);

  const fetchCarriers = useCallback(async () => {
    if (cart.length === 0) return;
    setCarriersLoading(true);
    const weight = calculateCartWeight(cart);
    const quotes = await getCarrierQuotes(cep, weight);
    setCarriers(quotes);
    if (quotes.length > 0 && !selectedCarrierId) setSelectedCarrierId(quotes[0].id);
    setCarriersLoading(false);
  }, [cart, cep]);

  const handleCepChange = async (value: string) => {
    const formatted = formatCEP(value);
    setCep(formatted);
    if (formatted.replace(/\D/g, '').length === 8) {
      setCepLoading(true);
      const address = await lookupCEP(formatted);
      if (address) {
        setStreet(address.street);
        setNeighborhood(address.neighborhood);
        setCity(address.city);
        setState(address.state);
      }
      setCepLoading(false);
      await fetchCarriers();
    }
  };

  const getFullAddress = () =>
    `${street}, ${number}${complement ? `, ${complement}` : ''} — ${neighborhood}, ${city}/${state} — CEP ${cep}`;

  const handleCheckout = () => {
    if (!user) {
      onAuthOpen('login');
      onClose();
      return;
    }
    setIsCheckout(true);
  };

  const handleSubmitOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      const selectedCarrier = carriers.find(c => c.id === selectedCarrierId);
      const shippingAddress = getFullAddress();
      const shippingCost = selectedCarrier?.price || 0;
      const shippingRecipient = isGift ? recipientName : formData.name;

      // Create order in database
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          customer_name: formData.name,
          customer_email: formData.email,
          customer_phone: formData.phone,
          shipping_address: shippingAddress,
          shipping_recipient: shippingRecipient,
          is_gift: isGift,
          shipping_carrier_id: selectedCarrierId,
          shipping_carrier_name: selectedCarrier?.name || null,
          shipping_cost: shippingCost,
          total_amount: getCartTotal() + shippingCost,
          status: 'pending',
          order_type: 'single',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      if (orderData) {
        // Create order items with product names
        const orderItems = cart.map((item: CartItem) => ({
          order_id: orderData.id,
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          subtotal: item.price * item.quantity,
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) throw itemsError;

        // Create Mercado Pago preference
        const preferenceResponse = await createPreference({
          items: cart.map((item: CartItem) => ({
            title: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            currency_id: 'BRL',
          })),
          back_urls: {
            success: `${window.location.origin}/payment/success`,
            failure: `${window.location.origin}/payment/failure`,
            pending: `${window.location.origin}/payment/pending`,
          },
          auto_return: 'approved',
          payer: {
            name: formData.name,
            email: formData.email,
            phone: {
              number: formData.phone,
            },
          },
          external_reference: orderData.id,
        });

        if (preferenceResponse.id) {
          // Update order with preference ID
          await supabase
            .from('orders')
            .update({ mercadopago_preference_id: preferenceResponse.id })
            .eq('id', orderData.id);

          setPreferenceId(preferenceResponse.id);
        }
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      toast.error('Erro ao processar pedido. Por favor, tente novamente.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-8 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
            <ShoppingBag className="w-7 h-7 text-[#8B2214]" />
            <span>{isCheckout ? 'Finalizar Pedido' : 'Sacola'}</span>
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {orderSuccess ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <ShoppingBag className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-3">Pedido Realizado!</h3>
              <p className="text-gray-600 text-lg">Obrigado pela sua compra. Entraremos em contato em breve!</p>
            </div>
          </div>
        ) : isCheckout ? (
          <form onSubmit={handleSubmitOrder} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">E-mail *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Telefone/WhatsApp *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+55 (11) 91771-9798"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent transition-all"
                />
              </div>

              {/* Para mim / Presente */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Este pedido é para:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setIsGift(false)}
                    className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border-2 font-semibold transition-all ${
                      !isGift ? 'border-[#8B2214] bg-[#8B2214]/5 text-[#8B2214]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    <span>👤</span><span>Para mim</span>
                  </button>
                  <button type="button" onClick={() => setIsGift(true)}
                    className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border-2 font-semibold transition-all ${
                      isGift ? 'border-[#8B2214] bg-[#8B2214]/5 text-[#8B2214]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    <span>🎁</span><span>Presente</span>
                  </button>
                </div>
              </div>

              {/* Recipient name (gift only) */}
              {isGift && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do Presenteado *</label>
                  <input type="text" required={isGift} value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Nome de quem vai receber"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent transition-all" />
                </div>
              )}

              {/* Address */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">Endereço de Entrega *</label>

                {/* CEP */}
                <div className="relative">
                  <input type="text" value={cep} onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="CEP: 00000-000" maxLength={9}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent transition-all" />
                  {cepLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#8B2214]"></div>
                    </div>
                  )}
                </div>

                {/* Street + Number */}
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={street} onChange={(e) => setStreet(e.target.value)}
                    placeholder="Rua / Av. *" required
                    className="col-span-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
                  <input type="text" value={number} onChange={(e) => setNumber(e.target.value)}
                    placeholder="Nº *" required
                    className="col-span-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
                </div>

                <input type="text" value={complement} onChange={(e) => setComplement(e.target.value)}
                  placeholder="Complemento (apto, bloco...)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />

                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Bairro *" required
                    className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                    placeholder="Cidade *" required
                    className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
                </div>

                <input type="text" value={state} onChange={(e) => setState(e.target.value)}
                  placeholder="Estado (UF) *" maxLength={2} required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
              </div>

              {/* Carrier Selection */}
              {(carriers.length > 0 || carriersLoading) && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Escolha a Transportadora *</label>
                  {carriersLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8B2214]"></div>
                      <span className="ml-2 text-sm text-gray-500">Consultando fretes...</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {carriers.map((carrier) => (
                        <button key={carrier.id} type="button"
                          onClick={() => setSelectedCarrierId(carrier.id)}
                          className={`w-full flex items-center space-x-3 p-4 rounded-xl border-2 transition-all text-left ${
                            selectedCarrierId === carrier.id
                              ? 'border-[#8B2214] bg-[#8B2214]/5'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}>
                          {/* Logo */}
                          <div className="w-12 h-12 rounded-lg bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden p-1">
                            {carrier.logo_url ? (
                              <img src={carrier.logo_url} alt={carrier.name} className="w-full h-full object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              <Truck className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{carrier.name}</p>
                            <p className="text-xs text-gray-500">{carrier.delivery_time_days} dias úteis</p>
                          </div>
                          <div className="text-right">
                            {carrier.price > 0 ? (
                              <p className="font-bold text-gray-900">R$ {carrier.price.toFixed(2)}</p>
                            ) : (
                              <p className="text-xs text-blue-600 font-semibold">Verificar<br/>no checkout</p>
                            )}
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                            selectedCarrierId === carrier.id ? 'border-[#8B2214] bg-[#8B2214]' : 'border-gray-300'
                          }`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Manual load button if CEP was skipped */}
              {carriers.length === 0 && !carriersLoading && cep.replace(/\D/g, '').length === 8 && (
                <button type="button" onClick={fetchCarriers}
                  className="w-full py-2 text-[#8B2214] border border-[#8B2214] rounded-xl text-sm font-semibold hover:bg-[#8B2214]/5 transition-colors">
                  🔄 Buscar transportadoras disponíveis
                </button>
              )}

              <div className="bg-stone-50 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-900 text-lg">Resumo do Pedido</h3>
                {cart.map((item: CartItem) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.name} x {item.quantity}</span>
                    <span className="font-semibold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                {selectedCarrierId && carriers.find(c => c.id === selectedCarrierId)?.price ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Frete ({carriers.find(c => c.id === selectedCarrierId)?.name})</span>
                    <span className="font-semibold">R$ {(carriers.find(c => c.id === selectedCarrierId)?.price || 0).toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between font-bold text-xl">
                  <span>Total</span>
                  <span className="text-[#8B2214]">R$ {(getCartTotal() + (selectedCarrierId ? (carriers.find(c => c.id === selectedCarrierId)?.price || 0) : 0)).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 p-8 space-y-3">
              {preferenceId ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <p className="text-green-800 font-semibold mb-2">Pedido Criado com Sucesso!</p>
                    <p className="text-green-600 text-sm">Clique no botão abaixo para pagar com Mercado Pago</p>
                  </div>
                  <Wallet initialization={{ preferenceId }} />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCheckout(false);
                      setPreferenceId(null);
                      setFormData({ name: '', email: '', phone: '', address: '' });
                    }}
                    className="w-full border-2 border-gray-300 text-gray-700 py-4 rounded-full font-semibold hover:bg-gray-50 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#8B2214] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg disabled:bg-gray-300 flex items-center justify-center space-x-2"
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>{isSubmitting ? 'Processando...' : 'Continuar para Pagamento'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCheckout(false)}
                    className="w-full border-2 border-gray-300 text-gray-700 py-4 rounded-full font-semibold hover:bg-gray-50 transition-all"
                  >
                    Voltar à Sacola
                  </button>
                </>
              )}
            </div>
          </form>
        ) : cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <ShoppingBag className="w-24 h-24 text-gray-300 mx-auto mb-6" />
              <p className="text-gray-500 text-xl">Sua sacola está vazia</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {cart.map((item: CartItem) => (
                <div key={item.id} className="flex space-x-4 bg-stone-50 rounded-2xl p-5">
                  <div className="w-20 h-20 flex-shrink-0">
                    <img
                      src={item.image_url && item.image_url.trim() !== '' ? item.image_url : '/saporino-logo.png'}
                      alt={item.name}
                      onError={(e) => { e.currentTarget.src = '/saporino-logo.png'; }}
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">{item.name}</h3>
                    {item.is_subscription && (
                      <p className="text-[10px] text-[#8B2214] font-semibold">Assinatura {item.subscription_months ?? 6} meses</p>
                    )}
                    <p className="text-sm text-gray-500 mb-2">{item.weight}</p>
                    <p className="text-[#8B2214] font-bold text-lg mb-3">R$ {item.price.toFixed(2)}</p>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1.5 rounded-full bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-bold w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1.5 rounded-full bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="ml-auto p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 p-8">
              <div className="flex justify-between items-center mb-6">
                <span className="text-xl font-bold text-gray-900">Total</span>
                <span className="text-base font-bold text-[#8B2214]">R$ {getCartTotal().toFixed(2)}</span>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full bg-[#8B2214] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg mb-3"
              >
                {user ? 'Finalizar Pedido' : 'Fazer Login para Comprar'}
              </button>
              <button
                onClick={clearCart}
                className="w-full border-2 border-gray-300 text-gray-700 py-4 rounded-full font-semibold hover:bg-gray-50 transition-all"
              >
                Limpar Sacola
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const About = () => {
  const goHistoria = () => {
    window.history.pushState({}, '', '/nossa-historia');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  return (
    <section id="about" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="relative h-[460px] rounded-3xl overflow-hidden shadow-2xl bg-cover bg-center"
              style={{ backgroundImage: `url('/historia-colheita.webp')` }}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Nossa História</h2>
            <div className="w-24 h-1.5 bg-[#8B2214] mb-8 rounded-full"></div>

            <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
              <p>
                O <strong className="text-gray-900">Café Saporino</strong> nasceu em 2025, em Patrocínio, no coração do <strong className="text-gray-900">Cerrado Mineiro</strong> — uma das regiões mais respeitadas na produção de café do Brasil.
              </p>
              <p>
                Mas nossa essência vem de muito antes: de uma tradição cafeeira mineira que remonta a <strong className="text-gray-900">1890</strong>, quando o "ouro verde" partia de Minas rumo a São Paulo. É esse legado que honramos em cada grão.
              </p>
            </div>

            <button onClick={goHistoria}
              className="mt-8 inline-flex items-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] text-white px-7 py-3.5 rounded-full font-semibold transition-colors">
              Conheça nossa história
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

const Contact = () => {
  return (
    <section id="journey" className="py-24 bg-gradient-to-b from-stone-50 to-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">DO GRÃO À XÍCARA</h2>
          <div className="w-16 h-1 bg-[#8B2214] mx-auto mb-4 rounded-full"></div>
          <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
            Conheça a jornada do nosso café, desde a origem até sua xícara
          </p>
        </div>

        {/* 3 etapas — narrativa de origem, sem expor fornecedores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { Icon: MapPin, title: 'Origem no Cerrado Mineiro', text: 'Grãos cultivados entre 900 e 1.200 metros de altitude, em solo rico e clima ideal — uma das regiões mais premiadas do Brasil, reconhecida pela doçura natural e pelo corpo encorpado.' },
            { Icon: Flame, title: 'Torra artesanal', text: 'Torra controlada em pequenos lotes, respeitando o tempo de cada grão para desenvolver aroma e sabor com consistência, xícara após xícara.' },
            { Icon: Coffee, title: 'Notas de sabor', text: 'Café encorpado, com acidez equilibrada e leve toque frutado, apresentando notas de chocolate e caramelo — o perfil marcante de cada blend Café Saporino.' },
          ].map(({ Icon, title, text }, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-8 text-center hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-2xl bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center mx-auto mb-5">
                <Icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
              <p className="text-gray-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* Banda de imagem — lavoura do Cerrado, sem atribuição de fornecedor */}
        <div className="mt-8 relative h-64 md:h-80 rounded-3xl overflow-hidden">
          <img src="/lavoura-cerrado.webp" alt="Lavoura de café no Cerrado Mineiro" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent flex items-end">
            <div className="p-8 md:p-10">
              <p className="text-2xl md:text-3xl font-bold text-white">Da roça à sua xícara</p>
              <p className="text-white/85 mt-1 text-base md:text-lg">Tradição mineira preservada em cada grão.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const BIZ_INFO: Record<string, { title: string; intro: string; bullets: string[]; email: string }> = {
  foodservice: {
    title: 'Food Service',
    intro: 'Atendemos cozinhas industriais, escritórios, padarias, empórios, cafeterias, restaurantes e lanchonetes com café de qualidade a preço de atacado.',
    bullets: [
      'Condições para CNPJ: boleto, prazo e entrega programada.',
      'Quanto maior o volume, melhor o preço por quilo.',
      'Atendimento por um representante da sua região.',
    ],
    email: 'foodservice@cafesaporino.com.br',
  },
  marca_propria: {
    title: 'Marca Própria',
    intro: 'Produzimos café com a SUA marca: você define o blend, a torra, a embalagem e o rótulo — cuidamos da torra, empacotamento e logística.',
    bullets: [
      'Ideal para redes, cafeterias e mercados que querem marca própria.',
      'Amostras antes de fechar; embalagem e rótulo personalizados.',
      'Pedido mínimo conforme o projeto — fale com a gente.',
    ],
    email: 'marcapropria@cafesaporino.com.br',
  },
  cafe_cru: {
    title: 'Café Cru (Café Verde)',
    intro: 'Vendemos café verde (cru) em sacas para torrefadores e indústrias, com referência de mercado transparente (indicador CEPEA/ESALQ).',
    bullets: [
      'Arábica e Conilon — informe variedade, volume e prazo.',
      'Cotação acompanha o indicador de mercado do dia.',
      'Logística combinada conforme o volume.',
    ],
    email: 'cafecru@cafesaporino.com.br',
  },
};

const Footer = ({ scrollToSection }: any) => {
  const currentYear = new Date().getFullYear();
  const [products, setProducts] = useState<Product[]>([]);
  const [bizInfo, setBizInfo] = useState<keyof typeof BIZ_INFO | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactFormData, setContactFormData] = useState({ name: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      // mostra os cafes mesmo quando inativos/esgotados (so escondemos os de teste)
      const { data } = await supabase
        .from('products')
        .select('*')
        .order('display_order', { ascending: true })
        .limit(6);
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []);

  const handleNavigation = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo(0, 0);
  };

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate sending email
    setTimeout(() => {
      toast.success('Mensagem enviada com sucesso!');
      setShowContactModal(false);
      setContactFormData({ name: '', subject: '', message: '' });
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <>
      <footer id="contact" className="bg-[#8a1f0c] text-white pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            {/* Column 1: Nossos Cafés */}
            <div>
              <h3 className="text-lg font-bold mb-6 text-white">Nossos cafés</h3>
              <ul className="space-y-3">
                {products.map((product) => (
                  <li key={product.id}>
                    <button
                      onClick={() => scrollToSection('products')}
                      className="text-white/80 hover:text-white transition-colors text-sm"
                    >
                      {product.name.replace(/^Café\s+/i, '')}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    onClick={() => scrollToSection('products')}
                    className="text-white/80 hover:text-white transition-colors text-sm"
                  >
                    Todos os cafés
                  </button>
                </li>
              </ul>
              <h4 className="text-sm font-bold mt-7 mb-3 text-white">Marcas que Distribuímos</h4>
              <ul className="space-y-3">
                <li>
                  <button onClick={() => handleNavigation('/marcas/canaan')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Café Canaan
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/marcas/fazendinha')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Café Fazendinha
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 2: Institucional */}
            <div>
              <h3 className="text-lg font-bold mb-6 text-white">Institucional</h3>
              <ul className="space-y-3">
                <li>
                  <button onClick={() => { window.history.pushState({}, '', '/nossa-historia'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-white/80 hover:text-white transition-colors text-sm">
                    Quem Somos
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/politica-assinatura')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Política de Assinatura
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/politica-privacidade')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Política de Privacidade
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/politica-cookies')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Política de Cookies
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/politica-reembolso')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Política de Reembolso
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/politica-frete')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Política de Frete
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/termos-servico')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Termos de Serviço
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/trabalhe-conosco')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Trabalhe Conosco
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/imprensa')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Imprensa
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Atendimento */}
            <div>
              <h3 className="text-lg font-bold mb-6 text-white">Atendimento</h3>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-white mb-2">E-mail:</h4>
                  <a href="mailto:sac@cafesaporino.com.br" className="text-white/80 hover:text-white transition-colors text-sm">
                    sac@cafesaporino.com.br
                  </a>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-2">Horário de Atendimento:</h4>
                  <p className="text-white/80 text-sm">Segunda à Sexta-Feira</p>
                  <p className="text-white/80 text-sm">08:00 às 18:00</p>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-2">Endereço:</h4>
                  <a
                    href="https://maps.app.goo.gl/bRx7bnNPn6o5Aytx5"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 hover:text-white transition-colors text-sm block"
                  >
                    Al. Rio Negro, 503 - Sala 2005<br />
                    Alphaville Industrial - Barueri - SP<br />
                    06454-000
                  </a>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-2">Central de Relacionamento</h4>
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="text-white/80 hover:text-white transition-colors text-sm font-medium underline"
                  >
                    Tire suas dúvidas
                  </button>
                </div>
              </div>
            </div>

            {/* Column 4: Para Seu Negócio */}
            <div>
              <h3 className="text-lg font-bold mb-6 text-white">Para Seu Negócio</h3>
              <ul className="space-y-3">
                <li>
                  <button onClick={() => setBizInfo('foodservice')} className="text-left text-white/80 hover:text-white transition-colors text-sm">
                    Food Service — Cozinha Industrial, Escritórios, Padaria, Empório, Cafeterias e Etc.
                  </button>
                </li>
                <li>
                  <button onClick={() => setBizInfo('marca_propria')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Marca Própria
                  </button>
                </li>
                <li>
                  <button onClick={() => setBizInfo('cafe_cru')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Café Cru (Café Verde)
                  </button>
                </li>
              </ul>

              <div className="mt-8">
                <h3 className="text-lg font-bold mb-4 text-white">Redes Sociais</h3>
                <div className="flex flex-wrap gap-3">
                  <a href="https://lnk.bio/cafesaporino" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="Link Bio">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.04 2.5c-.41 0-.82.08-1.21.24l-.15.06-7.3 3.43A2.5 2.5 0 0 0 2 8.5v7c0 1 .6 1.9 1.53 2.3l7.3 3.42.15.06c.39.15.8.23 1.21.23h.22c.41 0 .82-.08 1.21-.24l.15-.06 7.3-3.43A2.5 2.5 0 0 0 22 15.5v-7c0-1-.6-1.9-1.53-2.3l-7.3-3.42-.15-.06A2.7 2.7 0 0 0 12.25 2.5h-.21zm0 2c.14 0 .27.03.39.08l.08.03 7.3 3.43c.32.15.53.47.53.83v7c0 .36-.21.68-.53.83l-7.3 3.43-.08.03a.72.72 0 0 1-.78-.11l-5.46-5.46a1 1 0 0 1 0-1.41l5.46-5.46c.2-.2.46-.31.73-.31h.21z" />
                    </svg>
                  </a>
                  <a href="https://www.instagram.com/cafesaporino" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="Instagram">
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a href="https://www.facebook.com/cafesaporino" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="Facebook">
                    <Facebook className="w-5 h-5" />
                  </a>
                  <a href="https://www.linkedin.com/company/cafesaporino" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="LinkedIn">
                    <Linkedin className="w-5 h-5" />
                  </a>
                  <a href="https://x.com/cafesaporino" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="X (Twitter)">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <a href="https://www.tiktok.com/@cafesaporino" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors" title="TikTok">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-white/80 text-sm">© {currentYear} Café Saporino Ltda. CNPJ 61.109.694/0001-94 Todos os direitos reservados.</p>
            <div className="flex items-center space-x-2 mt-4 md:mt-0">
              <img src="/saporino-logo.png" alt="Saporino" className="h-8 opacity-70 hover:opacity-100 transition-all" />
            </div>
          </div>
        </div>
      </footer>

      {/* Modal "Para Seu Negócio" (Food Service / Marca Própria / Café Cru) */}
      {bizInfo && (
        <div className="fixed inset-0 z-[1300] overflow-y-auto" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBizInfo(null)} />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 md:p-8">
              <button onClick={() => setBizInfo(null)} aria-label="Fechar" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
              <span className="inline-block bg-[#8B2214] text-white text-[11px] font-semibold px-2.5 py-1 rounded-full mb-3">Para Seu Negócio</span>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{BIZ_INFO[bizInfo].title}</h3>
              <p className="text-gray-600 leading-relaxed mb-4">{BIZ_INFO[bizInfo].intro}</p>
              <ul className="space-y-2 mb-6">
                {BIZ_INFO[bizInfo].bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#8B2214] flex-shrink-0" />{b}
                  </li>
                ))}
              </ul>
              <div className="bg-[#f8f7f5] border border-[#ddd0cc] rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-800 mb-1">Fale com a gente</p>
                <p className="text-xs text-gray-500 mb-3">Conte o que precisa (volume, cidade, tipo de negócio) que retornamos com a melhor proposta.</p>
                <a href={`mailto:${BIZ_INFO[bizInfo].email}?subject=${encodeURIComponent(BIZ_INFO[bizInfo].title + ' — Café Saporino')}`}
                  className="inline-flex items-center gap-2 bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold px-5 py-2.5 rounded-full transition-colors break-all">
                  <Mail className="w-4 h-4 flex-shrink-0" /> {BIZ_INFO[bizInfo].email}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowContactModal(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-8 border-b border-gray-100">
              <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
                <Send className="w-7 h-7 text-[#8B2214]" />
                <span>Central de Relacionamento</span>
              </h2>
              <button onClick={() => setShowContactModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleContactSubmit} className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nome *</label>
                  <input
                    type="text"
                    required
                    value={contactFormData.name}
                    onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent transition-all"
                    placeholder="Seu nome completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Assunto *</label>
                  <input
                    type="text"
                    required
                    value={contactFormData.subject}
                    onChange={(e) => setContactFormData({ ...contactFormData, subject: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent transition-all"
                    placeholder="Assunto da sua mensagem"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Dúvidas *</label>
                  <textarea
                    required
                    value={contactFormData.message}
                    onChange={(e) => setContactFormData({ ...contactFormData, message: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8B2214] focus:border-transparent transition-all resize-none"
                    placeholder="Escreva suas dúvidas aqui..."
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 p-8 space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#8B2214] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg disabled:bg-gray-300 flex items-center justify-center space-x-2"
                >
                  <Send className="w-5 h-5" />
                  <span>{isSubmitting ? 'Enviando...' : 'Enviar Mensagem'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="w-full border-2 border-gray-300 text-gray-700 py-4 rounded-full font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
