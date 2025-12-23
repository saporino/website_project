import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Store, MapPin, CreditCard, Eye, EyeOff } from 'lucide-react';

interface Settings {
  id: string;
  store_name: string;
  store_cnpj: string;
  store_email: string;
  store_phone: string;
  sender_name: string;
  sender_street: string;
  sender_number: string;
  sender_complement: string;
  sender_neighborhood: string;
  sender_city: string;
  sender_state: string;
  sender_cep: string;
  mercado_pago_access_token: string;
  mercado_pago_public_key: string;
}

export function StoreSettings() {
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings.id) {
        const { error } = await supabase
          .from('admin_settings')
          .update(settings)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('admin_settings')
          .insert([settings]);
        if (error) throw error;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      loadSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#a4240e]"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Configurações da Loja</h2>
        <p className="text-gray-600">Gerencie as informações da sua loja e integrações</p>
      </div>

      <div className="space-y-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
              <Store className="w-5 h-5 text-[#a4240e]" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Informações da Loja</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nome da Loja</label>
              <input
                type="text"
                value={settings.store_name || ''}
                onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">CNPJ</label>
              <input
                type="text"
                value={settings.store_cnpj || ''}
                onChange={(e) => setSettings({ ...settings, store_cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">E-mail</label>
              <input
                type="email"
                value={settings.store_email || ''}
                onChange={(e) => setSettings({ ...settings, store_email: e.target.value })}
                placeholder="sac@cafesaporino.com.br"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Telefone</label>
              <input
                type="tel"
                value={settings.store_phone || ''}
                onChange={(e) => setSettings({ ...settings, store_phone: e.target.value })}
                placeholder="+55 (11) 91771-9798"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-[#a4240e]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Endereço do Remetente</h3>
              <p className="text-sm text-gray-600">Usado nas etiquetas de envio</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome do Remetente
              </label>
              <input
                type="text"
                value={settings.sender_name || ''}
                onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                placeholder="Café Saporino"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">CEP</label>
              <input
                type="text"
                value={settings.sender_cep || ''}
                onChange={(e) => setSettings({ ...settings, sender_cep: e.target.value })}
                placeholder="06454-000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Rua</label>
              <input
                type="text"
                value={settings.sender_street || ''}
                onChange={(e) => setSettings({ ...settings, sender_street: e.target.value })}
                placeholder="Al. Rio Negro"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Número</label>
              <input
                type="text"
                value={settings.sender_number || ''}
                onChange={(e) => setSettings({ ...settings, sender_number: e.target.value })}
                placeholder="503"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Complemento</label>
              <input
                type="text"
                value={settings.sender_complement || ''}
                onChange={(e) => setSettings({ ...settings, sender_complement: e.target.value })}
                placeholder="Sala 2005"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Bairro</label>
              <input
                type="text"
                value={settings.sender_neighborhood || ''}
                onChange={(e) => setSettings({ ...settings, sender_neighborhood: e.target.value })}
                placeholder="Alphaville Industrial"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Cidade</label>
              <input
                type="text"
                value={settings.sender_city || ''}
                onChange={(e) => setSettings({ ...settings, sender_city: e.target.value })}
                placeholder="Barueri"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estado (UF)</label>
              <input
                type="text"
                value={settings.sender_state || ''}
                onChange={(e) => setSettings({ ...settings, sender_state: e.target.value })}
                placeholder="SP"
                maxLength={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[#a4240e]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Integração Mercado Pago</h3>
              <p className="text-sm text-gray-600">Configure suas credenciais de pagamento</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Access Token (Chave Privada)
              </label>
              <div className="relative">
                <input
                  type={showAccessToken ? "text" : "password"}
                  value={settings.mercado_pago_access_token || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, mercado_pago_access_token: e.target.value })
                  }
                  placeholder="TEST-..."
                  className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowAccessToken(!showAccessToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  title={showAccessToken ? "Ocultar token" : "Mostrar token"}
                >
                  {showAccessToken ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Public Key (Chave Pública)
              </label>
              <input
                type="text"
                value={settings.mercado_pago_public_key || ''}
                onChange={(e) =>
                  setSettings({ ...settings, mercado_pago_public_key: e.target.value })
                }
                placeholder="APP_USR-..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Como obter suas credenciais:</strong>
                <br />
                1. Acesse{' '}
                <a
                  href="https://www.mercadopago.com.br/developers/panel"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold"
                >
                  Mercado Pago Developers
                </a>
                <br />
                2. Entre com sua conta PJ
                <br />
                3. Vá em "Suas integrações" → "Credenciais"
                <br />
                4. Copie o Access Token e Public Key de Produção
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-8 py-4 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors disabled:bg-gray-400"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
          </button>

          {saved && (
            <div className="flex items-center space-x-2 text-green-600 font-medium">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                ✓
              </div>
              <span>Configurações salvas com sucesso!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
