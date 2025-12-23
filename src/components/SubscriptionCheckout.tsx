import { useState, useEffect, FormEvent } from 'react';
import { X, Package, Truck, CreditCard, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { createPreference } from '../lib/mercadopago';
import { Wallet } from '@mercadopago/sdk-react';

interface SubscriptionCheckoutProps {
  accountType: 'PF' | 'PJ';
  selectedCoffees: string[];
  grindType: 'beans' | 'coado' | 'espresso';
  shippingDate: 1 | 15;
  onClose: () => void;
  onSuccess: () => void;
}

const initialFormData = {
  customer_name: '',
  customer_email: '',
  customer_password: '',
  customer_phone: '',
  customer_cpf: '',
  customer_birth_date: '',
  shipping_postal_code: '',
  shipping_address: '',
  shipping_number: '',
  shipping_complement: '',
  shipping_neighborhood: '',
  shipping_city: '',
  shipping_state: 'São Paulo',
  cnpj: '',
  inscricao_estadual: '',
  email_xml: '',
  billing_address: '',
};

export const SubscriptionCheckout = ({
  accountType,
  selectedCoffees,
  grindType,
  shippingDate,
  onClose,
  onSuccess,
}: SubscriptionCheckoutProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'info' | 'freight' | 'payment'>('info');
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    setFormData({
      ...initialFormData,
      customer_email: user?.email || '',
    });
  }, [user]);

  const [freightData, setFreightData] = useState({
    freight_type: 'gratis' as 'correios' | 'empresa' | 'transportadora_cliente' | 'gratis',
    freight_cost: 0,
  });

  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao'>('pix');

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');

    if (cleanCep.length !== 8) {
      return;
    }

    setIsLoadingCep(true);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);

      if (!response.ok) {
        throw new Error('Erro ao consultar CEP');
      }

      const data = await response.json();

      if (data.erro) {
        alert('CEP não encontrado na base de dados.\n\nPor favor, preencha os campos de endereço manualmente.');
        setIsLoadingCep(false);
        return;
      }

      const stateMap: { [key: string]: string } = {
        'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas',
        'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo',
        'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul',
        'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
        'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
        'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
        'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
      };

      setFormData(prev => ({
        ...prev,
        shipping_address: data.logradouro || '',
        shipping_neighborhood: data.bairro || '',
        shipping_city: data.localidade || '',
        shipping_state: stateMap[data.uf] || data.uf || '',
      }));

      setIsLoadingCep(false);
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      alert('Não foi possível buscar o endereço automaticamente.\n\nPor favor, preencha os campos manualmente.');
      setIsLoadingCep(false);
    }
  };

  const handleCepChange = (value: string) => {
    const cleanCep = value.replace(/\D/g, '');

    let formattedCep = cleanCep;
    if (cleanCep.length > 5) {
      formattedCep = `${cleanCep.slice(0, 5)}-${cleanCep.slice(5, 8)}`;
    }

    setFormData(prev => ({ ...prev, shipping_postal_code: formattedCep }));

    if (cleanCep.length === 8) {
      fetchAddressByCep(cleanCep);
    }
  };

  const calculateFreight = () => {
    const basePrice = selectedCoffees.length * 35;
    const totalAmount = basePrice;

    if (accountType === 'PF') {
      if (totalAmount >= 100) {
        setFreightData({ freight_type: 'gratis', freight_cost: 0 });
      } else if (formData.shipping_state === 'São Paulo') {
        setFreightData({ freight_type: 'empresa', freight_cost: 15 });
      } else {
        setFreightData({ freight_type: 'correios', freight_cost: 25 });
      }
    } else {
      if (formData.shipping_state === 'São Paulo') {
        setFreightData({ freight_type: 'empresa', freight_cost: 0 });
      } else {
        setFreightData({ freight_type: 'transportadora_cliente', freight_cost: 0 });
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.customer_name.trim()) {
      alert('Por favor, preencha o campo Nome Completo.');
      return;
    }

    if (!formData.customer_email.trim()) {
      alert('Por favor, preencha o campo E-mail.');
      return;
    }

    if (!formData.customer_phone.trim()) {
      alert('Por favor, preencha o campo Telefone.');
      return;
    }

    if (accountType === 'PF') {
      if (!formData.customer_cpf.trim()) {
        alert('Por favor, preencha o campo CPF.');
        return;
      }

      if (!formData.customer_birth_date.trim()) {
        alert('Por favor, preencha o campo Data de Nascimento.');
        return;
      }
    }

    if (accountType === 'PJ') {
      if (!formData.cnpj.trim()) {
        alert('Por favor, preencha o campo CNPJ.');
        return;
      }

      if (!formData.inscricao_estadual.trim()) {
        alert('Por favor, preencha o campo Inscrição Estadual.');
        return;
      }

      if (!formData.email_xml.trim()) {
        alert('Por favor, preencha o campo E-mail para XML.');
        return;
      }
    }

    if (!formData.shipping_postal_code.trim()) {
      alert('Por favor, preencha o campo CEP.');
      return;
    }

    if (!formData.shipping_address.trim()) {
      alert('Por favor, preencha o campo Endereço.');
      return;
    }

    if (!formData.shipping_number.trim()) {
      alert('Por favor, preencha o campo Número.');
      return;
    }

    if (!formData.shipping_neighborhood.trim()) {
      alert('Por favor, preencha o campo Bairro.');
      return;
    }

    if (!formData.shipping_city.trim()) {
      alert('Por favor, preencha o campo Cidade.');
      return;
    }

    if (!formData.shipping_state.trim()) {
      alert('Por favor, preencha o campo Estado.');
      return;
    }

    setIsSubmitting(true);

    try {
      let userId = user?.id;

      if (!user) {
        if (!formData.customer_password || formData.customer_password.length < 6) {
          alert('A senha deve ter pelo menos 6 caracteres.');
          setIsSubmitting(false);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.customer_email,
          password: formData.customer_password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: formData.customer_name,
              phone: formData.customer_phone,
            },
          },
        });

        if (authError) {
          console.error('Signup error:', authError);
          throw authError;
        }
        if (!authData.user) throw new Error('Erro ao criar conta');

        userId = authData.user.id;

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!userId) throw new Error('Erro ao identificar usuário');

      const { error } = await supabase.from('user_profiles').upsert({
        id: userId,
        full_name: formData.customer_name,
        phone: formData.customer_phone,
        account_type: accountType,
        cpf: accountType === 'PF' ? formData.customer_cpf : null,
        birth_date: accountType === 'PF' ? formData.customer_birth_date : null,
        cnpj: accountType === 'PJ' ? formData.cnpj : null,
        inscricao_estadual: accountType === 'PJ' ? formData.inscricao_estadual : null,
        email_xml: accountType === 'PJ' ? formData.email_xml : null,
      });

      if (error) {
        console.error('Profile upsert error:', error);
        throw error;
      }

      const { error: addressError } = await supabase.from('user_addresses').insert({
        user_id: userId,
        address_line1: formData.shipping_address,
        address_line2: formData.shipping_complement || null,
        city: formData.shipping_city,
        state: formData.shipping_state,
        postal_code: formData.shipping_postal_code,
        country: 'Brasil',
        is_default: true,
        number: formData.shipping_number,
        neighborhood: formData.shipping_neighborhood,
        billing_address: accountType === 'PJ' ? formData.billing_address : null,
      });

      if (addressError && !addressError.message.includes('duplicate')) {
        console.error('Address insert error:', addressError);
        throw addressError;
      }

      console.log('Cadastro concluído com sucesso!');

      // Create subscription order
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .in('id', selectedCoffees);

      const totalAmount = basePrice + freightData.freight_cost;

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          customer_name: formData.customer_name,
          customer_email: formData.customer_email,
          customer_phone: formData.customer_phone,
          shipping_address: formData.shipping_address,
          shipping_postal_code: formData.shipping_postal_code,
          shipping_city: formData.shipping_city,
          shipping_state: formData.shipping_state,
          shipping_number: formData.shipping_number,
          shipping_neighborhood: formData.shipping_neighborhood,
          shipping_complement: formData.shipping_complement || null,
          total_amount: totalAmount,
          status: 'pending',
          order_type: 'subscription',
          subscription_frequency: 'monthly',
          subscription_shipping_date: shippingDate,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      if (orderData && products) {
        const orderItems = products.map((product) => ({
          order_id: orderData.id,
          product_id: product.id,
          product_name: product.name,
          grind_type: grindType,
          quantity: 1,
          unit_price: 35,
          subtotal: 35,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;

        // Create Mercado Pago preference
        const preferenceResponse = await createPreference({
          items: products.map((product) => ({
            title: `${product.name} - Assinatura Mensal`,
            quantity: 1,
            unit_price: 35,
            currency_id: 'BRL',
          })),
          back_urls: {
            success: `${window.location.origin}/payment/success`,
            failure: `${window.location.origin}/payment/failure`,
            pending: `${window.location.origin}/payment/pending`,
          },
          auto_return: 'approved',
          payer: {
            name: formData.customer_name,
            email: formData.customer_email,
            phone: {
              number: formData.customer_phone,
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
          setOrderId(orderData.id);
          setIsSubmitting(false);
          return; // Don't close modal, show payment button
        }
      }

      // Fallback if payment creation fails
      if (!user) {
        alert('Cadastro realizado com sucesso! Você será redirecionado...');
        setTimeout(() => {
          onSuccess();
        }, 500);
      } else {
        alert('Perfil atualizado com sucesso!');
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);

      const errorMessage = error.message || '';
      const errorDetails = error.details || '';
      const fullError = `${errorMessage} ${errorDetails}`.toLowerCase();

      if (errorMessage.includes('User already registered') || errorMessage.includes('already registered')) {
        alert('Este e-mail já está cadastrado. Por favor, faça login no botão ENTRAR no topo da página.');
      } else if (fullError.includes('user_profiles_cpf_unique')) {
        alert('Este CPF já está cadastrado no sistema. Se você já tem cadastro, faça login no botão ENTRAR no topo da página.');
      } else if (fullError.includes('user_profiles_phone_unique')) {
        alert('Este telefone já está cadastrado no sistema. Se você já tem cadastro, faça login no botão ENTRAR no topo da página. Se trocou de número, entre em contato conosco.');
      } else if (errorMessage.includes('duplicate key')) {
        alert('Já existe um cadastro com estes dados. Por favor, faça login no botão ENTRAR no topo da página.');
      } else {
        alert(`Erro ao realizar cadastro: ${errorMessage || 'Tente novamente.'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const basePrice = selectedCoffees.length * 35;
  const totalAmount = basePrice + freightData.freight_cost;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm">
      <div className="h-full flex">
        <div className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex items-center justify-between z-10">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                Cadastro {accountType}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Complete seu cadastro para acessar nossos produtos
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-8 py-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-stone-50 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <Package className="w-6 h-6 text-[#a4240e]" />
                  <span>Dados Pessoais</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        E-mail *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.customer_email}
                        onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                        disabled={!!user}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Telefone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.customer_phone}
                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        placeholder="(11) 98765-4321"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                      />
                    </div>
                  </div>

                  {!user && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Senha *
                      </label>
                      <input
                        type="password"
                        required
                        value={formData.customer_password}
                        onChange={(e) => setFormData({ ...formData, customer_password: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Crie uma senha para acessar sua conta no futuro
                      </p>
                    </div>
                  )}

                  {accountType === 'PF' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          CPF *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.customer_cpf}
                          onChange={(e) => setFormData({ ...formData, customer_cpf: e.target.value })}
                          placeholder="000.000.000-00"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Data de Nascimento
                        </label>
                        <input
                          type="date"
                          value={formData.customer_birth_date}
                          onChange={(e) => setFormData({ ...formData, customer_birth_date: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            CNPJ *
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.cnpj}
                            onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                            placeholder="00.000.000/0000-00"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Inscrição Estadual *
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.inscricao_estadual}
                            onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          E-mail para XML *
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.email_xml}
                          onChange={(e) => setFormData({ ...formData, email_xml: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-stone-50 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Endereço de Entrega</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      CEP *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formData.shipping_postal_code}
                        onChange={(e) => handleCepChange(e.target.value)}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                      />
                      {isLoadingCep && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#a4240e]"></div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Digite o CEP e o endereço será preenchido automaticamente
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Endereço *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.shipping_address}
                        onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Número *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.shipping_number}
                        onChange={(e) => setFormData({ ...formData, shipping_number: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Complemento
                      </label>
                      <input
                        type="text"
                        value={formData.shipping_complement}
                        onChange={(e) => setFormData({ ...formData, shipping_complement: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Bairro *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.shipping_neighborhood}
                        onChange={(e) => setFormData({ ...formData, shipping_neighborhood: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Cidade *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.shipping_city}
                        onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Estado *
                      </label>
                      <select
                        required
                        value={formData.shipping_state}
                        onChange={(e) => setFormData({ ...formData, shipping_state: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                      >
                        <option value="São Paulo">São Paulo</option>
                        <option value="Acre">Acre</option>
                        <option value="Alagoas">Alagoas</option>
                        <option value="Amapá">Amapá</option>
                        <option value="Amazonas">Amazonas</option>
                        <option value="Bahia">Bahia</option>
                        <option value="Ceará">Ceará</option>
                        <option value="Distrito Federal">Distrito Federal</option>
                        <option value="Espírito Santo">Espírito Santo</option>
                        <option value="Goiás">Goiás</option>
                        <option value="Maranhão">Maranhão</option>
                        <option value="Mato Grosso">Mato Grosso</option>
                        <option value="Mato Grosso do Sul">Mato Grosso do Sul</option>
                        <option value="Minas Gerais">Minas Gerais</option>
                        <option value="Pará">Pará</option>
                        <option value="Paraíba">Paraíba</option>
                        <option value="Paraná">Paraná</option>
                        <option value="Pernambuco">Pernambuco</option>
                        <option value="Piauí">Piauí</option>
                        <option value="Rio de Janeiro">Rio de Janeiro</option>
                        <option value="Rio Grande do Norte">Rio Grande do Norte</option>
                        <option value="Rio Grande do Sul">Rio Grande do Sul</option>
                        <option value="Rondônia">Rondônia</option>
                        <option value="Roraima">Roraima</option>
                        <option value="Santa Catarina">Santa Catarina</option>
                        <option value="Sergipe">Sergipe</option>
                        <option value="Tocantins">Tocantins</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {accountType === 'PJ' && (
                <div className="bg-stone-50 rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Endereço de Faturamento</h3>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Endereço Completo *
                    </label>
                    <textarea
                      required
                      value={formData.billing_address}
                      onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {preferenceId ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-green-900 mb-2">
                      Cadastro Concluído!
                    </h3>
                    <p className="text-green-700 mb-1">
                      Seu pedido foi criado com sucesso.
                    </p>
                    <p className="text-sm text-green-600">
                      Clique no botão abaixo para realizar o pagamento via Mercado Pago.
                    </p>
                  </div>

                  <div className="bg-stone-50 rounded-2xl p-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Resumo da Assinatura:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cafés selecionados:</span>
                        <span className="font-semibold">{selectedCoffees.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Valor por café:</span>
                        <span className="font-semibold">R$ 35,00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Frete:</span>
                        <span className="font-semibold">
                          {freightData.freight_cost === 0 ? 'Grátis' : `R$ ${freightData.freight_cost.toFixed(2)}`}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                        <span className="font-bold text-gray-900">Total:</span>
                        <span className="font-bold text-[#a4240e] text-xl">
                          R$ {(basePrice + freightData.freight_cost).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Wallet initialization={{ preferenceId }} />

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full border-2 border-gray-300 text-gray-700 py-4 rounded-full font-semibold hover:bg-gray-50 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#a4240e] text-white py-4 rounded-full font-semibold hover:bg-[#8a1f0c] transition-all shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Processando...' : 'Finalizar Cadastro'}
                </button>
              )}
            </form>
          </div>
        </div>

        <div className="flex-1 bg-stone-100 hidden lg:flex items-start justify-center p-12">
          <div className="sticky top-12 w-full max-w-md">
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Cadastro {accountType === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
              </h3>

              <div className="space-y-4">
                <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                  <p className="text-sm font-semibold text-green-800 mb-2">
                    Após completar seu cadastro você terá acesso a:
                  </p>
                  <ul className="space-y-2 text-sm text-green-700">
                    <li className="flex items-center space-x-2">
                      <Check className="w-4 h-4" />
                      <span>Catálogo completo de cafés</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Check className="w-4 h-4" />
                      <span>Preços exclusivos {accountType}</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Check className="w-4 h-4" />
                      <span>Sistema de assinatura mensal</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Check className="w-4 h-4" />
                      <span>Entrega automática</span>
                    </li>
                  </ul>
                </div>

                {accountType === 'PF' && (
                  <div className="bg-[#a4240e]/10 rounded-xl p-4">
                    <p className="text-sm font-semibold text-[#a4240e] mb-1">
                      Frete Grátis
                    </p>
                    <p className="text-xs text-gray-600">
                      Para compras acima de R$ 100 em São Paulo
                    </p>
                  </div>
                )}

                {accountType === 'PJ' && (
                  <div className="bg-[#a4240e]/10 rounded-xl p-4">
                    <p className="text-sm font-semibold text-[#a4240e] mb-1">
                      Entrega Própria
                    </p>
                    <p className="text-xs text-gray-600">
                      Sem custo adicional dentro do estado de São Paulo
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
