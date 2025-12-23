import { useState, useEffect, FormEvent } from 'react';
import { Toaster, toast } from 'sonner';
import { ShoppingCart, Plus, Minus, X, Trash2, ShoppingBag, Menu, Instagram, Mail, Phone, MapPin, Send, User, ChevronDown, LogOut, CreditCard, Facebook, Linkedin, Lock } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider, useCart } from './contexts/CartContext';
import { AuthModal } from './components/AuthModal';
import { AdminDashboard } from './pages/AdminDashboard';
import { ResetPassword } from './pages/ResetPassword';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { UserProfile } from './pages/UserProfile';
import { supabase } from './lib/supabase';
import { Product, CartItem } from './types';
import { createPreference, MERCADO_PAGO_PUBLIC_KEY } from './lib/mercadopago';
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react';
import { PrivacyPolicy, ShippingPolicy, RefundPolicy, TermsOfService, SubscriptionPolicy, BusinessPage } from './pages/PolicyPages';
import { PaymentSuccess, PaymentFailure, PaymentPending } from './pages/PaymentPages';

const logoImage = '/SAPORINO LOGO transparente big-PNG.png';
const cafeLogoImage = '/cafe-logo-saporino copy.png';
const coffeeFieldImage = '/coffee-field.webp';

if (MERCADO_PAGO_PUBLIC_KEY) {
  initMercadoPago(MERCADO_PAGO_PUBLIC_KEY, { locale: 'pt-BR' });
}

function App() {
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

  if (currentPath === '/reset-password' || window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token')) {
    return <ResetPassword />;
  }

  if (currentPath === '/politica-privacidade') return <PrivacyPolicy />;
  if (currentPath === '/politica-frete') return <ShippingPolicy />;
  if (currentPath === '/politica-reembolso') return <RefundPolicy />;
  if (currentPath === '/termos-servico') return <TermsOfService />;
  if (currentPath === '/politica-assinatura') return <SubscriptionPolicy />;
  if (currentPath === '/para-seu-negocio') return <BusinessPage />;

  // Payment callback routes
  if (currentPath === '/payment/success') return <PaymentSuccess />;
  if (currentPath === '/payment/failure') return <PaymentFailure />;
  if (currentPath === '/payment/pending') return <PaymentPending />;

  return <AppContent />;
}

function AppContent() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });

  useEffect(() => {
    loadProducts();
    window.scrollTo(0, 0); // Scroll to top on page load/refresh
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
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

  const openAuth = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
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
      <Hero scrollToSection={scrollToSection} />
      <Products
        products={products}
        loading={loading}
        addedProducts={addedProducts}
        setAddedProducts={setAddedProducts}
      />
      <About />
      <Contact
        contactForm={contactForm}
        setContactForm={setContactForm}
        contactSubmitted={contactSubmitted}
        setContactSubmitted={setContactSubmitted}
      />
      <Footer scrollToSection={scrollToSection} />
      <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} onAuthOpen={openAuth} />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
      <Toaster position="top-center" richColors />
    </div>
  );
}

const Header = ({ isMobileMenuOpen, setIsMobileMenuOpen, scrollToSection, onCartOpen, onAuthOpen }: any) => {
  const { getCartCount } = useCart();
  const { user, profile, signOut } = useAuth();
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

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
                className="text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#a4240e] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
              >
                LOJA
              </button>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/assinatura');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#a4240e] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
              >
                ASSINATURA
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#a4240e] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
              >
                SOBRE
              </button>
              <button
                onClick={() => scrollToSection('journey')}
                className="text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#a4240e] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
              >
                JORNADA
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#a4240e] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
              >
                CONTATO
              </button>

              <div className="w-px h-6 bg-white/20 mx-2"></div>

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
                          onCartOpen();
                          setAccountDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-stone-50 transition-colors flex items-center space-x-3"
                      >
                        <ShoppingBag className="w-5 h-5 text-[#a4240e]" />
                        <span>Meus Pedidos</span>
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
                    className="flex items-center space-x-2 text-sm font-medium tracking-wide transition-all duration-300 text-white hover:text-[#a4240e] hover:bg-white/10 py-3 px-5 rounded-lg cursor-pointer"
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
                        <User className="w-5 h-5 text-[#a4240e]" />
                        <span>Cliente (PF)</span>
                      </button>
                      <button
                        onClick={() => {
                          onAuthOpen('login');
                          setAccountDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-stone-50 transition-colors flex items-center space-x-3 border-b border-gray-100"
                      >
                        <svg className="w-5 h-5 text-[#a4240e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span>Empresa (PJ)</span>
                      </button>
                      <button
                        onClick={() => {
                          onAuthOpen('login');
                          setAccountDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-stone-50 transition-colors flex items-center space-x-3"
                      >
                        <Lock className="w-5 h-5 text-[#a4240e]" />
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
                className="p-3 rounded-full transition-all duration-300 text-white hover:bg-white/10 hover:text-[#a4240e]"
              >
                <Instagram className="w-5 h-5" />
              </a>

              <button
                onClick={onCartOpen}
                className="relative p-3 rounded-full transition-all duration-300 text-white hover:bg-white/10 hover:text-[#a4240e] cursor-pointer"
              >
                <ShoppingCart className="w-6 h-6" />
                {getCartCount() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#a4240e] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
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
    </>
  );
};

const Hero = ({ scrollToSection }: any) => (
  <section id="hero" className="relative h-screen flex items-center justify-center overflow-hidden">
    <div
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: `url(${coffeeFieldImage})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
    </div>

    <div className="relative z-10 text-center text-white px-6 max-w-5xl mx-auto">
      <div className="relative inline-block mb-12">
        <img
          src={cafeLogoImage}
          alt="Café"
          className="absolute top-6 md:top-12 -left-12 md:-left-20 h-[49px] md:h-[85px] w-auto drop-shadow-2xl animate-fade-in z-10 transform -rotate-12"
        />
        <img
          src={logoImage}
          alt="Saporino"
          className="h-44 md:h-72 w-auto mx-auto drop-shadow-2xl animate-fade-in relative"
        />
      </div>

      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight animate-fade-in-up whitespace-nowrap">
        O Verdadeiro Sabor de Minas
      </h1>

      <p className="text-lg md:text-xl mb-12 max-w-4xl mx-auto font-light leading-relaxed animate-fade-in-up animation-delay-200">
        Café artesanal de Patrocínio, onde cada grão conta uma história de tradição e qualidade
      </p>

      <button
        onClick={() => scrollToSection('products')}
        className="bg-[#a4240e] hover:bg-[#8a1f0c] text-white px-10 py-4 rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-2xl animate-fade-in-up animation-delay-400"
      >
        Conheça Nossos Cafés
      </button>
    </div>

    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
  </section>
);

const Products = ({ products, loading, addedProducts, setAddedProducts }: any) => {
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

  if (loading) {
    return (
      <section id="products" className="py-24 bg-gradient-to-b from-white to-stone-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#a4240e] mx-auto"></div>
        </div>
      </section>
    );
  }

  return (
    <section id="products" className="py-24 bg-gradient-to-b from-white to-stone-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">Nossos Cafés</h2>
          <div className="w-24 h-1.5 bg-[#a4240e] mx-auto mb-6 rounded-full"></div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Seleção especial de cafés produzidos com os melhores grãos de Minas Gerais
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {products.map((product: Product) => (
            <div
              key={product.id}
              className="bg-white rounded-3xl shadow-lg overflow-hidden transform transition-all duration-500 hover:scale-105 hover:shadow-2xl group flex flex-col"
            >
              <div className="relative h-72 bg-gradient-to-br from-stone-200 to-stone-100 overflow-hidden flex items-center justify-center">
                <img
                  src={product.image_url && product.image_url.trim() !== '' ? product.image_url : "/SAPORINO LOGO transparente big-PNG.png"}
                  alt={product.name}
                  onError={(e) => {
                    e.currentTarget.src = "/SAPORINO LOGO transparente big-PNG.png";
                    e.currentTarget.classList.remove('object-contain');
                  }}
                  className={`h-32 w-auto group-hover:scale-110 transition-transform duration-500 ${product.image_url ? 'object-contain' : ''}`}
                />
                {product.featured && (
                  <div className="absolute top-6 right-6 bg-[#a4240e] text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                    Destaque
                  </div>
                )}
              </div>

              <div className="p-8 flex-1 flex flex-col">
                <div className="mb-3">
                  <span className="inline-block bg-[#a4240e] text-white text-xs font-semibold px-4 py-2 rounded-full">
                    {product.category}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h3>
                {product.description && (
                  <p className="text-gray-600 mb-4 leading-relaxed text-sm">{product.description}</p>
                )}

                <div className="mt-auto">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm text-gray-500 font-medium">{product.weight_grams}g</span>
                    <span className="text-3xl font-bold text-[#a4240e]">R$ {product.price.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock <= 0}
                    className={`w-full py-4 px-6 rounded-full font-semibold transition-all duration-300 flex items-center justify-center space-x-2 ${product.stock <= 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : addedProducts.has(product.id)
                        ? 'bg-green-600 text-white shadow-lg'
                        : 'bg-[#a4240e] text-white hover:bg-[#8a1f0c] transform hover:scale-105 shadow-lg'
                      }`}
                  >
                    {product.stock <= 0 ? (
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
      // Create order in database
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          customer_name: formData.name,
          customer_email: formData.email,
          customer_phone: formData.phone,
          shipping_address: formData.address,
          total_amount: getCartTotal(),
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
            <ShoppingBag className="w-7 h-7 text-[#a4240e]" />
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">E-mail *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Endereço de Entrega *</label>
                <textarea
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
                />
              </div>

              <div className="bg-stone-50 rounded-2xl p-6 space-y-3">
                <h3 className="font-bold text-gray-900 text-lg">Resumo do Pedido</h3>
                {cart.map((item: CartItem) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.name} x {item.quantity}</span>
                    <span className="font-semibold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-3 mt-3 flex justify-between font-bold text-xl">
                  <span>Total</span>
                  <span className="text-[#a4240e]">R$ {getCartTotal().toFixed(2)}</span>
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
                    className="w-full bg-[#a4240e] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg disabled:bg-gray-300 flex items-center justify-center space-x-2"
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
                  <div className="w-20 h-20 bg-gradient-to-br from-stone-200 to-stone-100 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
                    ☕
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">{item.name}</h3>
                    <p className="text-sm text-gray-500 mb-2">{item.weight}</p>
                    <p className="text-[#a4240e] font-bold text-lg mb-3">R$ {item.price.toFixed(2)}</p>
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
                <span className="text-3xl font-bold text-[#a4240e]">R$ {getCartTotal().toFixed(2)}</span>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full bg-[#a4240e] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg mb-3"
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

const About = () => (
  <section id="about" className="py-24 bg-white">
    <div className="max-w-7xl mx-auto px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="relative order-2 lg:order-1">
          <div
            className="relative h-[500px] rounded-3xl overflow-hidden shadow-2xl bg-cover bg-center"
            style={{ backgroundImage: `url(${coffeeFieldImage})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">Nossa História</h2>
          <div className="w-24 h-1.5 bg-[#a4240e] mb-8 rounded-full"></div>

          <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
            <p>
              O <strong className="text-gray-900">Café Saporino</strong> nasceu em 2025, em Patrocínio, Minas Gerais, no coração do Cerrado Mineiro, uma das regiões mais tradicionais e respeitadas na produção de café do Brasil. Desde o início, nosso propósito foi claro: levar às pessoas o sabor verdadeiro do café mineiro, aquele que carrega em cada grão a identidade, a cultura e a autenticidade da nossa terra.
            </p>
            <p className="font-semibold text-gray-900">
              Mas a essência da Saporino começou bem antes da nossa fundação.
            </p>
            <p>
              A história que nos inspira remonta a 1890, quando, sob o sol forte do Triângulo Mineiro, um jovem agricultor colhia grãos vermelhos que brilhavam como "ouro verde". Seu sonho era simples e grandioso ao mesmo tempo: ver o café de sua família conquistar São Paulo, o grande centro do comércio cafeeiro da época.
            </p>
            <p>
              As sacas, carregadas em carroças, seguiam até a estação mais próxima, de onde embarcavam em longas viagens de trem, cruzando o Rio Grande até Campinas e chegando finalmente à capital paulista. Cada grão levava consigo mais que aroma e sabor, levava a história de famílias inteiras que transformavam trabalho duro em tradição.
            </p>
            <p className="font-semibold text-gray-900">
              Hoje, a Saporino honra esse legado.
            </p>
            <p>
              Selecionamos cuidadosamente os melhores grãos do Cerrado Mineiro, mantendo o compromisso com a qualidade desde a lavoura até a torra. Cada pacote que chega às prateleiras carrega o percurso histórico que conecta Minas Gerais a São Paulo, da roça à cidade, do passado ao presente.
            </p>
            <p className="text-[#a4240e] font-semibold text-xl italic">
              Quando você abre um Café Saporino, você não está apenas provando um café, você está vivendo uma jornada que começou há mais de 130 anos e que continua sendo escrita, xícara após xícara, por quem valoriza sabor, tradição e origem.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const Contact = ({ contactForm, setContactForm, contactSubmitted, setContactSubmitted }: any) => {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setContactSubmitted(true);
    setTimeout(() => {
      setContactSubmitted(false);
      setContactForm({ name: '', email: '', message: '' });
    }, 3000);
  };

  return (
    <section id="journey" className="py-24 bg-gradient-to-b from-stone-50 to-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">DO GRÃO À XÍCARA</h2>
          <div className="w-24 h-1.5 bg-[#a4240e] mx-auto mb-6 rounded-full"></div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Conheça a jornada do nosso café, desde a origem até sua xícara
          </p>
        </div>

        <div className="space-y-12">
          {/* Seleção dos grãos */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <h3 className="text-3xl font-bold text-gray-900 mb-8 px-10 pt-10">Seleção dos grãos</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-10 pb-10">
              {/* Logo Solo Cerrado */}
              <div className="relative h-[400px] lg:h-[500px] rounded-2xl overflow-hidden bg-white flex items-center justify-center p-8">
                <img
                  src="/solo-cerrado-logo.png"
                  alt="Solo Cerrado Logo"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Informações da Solo Cerrado */}
              <div className="flex flex-col justify-center space-y-6">
                <div className="space-y-4">
                  <h4 className="text-2xl font-bold text-gray-900">Solo Cerrado</h4>
                  <div className="space-y-2 text-gray-700">
                    <p className="leading-relaxed">
                      Rua Miguel Marques, 389 – Bairro São Judas<br />
                      Patrocínio/MG – CEP 38705-292
                    </p>
                  </div>
                </div>

                {/* Espaço para a história (será adicionado depois) */}
                <div className="pt-6 border-t border-gray-200">
                  <p className="text-gray-600 leading-relaxed text-lg">
                    {/* História da Solo Cerrado será adicionada aqui */}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Torrefação artesanal */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <h3 className="text-3xl font-bold text-gray-900 mb-8 px-10 pt-10">Torrefação artesanal</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-10 pb-10">
              {/* Foto da Torrefação */}
              <div className="relative h-[400px] lg:h-[500px] rounded-2xl overflow-hidden">
                <img
                  src="/torrefacao-saporino.jpg"
                  alt="Torrefação Café Saporino"
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                />
              </div>

              {/* Informações da Torrefação */}
              <div className="flex flex-col justify-center space-y-6">
                <div className="space-y-4">
                  <h4 className="text-2xl font-bold text-gray-900">Café Original de Patrocínio Ltda.</h4>
                  <div className="space-y-2 text-gray-700">
                    <p><span className="font-semibold">CNPJ:</span> 33.334.059/0001-75</p>
                    <p className="leading-relaxed">
                      Estrada Municipal Ptc-004, Km 1,5, s/nº<br />
                      Bairro Aeroporto – Patrocínio/MG<br />
                      CEP 38744-002
                    </p>
                  </div>
                </div>

                {/* Espaço para a história (será adicionado depois) */}
                <div className="pt-6 border-t border-gray-200">
                  <p className="text-gray-600 leading-relaxed text-lg">
                    {/* História da torrefação será adicionada aqui */}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer = ({ scrollToSection }: any) => {
  const currentYear = new Date().getFullYear();
  const [products, setProducts] = useState<Product[]>([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactFormData, setContactFormData] = useState({ name: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(5);
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
            </div>

            {/* Column 2: Institucional */}
            <div>
              <h3 className="text-lg font-bold mb-6 text-white">Institucional</h3>
              <ul className="space-y-3">
                <li>
                  <button onClick={() => scrollToSection('about')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Quem Somos
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/politica-assinatura')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Política de assinatura
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/politica-privacidade')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Política de Privacidade
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/politica-reembolso')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Política de reembolso
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/politica-frete')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Política de Frete
                  </button>
                </li>
                <li>
                  <button onClick={() => handleNavigation('/termos-servico')} className="text-white/80 hover:text-white transition-colors text-sm">
                    Termos de serviço
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
              <p className="text-white/80 text-sm mb-4">
                Cozinha Industrial, Escritórios, Padaria, Empório, Cafeterias e Etc.
              </p>

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
              <img src="/SAPORINO LOGO transparente big-PNG.png" alt="Saporino" className="h-8 opacity-70 hover:opacity-100 transition-all" />
            </div>
          </div>
        </div>
      </footer>

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowContactModal(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-8 border-b border-gray-100">
              <h2 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
                <Send className="w-7 h-7 text-[#a4240e]" />
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent transition-all resize-none"
                    placeholder="Escreva suas dúvidas aqui..."
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 p-8 space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#a4240e] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg disabled:bg-gray-300 flex items-center justify-center space-x-2"
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
