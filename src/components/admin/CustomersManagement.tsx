import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Search, Filter, Mail, Phone, Calendar, Building2, User, FileText, Edit, Save, X, ShoppingBag, TrendingUp, Package, Gift, Send, MessageCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  celular: string | null;
  account_type: 'PF' | 'PJ' | null;
  cpf: string | null;
  birth_date: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  email_xml: string | null;
  created_at: string;
  email?: string;
  billing_address?: string;
  billing_number?: string;
  billing_complement?: string;
  billing_neighborhood?: string;
  billing_city?: string;
  billing_state?: string;
  billing_cep?: string;
  shipping_address?: string;
  shipping_number?: string;
  shipping_complement?: string;
  shipping_neighborhood?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_cep?: string;
}

export const CustomersManagement = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'PF' | 'PJ'>('all');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [sameAddress, setSameAddress] = useState(false);
  const [emailChangeHelper, setEmailChangeHelper] = useState(false);
  const [originalEmail, setOriginalEmail] = useState('');

  const isCellPhone = (phone: string | null): boolean => {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      const ddd = cleaned.substring(2, 4);
      const firstDigit = cleaned.charAt(4);
      return firstDigit === '9';
    }
    if (cleaned.length === 11) {
      const firstDigit = cleaned.charAt(2);
      return firstDigit === '9';
    }
    if (cleaned.length === 10) {
      return false;
    }
    return phone.length >= 14;
  };

  const formatWhatsAppNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('55')) return cleaned;
    return '55' + cleaned;
  };

  const openWhatsApp = (phone: string) => {
    const number = formatWhatsAppNumber(phone);
    window.open(`https://wa.me/${number}`, '_blank');
  };

  const handlePhoneInput = (value: string, field: 'phone' | 'celular') => {
    if (!value) {
      setFormData({ ...formData, [field]: value });
      return;
    }

    const cleaned = value.replace(/\D/g, '');

    if (cleaned.length >= 10) {
      const isCell = isCellPhone(value);

      if (field === 'phone' && isCell) {
        setFormData({ ...formData, phone: '', celular: value });
        setTimeout(() => {
          alert('Número detectado como celular! Movido para o campo "Celular".');
        }, 100);
      } else if (field === 'celular' && !isCell && cleaned.length === 10) {
        setFormData({ ...formData, celular: '', phone: value });
        setTimeout(() => {
          alert('Número detectado como telefone fixo! Movido para o campo "Telefone".');
        }, 100);
      } else {
        setFormData({ ...formData, [field]: value });
      }
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };
  const [viewingHistory, setViewingHistory] = useState<Customer | null>(null);
  const [customerStats, setCustomerStats] = useState<any>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [showLabelFormatSelector, setShowLabelFormatSelector] = useState(false);
  const [labelFormats, setLabelFormats] = useState<any[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<any>(null);
  const fetchingCEPRef = useRef(false);

  useEffect(() => {
    console.log('CustomersManagement: Loading customers...');
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    console.log('loadCustomers: START');
    try {
      setLoading(true);

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('loadCustomers: Profiles loaded:', profiles?.length);

      if (profilesError) throw profilesError;

      const customersWithEmails = (profiles || []).map(profile => {
        return {
          ...profile,
          email: profile.email_xml || 'N/A',
        };
      });

      setCustomers(customersWithEmails);
      console.log('loadCustomers: SUCCESS, customers set:', customersWithEmails.length);
    } catch (error) {
      console.error('loadCustomers: ERROR', error);
      setCustomers([]);
    } finally {
      setLoading(false);
      console.log('loadCustomers: END');
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch =
      customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm) ||
      customer.cpf?.includes(searchTerm) ||
      customer.cnpj?.includes(searchTerm);

    const matchesFilter =
      filterType === 'all' ||
      customer.account_type === filterType;

    return matchesSearch && matchesFilter;
  });

  const pfCount = customers.filter(c => c.account_type === 'PF').length;
  const pjCount = customers.filter(c => c.account_type === 'PJ').length;

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData(customer);
    setOriginalEmail(customer.email_xml || customer.email || '');
    setEmailChangeHelper(false);
  };

  const handleSave = async () => {
    if (!editingCustomer) return;

    try {
      const updateData: any = {
        full_name: formData.full_name,
        phone: formData.phone,
        celular: formData.celular,
        account_type: formData.account_type || 'PF',
        cpf: formData.cpf,
        birth_date: formData.birth_date,
        cnpj: formData.cnpj,
        inscricao_estadual: formData.inscricao_estadual,
        email_xml: formData.email_xml,
        billing_address: formData.billing_address,
        billing_number: formData.billing_number,
        billing_complement: formData.billing_complement,
        billing_neighborhood: formData.billing_neighborhood,
        billing_city: formData.billing_city,
        billing_state: formData.billing_state,
        billing_cep: formData.billing_cep,
      };

      if (sameAddress && formData.billing_address) {
        updateData.shipping_address = formData.billing_address;
        updateData.shipping_number = formData.billing_number;
        updateData.shipping_complement = formData.billing_complement;
        updateData.shipping_neighborhood = formData.billing_neighborhood;
        updateData.shipping_city = formData.billing_city;
        updateData.shipping_state = formData.billing_state;
        updateData.shipping_cep = formData.billing_cep;
      } else {
        updateData.shipping_address = formData.shipping_address;
        updateData.shipping_number = formData.shipping_number;
        updateData.shipping_complement = formData.shipping_complement;
        updateData.shipping_neighborhood = formData.shipping_neighborhood;
        updateData.shipping_city = formData.shipping_city;
        updateData.shipping_state = formData.shipping_state;
        updateData.shipping_cep = formData.shipping_cep;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', editingCustomer.id)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Cliente atualizado:', data);

      await loadCustomers();

      await loadCustomers();

      toast.success('Cliente atualizado com sucesso!');

      setEditingCustomer(null);
      setFormData({});
      setSameAddress(false);
    } catch (error: any) {
      console.error('Error updating customer:', error);
      toast.error(`Erro ao atualizar cliente: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleCancel = () => {
    setEditingCustomer(null);
    setFormData({});
  };

  const handleDelete = async (customer: Customer) => {
    const customerName = customer.full_name || customer.cpf || customer.cnpj || 'este cliente';
    const confirmMessage = `Tem certeza que deseja DELETAR ${customerName}?\n\n⚠️ Esta ação NÃO pode ser desfeita!\n\n✓ Todos os dados do cliente serão removidos permanentemente\n✓ Histórico de compras será mantido para referência\n\nDigite OK para confirmar a exclusão.`;

    const userInput = prompt(confirmMessage);

    if (userInput !== 'OK') {
      if (userInput !== null) {
        toast.error('Exclusão cancelada. Digite exatamente OK para confirmar.');
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', customer.id);

      if (error) throw error;

      toast.success(`Cliente ${customerName} deletado com sucesso!`);
      await loadCustomers();
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      toast.error(`Erro ao deletar cliente: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const loadCustomerHistory = async (customer: Customer) => {
    try {
      setViewingHistory(customer);

      const { data: stats } = await supabase
        .from('customer_stats')
        .select('*')
        .eq('user_id', customer.id)
        .maybeSingle();

      const { data: orders } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (name, image_url)
          )
        `)
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false });

      setCustomerStats(stats);
      setCustomerOrders(orders || []);
    } catch (error) {
      console.error('Error loading customer history:', error);
    }
  };

  const handleSendAnniversaryEmail = async (customer: Customer) => {
    if (!confirm(`Enviar email de agradecimento para ${customer.full_name}?`)) return;

    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const { data: gift } = await supabase
        .from('anniversary_gifts')
        .insert({
          user_id: customer.id,
          anniversary_year: 1,
          email_sent_at: new Date().toISOString(),
          status: 'email_sent',
        })
        .select()
        .single();

      await supabase
        .from('user_profiles')
        .update({
          anniversary_email_sent: true,
          last_anniversary_email_date: new Date().toISOString(),
        })
        .eq('id', customer.id);

      alert('Email de agradecimento enviado com sucesso!');
      loadCustomers();
    } catch (error) {
      console.error('Error sending anniversary email:', error);
      alert('Erro ao enviar email');
    }
  };

  const isAnniversary = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diff = now.getTime() - created.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days >= 365;
  };

  const fetchAddressByCEP = useCallback(async (cep: string, type: 'billing' | 'shipping') => {
    if (fetchingCEPRef.current) {
      return;
    }

    const cleanCEP = cep.replace(/\D/g, '');

    if (cleanCEP.length === 0) {
      setFormData(prev => {
        if (type === 'billing') {
          return {
            ...prev,
            billing_cep: '',
            billing_address: '',
            billing_number: '',
            billing_complement: '',
            billing_neighborhood: '',
            billing_city: '',
            billing_state: '',
          };
        } else {
          return {
            ...prev,
            shipping_cep: '',
            shipping_address: '',
            shipping_number: '',
            shipping_complement: '',
            shipping_neighborhood: '',
            shipping_city: '',
            shipping_state: '',
          };
        }
      });
      return;
    }

    if (cleanCEP.length !== 8) return;

    try {
      fetchingCEPRef.current = true;
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      const data = await response.json();

      if (data.erro) {
        alert('CEP não encontrado');
        return;
      }

      setFormData(prev => {
        if (type === 'billing') {
          return {
            ...prev,
            billing_cep: cep,
            billing_address: data.logradouro || '',
            billing_number: '',
            billing_complement: '',
            billing_neighborhood: data.bairro || '',
            billing_city: data.localidade || '',
            billing_state: data.uf || '',
          };
        } else {
          return {
            ...prev,
            shipping_cep: cep,
            shipping_address: data.logradouro || '',
            shipping_number: '',
            shipping_complement: '',
            shipping_neighborhood: data.bairro || '',
            shipping_city: data.localidade || '',
            shipping_state: data.uf || '',
          };
        }
      });
    } catch (error) {
      console.error('Error fetching CEP:', error);
      alert('Erro ao buscar CEP');
    } finally {
      fetchingCEPRef.current = false;
    }
  }, []);

  const getMostConsumedCoffee = async (userId: string) => {
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          order_items (
            product_id,
            quantity,
            products (
              id,
              name,
              weight_grams,
              image_url
            )
          )
        `)
        .eq('user_id', userId);

      if (!orders || orders.length === 0) {
        const { data: defaultProduct } = await supabase
          .from('products')
          .select('*')
          .eq('weight_grams', 500)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        return defaultProduct;
      }

      const productCounts: { [key: string]: { count: number; product: any } } = {};

      orders.forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
          if (item.products && item.products.weight_grams === 500) {
            const id = item.products.id;
            if (!productCounts[id]) {
              productCounts[id] = { count: 0, product: item.products };
            }
            productCounts[id].count += item.quantity;
          }
        });
      });

      if (Object.keys(productCounts).length === 0) {
        const { data: defaultProduct } = await supabase
          .from('products')
          .select('*')
          .eq('weight_grams', 500)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        return defaultProduct;
      }

      const mostConsumed = Object.values(productCounts).sort((a, b) => b.count - a.count)[0];
      return mostConsumed.product;
    } catch (error) {
      console.error('Error getting most consumed coffee:', error);
      return null;
    }
  };

  const loadLabelFormats = async (customer: Customer) => {
    try {
      const { data: formats } = await supabase
        .from('label_formats')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      setLabelFormats(formats || []);
      setSelectedFormat(formats?.[0] || null);
      setShowLabelFormatSelector(true);
      setViewingHistory(customer);
    } catch (error) {
      console.error('Error loading formats:', error);
      alert('Erro ao carregar formatos de etiqueta');
    }
  };

  const generateShippingLabel = async (customer: Customer, format: any) => {
    try {
      const coffee = await getMostConsumedCoffee(customer.id);

      if (!coffee) {
        alert('Não foi possível identificar um café para enviar. Por favor, adicione produtos de 500g ao catálogo.');
        return;
      }

      const { data: settings } = await supabase
        .from('admin_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      const labelHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Etiqueta de Envio - Brinde Aniversário - ${format.name}</title>
  <style>
    @page { size: ${format.width_mm}mm ${format.height_mm}mm; margin: 5mm; }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      font-size: 11pt;
    }
    .label-container {
      border: 2px solid #000;
      padding: ${format.height_mm > 100 ? '15px' : '10px'};
      width: ${format.width_mm - 10}mm;
      height: ${format.height_mm - 10}mm;
      box-sizing: border-box;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .header h1 {
      margin: 0;
      font-size: 20pt;
      color: #a4240e;
    }
    .header p {
      margin: 5px 0;
      font-size: 10pt;
    }
    .section {
      margin-bottom: 15px;
    }
    .section-title {
      font-weight: bold;
      font-size: 12pt;
      margin-bottom: 5px;
      color: #a4240e;
      border-bottom: 1px solid #ccc;
    }
    .address-box {
      border: 1px solid #000;
      padding: 10px;
      margin-top: 5px;
      background-color: #f9f9f9;
    }
    .product-box {
      border: 1px solid #a4240e;
      padding: 10px;
      margin-top: 5px;
      background-color: #fff9f8;
    }
    .gift-badge {
      background-color: #a4240e;
      color: white;
      padding: 5px 10px;
      display: inline-block;
      font-weight: bold;
      margin-top: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #ccc;
      font-size: 9pt;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="label-container">
    <div class="header">
      <h1>🎁 CAFÉ SAPORINO</h1>
      <p><strong>BRINDE DE ANIVERSÁRIO - 1 ANO</strong></p>
      <p>Obrigado por fazer parte da nossa história!</p>
    </div>

    <div class="section">
      <div class="section-title">REMETENTE</div>
      <div class="address-box">
        <strong>${settings?.sender_name || 'Café Saporino'}</strong><br>
        ${settings?.sender_street || ''}, ${settings?.sender_number || ''}<br>
        ${settings?.sender_complement ? settings.sender_complement + '<br>' : ''}
        ${settings?.sender_neighborhood || ''} - ${settings?.sender_city || ''}, ${settings?.sender_state || ''}<br>
        CEP: ${settings?.sender_cep || ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">DESTINATÁRIO</div>
      <div class="address-box">
        <strong>${customer.full_name}</strong><br>
        ${customer.account_type === 'PJ' ? 'CNPJ: ' + (customer.cnpj || 'N/A') : 'CPF: ' + (customer.cpf || 'N/A')}<br>
        ${customer.shipping_address || customer.billing_address || ''}, ${customer.shipping_number || customer.billing_number || ''}<br>
        ${(customer.shipping_complement || customer.billing_complement) ? (customer.shipping_complement || customer.billing_complement) + '<br>' : ''}
        ${customer.shipping_neighborhood || customer.billing_neighborhood || ''} - ${customer.shipping_city || customer.billing_city || ''}, ${customer.shipping_state || customer.billing_state || ''}<br>
        CEP: ${customer.shipping_cep || customer.billing_cep || ''}<br>
        Tel: ${customer.celular || customer.phone || ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">PRODUTO - BRINDE</div>
      <div class="product-box">
        <strong>${coffee.name}</strong><br>
        Peso: 500g<br>
        + Xícara Saporino Exclusiva
      </div>
    </div>

    <div class="gift-badge">
      🎉 PRESENTE ESPECIAL - NÃO COBRAR
    </div>

    <div class="footer">
      Data de Impressão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}<br>
      Cliente desde: ${new Date(customer.created_at).toLocaleDateString('pt-BR')}
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
      `;

      const blob = new Blob([labelHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');

      if (newWindow) {
        await supabase
          .from('anniversary_gifts')
          .update({
            product_id: coffee.id,
            product_name: coffee.name,
            status: 'gift_sent',
            gift_sent_at: new Date().toISOString(),
          })
          .eq('user_id', customer.id)
          .eq('anniversary_year', 1);

        await supabase
          .from('user_profiles')
          .update({
            anniversary_gift_sent: true,
          })
          .eq('id', customer.id);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        alert('Etiqueta gerada com sucesso! A janela de impressão será aberta.');
        loadCustomers();
      }
    } catch (error) {
      console.error('Error generating label:', error);
      alert('Erro ao gerar etiqueta');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a4240e] mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {editingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900">Editar Cliente</h3>
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Email Change Helper Section */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  E-mail de Contato
                </label>
                <input
                  type="email"
                  value={formData.email_xml || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, email_xml: e.target.value });
                    // Show helper if email has changed
                    if (e.target.value !== originalEmail) {
                      setEmailChangeHelper(true);
                    } else {
                      setEmailChangeHelper(false);
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                />

                {emailChangeHelper && (
                  <div className="mt-4 bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">!</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-yellow-900 text-sm mb-1">
                          ⚠️ ATENÇÃO: Mudança de Email Detectada
                        </h4>
                        <p className="text-yellow-800 text-xs leading-relaxed">
                          Você está alterando o email de contato de <strong>{originalEmail}</strong> para <strong>{formData.email_xml}</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-yellow-300">
                      <h5 className="font-bold text-gray-900 text-sm mb-2">📋 Checklist Obrigatório:</h5>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-start space-x-2">
                          <input type="checkbox" className="mt-0.5" id="step1" />
                          <label htmlFor="step1" className="text-gray-700">
                            <strong>Passo 1:</strong> Clique em "Salvar" aqui para atualizar o email de contato
                          </label>
                        </div>

                        <div className="flex items-start space-x-2">
                          <input type="checkbox" className="mt-0.5" id="step2" />
                          <label htmlFor="step2" className="text-gray-700">
                            <strong>Passo 2:</strong> Abra o Supabase Dashboard (botão abaixo)
                          </label>
                        </div>

                        <div className="flex items-start space-x-2">
                          <input type="checkbox" className="mt-0.5" id="step3" />
                          <label htmlFor="step3" className="text-gray-700">
                            <strong>Passo 3:</strong> No Supabase: Authentication → Users → Encontre {editingCustomer?.full_name}
                          </label>
                        </div>

                        <div className="flex items-start space-x-2">
                          <input type="checkbox" className="mt-0.5" id="step4" />
                          <label htmlFor="step4" className="text-gray-700">
                            <strong>Passo 4:</strong> Clique nos 3 pontinhos → "Edit User" → Altere o email para <strong>{formData.email_xml}</strong>
                          </label>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-yellow-200">
                        <p className="text-yellow-900 font-semibold text-xs mb-2">
                          ⚡ Por que fazer isso?
                        </p>
                        <p className="text-gray-700 text-xs leading-relaxed">
                          O email de LOGIN é diferente do email de CONTATO. Se você só atualizar aqui, o cliente não conseguirá usar "Esqueci minha senha" com o novo email. Você precisa atualizar ambos!
                        </p>
                      </div>

                      <a
                        href={`https://app.supabase.com/project/${import.meta.env.VITE_SUPABASE_URL?.split('.')[0].replace('https://', '')}/auth/users`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 transition-colors"
                      >
                        <span>🚀 Abrir Supabase Dashboard</span>
                      </a>
                    </div>
                  </div>
                )}

                {!emailChangeHelper && (
                  <p className="text-xs text-gray-500 mt-1">
                    Este e-mail é usado para contato e XML. Para mudar o email de LOGIN, veja as instruções que aparecem ao alterar este campo.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de Conta *
                </label>
                <select
                  value={formData.account_type || 'PF'}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value as 'PF' | 'PJ' })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                >
                  <option value="PF">Pessoa Física</option>
                  <option value="PJ">Pessoa Jurídica</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Telefone Fixo</label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={(e) => handlePhoneInput(e.target.value, 'phone')}
                    placeholder="+55 (11) 3456-7890"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Detecta automaticamente o tipo</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Celular
                    {formData.celular && isCellPhone(formData.celular) && (
                      <span className="ml-2 text-green-600 text-xs">(WhatsApp)</span>
                    )}
                  </label>
                  <input
                    type="tel"
                    value={formData.celular || ''}
                    onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                    onBlur={(e) => handlePhoneInput(e.target.value, 'celular')}
                    placeholder="+55 (11) 91234-5678"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Detecta automaticamente o tipo</p>
                </div>
              </div>

              {(formData.account_type === 'PF' || !formData.account_type) ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">CPF</label>
                    <input
                      type="text"
                      value={formData.cpf || ''}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                      placeholder="000.000.000-00"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Data de Nascimento
                    </label>
                    <input
                      type="date"
                      value={formData.birth_date || ''}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">CNPJ</label>
                    <input
                      type="text"
                      value={formData.cnpj || ''}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Inscrição Estadual
                    </label>
                    <input
                      type="text"
                      value={formData.inscricao_estadual || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, inscricao_estadual: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      E-mail para XML
                    </label>
                    <input
                      type="email"
                      value={formData.email_xml || ''}
                      onChange={(e) => setFormData({ ...formData, email_xml: e.target.value })}
                      placeholder="nfe@empresa.com.br"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>
                </>
              )}

              <div className="border-t border-gray-300 pt-6 mt-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4">Endereço de Cobrança</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">CEP</label>
                    <input
                      type="text"
                      value={formData.billing_cep || ''}
                      onChange={(e) => setFormData({ ...formData, billing_cep: e.target.value })}
                      onBlur={(e) => fetchAddressByCEP(e.target.value, 'billing')}
                      placeholder="00000-000"
                      maxLength={9}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">O endereço será preenchido automaticamente</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Endereço</label>
                    <input
                      type="text"
                      value={formData.billing_address || ''}
                      onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                      placeholder="Rua, Avenida..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Número</label>
                    <input
                      type="text"
                      value={formData.billing_number || ''}
                      onChange={(e) => setFormData({ ...formData, billing_number: e.target.value })}
                      placeholder="123"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Complemento</label>
                    <input
                      type="text"
                      value={formData.billing_complement || ''}
                      onChange={(e) => setFormData({ ...formData, billing_complement: e.target.value })}
                      placeholder="Apto, Sala..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Bairro</label>
                    <input
                      type="text"
                      value={formData.billing_neighborhood || ''}
                      onChange={(e) => setFormData({ ...formData, billing_neighborhood: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cidade</label>
                    <input
                      type="text"
                      value={formData.billing_city || ''}
                      onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
                    <input
                      type="text"
                      value={formData.billing_state || ''}
                      onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                      placeholder="SP"
                      maxLength={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-300 pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-900">Endereço de Entrega</h4>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameAddress}
                      onChange={(e) => {
                        setSameAddress(e.target.checked);
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            shipping_address: formData.billing_address,
                            shipping_number: formData.billing_number,
                            shipping_complement: formData.billing_complement,
                            shipping_neighborhood: formData.billing_neighborhood,
                            shipping_city: formData.billing_city,
                            shipping_state: formData.billing_state,
                            shipping_cep: formData.billing_cep,
                          });
                        }
                      }}
                      className="w-4 h-4 text-[#a4240e] rounded focus:ring-[#a4240e]"
                    />
                    <span className="text-sm font-medium text-gray-700">Mesmo endereço de cobrança</span>
                  </label>
                </div>

                {!sameAddress && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">CEP</label>
                        <input
                          type="text"
                          value={formData.shipping_cep || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_cep: e.target.value })}
                          onBlur={(e) => fetchAddressByCEP(e.target.value, 'shipping')}
                          placeholder="00000-000"
                          maxLength={9}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">O endereço será preenchido automaticamente</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Endereço</label>
                        <input
                          type="text"
                          value={formData.shipping_address || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                          placeholder="Rua, Avenida..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Número</label>
                        <input
                          type="text"
                          value={formData.shipping_number || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_number: e.target.value })}
                          placeholder="123"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Complemento</label>
                        <input
                          type="text"
                          value={formData.shipping_complement || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_complement: e.target.value })}
                          placeholder="Apto, Sala..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Bairro</label>
                        <input
                          type="text"
                          value={formData.shipping_neighborhood || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_neighborhood: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Cidade</label>
                        <input
                          type="text"
                          value={formData.shipping_city || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_city: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
                        <input
                          type="text"
                          value={formData.shipping_state || ''}
                          onChange={(e) => setFormData({ ...formData, shipping_state: e.target.value })}
                          placeholder="SP"
                          maxLength={2}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end space-x-3">
              <button
                onClick={handleCancel}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors font-medium"
              >
                <Save className="w-5 h-5" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showLabelFormatSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Selecionar Formato de Etiqueta</h3>
                <p className="text-sm text-gray-600 mt-1">Escolha o formato para a etiqueta de envio</p>
              </div>
              <button
                onClick={() => {
                  setShowLabelFormatSelector(false);
                  setLabelFormats([]);
                  setSelectedFormat(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {labelFormats.map((format) => (
                <div
                  key={format.id}
                  onClick={() => setSelectedFormat(format)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${selectedFormat?.id === format.id
                    ? 'border-[#a4240e] bg-[#fff9f8]'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${selectedFormat?.id === format.id
                        ? 'border-[#a4240e] bg-[#a4240e]'
                        : 'border-gray-300'
                        }`}>
                        {selectedFormat?.id === format.id && (
                          <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{format.name}</p>
                        <p className="text-sm text-gray-600">
                          {format.width_mm}mm x {format.height_mm}mm
                          {format.format_type && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({format.format_type === 'correios' ? 'Correios' :
                                format.format_type === 'transportadora' ? 'Transportadora' :
                                  'Marketplace'})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {format.is_default && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        Padrão
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setShowLabelFormatSelector(false);
                  setLabelFormats([]);
                  setSelectedFormat(null);
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (selectedFormat && viewingHistory) {
                    generateShippingLabel(viewingHistory, selectedFormat);
                    setShowLabelFormatSelector(false);
                    setLabelFormats([]);
                    setSelectedFormat(null);
                  }
                }}
                disabled={!selectedFormat}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Package className="w-5 h-5" />
                <span>Gerar Etiqueta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingHistory && !showLabelFormatSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Histórico do Cliente</h3>
                <p className="text-sm text-gray-600 mt-1">{viewingHistory.full_name}</p>
              </div>
              <button
                onClick={() => {
                  setViewingHistory(null);
                  setCustomerStats(null);
                  setCustomerOrders([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <ShoppingBag className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">Total de Pedidos</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {customerStats?.total_orders || customerOrders.length}
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-semibold text-green-800">Total Gasto</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    R$ {Number(customerStats?.total_spent || 0).toFixed(2)}
                  </p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-semibold text-purple-800">Cliente Desde</span>
                  </div>
                  <p className="text-lg font-bold text-purple-900">
                    {new Date(viewingHistory.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-300 pt-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
                  <Package className="w-5 h-5" />
                  <span>Histórico de Pedidos</span>
                </h4>

                {customerOrders.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">Nenhum pedido realizado ainda</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customerOrders.map((order: any) => (
                      <div
                        key={order.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-bold text-gray-900">
                              Pedido #{order.order_number || order.id.slice(0, 8)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {new Date(order.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(order.created_at).toLocaleTimeString('pt-BR')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-[#a4240e]">
                              R$ {Number(order.total_amount).toFixed(2)}
                            </p>
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${order.status === 'delivered'
                                ? 'bg-green-100 text-green-700'
                                : order.status === 'shipped'
                                  ? 'bg-blue-100 text-blue-700'
                                  : order.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                            >
                              {order.status === 'delivered'
                                ? 'Entregue'
                                : order.status === 'shipped'
                                  ? 'Enviado'
                                  : order.status === 'pending'
                                    ? 'Pendente'
                                    : order.status}
                            </span>
                          </div>
                        </div>

                        {order.order_items && order.order_items.length > 0 && (
                          <div className="border-t border-gray-200 pt-3 mt-3">
                            <p className="text-sm font-semibold text-gray-700 mb-2">Itens:</p>
                            <div className="space-y-2">
                              {order.order_items.map((item: any) => (
                                <div key={item.id} className="flex items-center space-x-3 text-sm">
                                  <span className="text-gray-600">{item.quantity}x</span>
                                  <span className="text-gray-900">{item.products?.name || 'Produto'}</span>
                                  <span className="text-gray-500">
                                    - R$ {Number(item.unit_price).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {isAnniversary(viewingHistory.created_at) && (
                  <>
                    <button
                      onClick={() => handleSendAnniversaryEmail(viewingHistory)}
                      className="inline-flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <Send className="w-5 h-5" />
                      <span>Enviar Email de Aniversário</span>
                    </button>
                    <button
                      onClick={() => loadLabelFormats(viewingHistory)}
                      className="inline-flex items-center space-x-2 px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors font-medium"
                    >
                      <Package className="w-5 h-5" />
                      <span>Gerar Etiqueta de Envio</span>
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  setViewingHistory(null);
                  setCustomerStats(null);
                  setCustomerOrders([]);
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
            <p className="text-gray-600 mt-1">
              Total: {customers.length} clientes ({pfCount} PF, {pjCount} PJ)
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, email, telefone, CPF ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${filterType === 'all'
                  ? 'bg-[#a4240e] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType('PF')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${filterType === 'PF'
                  ? 'bg-[#a4240e] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Pessoa Física
              </button>
              <button
                onClick={() => setFilterType('PJ')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${filterType === 'PJ'
                  ? 'bg-[#a4240e] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Pessoa Jurídica
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Documento
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Contato
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Cadastro
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${customer.account_type === 'PJ' ? 'bg-blue-100' : 'bg-green-100'
                            }`}>
                            {customer.account_type === 'PJ' ? (
                              <Building2 className={`w-5 h-5 ${customer.account_type === 'PJ' ? 'text-blue-600' : 'text-green-600'
                                }`} />
                            ) : (
                              <User className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{customer.full_name}</p>
                            <div className="flex items-center space-x-1 text-sm text-gray-500">
                              <Mail className="w-3 h-3" />
                              <span>{customer.email}</span>
                              <button
                                onClick={() => window.open(`mailto:${customer.email}`, '_blank')}
                                className="p-1 hover:bg-gray-100 rounded-full transition-colors ml-2"
                                title="Enviar Email"
                              >
                                <Mail className="w-3 h-3 text-blue-600" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${customer.account_type === 'PJ'
                          ? 'bg-blue-100 text-blue-700'
                          : customer.account_type === 'PF'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                          }`}>
                          {customer.account_type === 'PJ' ? 'Pessoa Jurídica' : customer.account_type === 'PF' ? 'Pessoa Física' : 'Não Definido'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-900">
                          {customer.account_type === 'PJ' ? (
                            <div className="space-y-1">
                              <div className="flex items-center space-x-1">
                                <FileText className="w-3 h-3 text-gray-400" />
                                <span>CNPJ: {customer.cnpj || 'N/A'}</span>
                              </div>
                              {customer.inscricao_estadual && (
                                <div className="text-xs text-gray-500">
                                  IE: {customer.inscricao_estadual}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <FileText className="w-3 h-3 text-gray-400" />
                              <span>CPF: {customer.cpf || 'N/A'}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="space-y-1 text-sm text-gray-700">
                          {customer.celular && (
                            <div className="flex items-center space-x-2">
                              <Phone className="w-3 h-3 text-gray-400" />
                              <span>{customer.celular}</span>
                              {isCellPhone(customer.celular) && (
                                <button
                                  onClick={() => openWhatsApp(customer.celular!)}
                                  className="p-1 hover:bg-green-100 rounded-full transition-colors"
                                  title="Abrir WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4 text-green-600" />
                                </button>
                              )}
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex items-center space-x-2">
                              <Phone className="w-3 h-3 text-gray-400" />
                              <span>{customer.phone}</span>
                              {isCellPhone(customer.phone) && (
                                <button
                                  onClick={() => openWhatsApp(customer.phone!)}
                                  className="p-1 hover:bg-green-100 rounded-full transition-colors"
                                  title="Abrir WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4 text-green-600" />
                                </button>
                              )}
                            </div>
                          )}
                          {customer.account_type === 'PJ' && customer.email_xml && (
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                              <Mail className="w-3 h-3" />
                              <span>XML: {customer.email_xml}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{new Date(customer.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {customer.birth_date && (
                          <div className="text-xs text-gray-500 mt-1">
                            Nascimento: {new Date(customer.birth_date).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => loadCustomerHistory(customer)}
                            className="inline-flex items-center space-x-1 px-2 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
                            title="Ver histórico de compras"
                          >
                            <ShoppingBag className="w-4 h-4" />
                            <span>Histórico</span>
                          </button>

                          {isAnniversary(customer.created_at) && (
                            <button
                              onClick={() => handleSendAnniversaryEmail(customer)}
                              className="inline-flex items-center space-x-1 px-2 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                              title="Enviar email de aniversário"
                            >
                              <Gift className="w-4 h-4" />
                              <span>Aniversário</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleEdit(customer)}
                            className="inline-flex items-center space-x-1 px-2 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            <span>Editar</span>
                          </button>

                          <button
                            onClick={() => handleDelete(customer)}
                            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            title="Deletar cliente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
