import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Save, X, Truck, Trash2, Image, Key, Globe, ChevronDown, ChevronUp } from 'lucide-react';

interface ShippingCarrier {
  id: string;
  name: string;
  code: string;
  price_per_kg: number;
  fixed_price: number;
  delivery_time_days: number;
  is_active: boolean;
  logo_url?: string;
  api_type: string;
  api_endpoint?: string;
  api_key?: string;
  api_username?: string;
  api_password?: string;
  integration_notes?: string;
}

const API_TYPE_LABELS: Record<string, { label: string; badge: string; color: string }> = {
  manual: { label: 'Manual (sem API)', badge: 'Manual', color: 'bg-gray-100 text-gray-600' },
  bbm: { label: 'BBM Logística', badge: 'BBM API', color: 'bg-blue-100 text-blue-700' },
  jadlog: { label: 'Jadlog', badge: 'Jadlog API', color: 'bg-red-100 text-red-700' },
  total_express: { label: 'Total Express', badge: 'Total Express API', color: 'bg-purple-100 text-purple-700' },
  custom: { label: 'API Personalizada', badge: 'Custom API', color: 'bg-green-100 text-green-700' },
};

const emptyForm: Partial<ShippingCarrier> = {
  name: '', code: '',
  price_per_kg: 0, fixed_price: 0, delivery_time_days: 5,
  is_active: true, logo_url: '',
  api_type: 'manual', api_endpoint: '', api_key: '',
  api_username: '', api_password: '', integration_notes: '',
};

export function ShippingManagement() {
  const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<ShippingCarrier>>(emptyForm);
  const [logoMode, setLogoMode] = useState<'upload' | 'url'>('url');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'api'>('general');

  useEffect(() => { loadCarriers(); }, []);

  const loadCarriers = async () => {
    try {
      const { data, error } = await supabase
        .from('shipping_carriers')
        .select('*')
        .order('name');
      if (error) throw error;
      setCarriers(data || []);
    } catch (error) {
      console.error('Error loading carriers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (carrier: ShippingCarrier) => {
    setEditingId(carrier.id);
    setFormData({ ...carrier });
    setActiveTab('general');
  };

  const handleAdd = () => {
    setIsAdding(true);
    setFormData({ ...emptyForm });
    setActiveTab('general');
  };

  const handleSave = async () => {
    try {
      if (!formData.name?.trim()) { alert('Preencha o nome da transportadora'); return; }
      if (!formData.code?.trim()) { alert('Preencha o código da transportadora'); return; }

      const dataToSave = {
        name: formData.name.trim(),
        code: formData.code.trim().toLowerCase().replace(/\s+/g, '-'),
        price_per_kg: Number(formData.price_per_kg) || 0,
        fixed_price: Number(formData.fixed_price) || 0,
        delivery_time_days: Number(formData.delivery_time_days) || 5,
        is_active: formData.is_active ?? true,
        logo_url: formData.logo_url?.trim() || null,
        api_type: formData.api_type || 'manual',
        api_endpoint: formData.api_endpoint?.trim() || null,
        api_key: formData.api_key?.trim() || null,
        api_username: formData.api_username?.trim() || null,
        api_password: formData.api_password?.trim() || null,
        integration_notes: formData.integration_notes?.trim() || null,
      };

      if (isAdding) {
        const { error } = await supabase.from('shipping_carriers').insert([dataToSave]);
        if (error) {
          if (error.message.includes('duplicate') || error.message.includes('unique')) {
            alert(`Código "${dataToSave.code}" já existe. Use um código diferente.`);
            return;
          }
          throw error;
        }
        alert('Transportadora adicionada!');
      } else if (editingId) {
        const { error } = await supabase.from('shipping_carriers').update(dataToSave).eq('id', editingId);
        if (error) throw error;
        alert('Transportadora atualizada!');
      }

      loadCarriers();
      setEditingId(null);
      setIsAdding(false);
      setFormData({});
    } catch (error: any) {
      alert(`Erro ao salvar: ${error.message}`);
    }
  };

  const handleCancel = () => { setEditingId(null); setIsAdding(false); setFormData({}); };

  const handleDelete = async (carrier: ShippingCarrier) => {
    if (!confirm(`Deletar "${carrier.name}"?\n\nEsta ação não pode ser desfeita!`)) return;
    try {
      const { error } = await supabase.from('shipping_carriers').delete().eq('id', carrier.id);
      if (error) throw error;
      alert(`"${carrier.name}" deletada.`);
      loadCarriers();
    } catch (error: any) {
      alert(`Erro ao deletar: ${error.message}`);
    }
  };

  const handleLogoUpload = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) { alert('Selecione um arquivo de imagem'); return null; }
    if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande! Máx: 2MB'); return null; }
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error } = await supabase.storage.from('carrier-logos').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (error) { alert(`Erro no upload: ${error.message}`); return null; }
      const { data: { publicUrl } } = supabase.storage.from('carrier-logos').getPublicUrl(fileName);
      return publicUrl;
    } catch (error: any) {
      alert(`Erro no upload: ${error.message}`);
      return null;
    } finally {
      setUploading(false);
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Transportadoras</h2>
          <p className="text-gray-600">Gerencie as opções de envio e integrações de API</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center space-x-2 px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Adicionar Transportadora</span>
        </button>
      </div>

      {/* API Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
        <Key className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Sistema Pronto para Integração via API</p>
          <p className="text-sm text-blue-700 mt-1">
            As transportadoras cadastradas podem ser integradas via API. Os campos de API Key, Endpoint e credenciais
            ficam armazenados com segurança. Quando o TI da transportadora fornecer as credenciais, basta editar e preencher.
          </p>
        </div>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="bg-white border-2 border-[#a4240e] rounded-xl p-6 mb-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Nova Transportadora</h3>
          <CarrierForm
            formData={formData}
            setFormData={setFormData}
            onSave={handleSave}
            onCancel={handleCancel}
            logoMode={logoMode}
            setLogoMode={setLogoMode}
            uploading={uploading}
            handleLogoUpload={handleLogoUpload}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </div>
      )}

      {/* Carrier Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {carriers.map((carrier) => (
          <div key={carrier.id} className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow ${editingId === carrier.id ? 'border-2 border-[#a4240e]' : 'border border-gray-200'}`}>
            {editingId === carrier.id ? (
              <div className="p-6">
                <CarrierForm
                  formData={formData}
                  setFormData={setFormData}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  logoMode={logoMode}
                  setLogoMode={setLogoMode}
                  uploading={uploading}
                  handleLogoUpload={handleLogoUpload}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              </div>
            ) : (
              <div className="p-5">
                {/* Card Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-14 h-14 bg-stone-50 rounded-xl flex items-center justify-center border border-gray-100 overflow-hidden flex-shrink-0">
                      {carrier.logo_url ? (
                        <img
                          src={carrier.logo_url}
                          alt={`${carrier.name} logo`}
                          className="w-full h-full object-contain p-1"
                          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="16" height="13" x="1" y="3" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>'; }}
                        />
                      ) : (
                        <Truck className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{carrier.name}</h3>
                      <p className="text-xs text-gray-500 font-mono">#{carrier.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => handleEdit(carrier)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(carrier)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Deletar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Status badges */}
                <div className="flex items-center space-x-2 mt-4">
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${carrier.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {carrier.is_active ? '● Ativa' : '○ Inativa'}
                  </span>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${(API_TYPE_LABELS[carrier.api_type] || API_TYPE_LABELS.manual).color}`}>
                    {(API_TYPE_LABELS[carrier.api_type] || API_TYPE_LABELS.manual).badge}
                  </span>
                  {carrier.api_type !== 'manual' && (
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full flex items-center space-x-1 ${carrier.api_key ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      <Key className="w-3 h-3" />
                      <span>{carrier.api_key ? 'API Configurada' : 'Aguardando Credenciais'}</span>
                    </span>
                  )}
                </div>

                {/* Integration notes */}
                {carrier.integration_notes && (
                  <p className="text-xs text-gray-500 mt-3 bg-gray-50 rounded-lg p-2 border border-gray-100">
                    📝 {carrier.integration_notes}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {carriers.length === 0 && (
        <div className="text-center py-20">
          <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Nenhuma transportadora cadastrada</p>
        </div>
      )}
    </div>
  );
}

function CarrierForm({ formData, setFormData, onSave, onCancel, logoMode, setLogoMode, uploading, handleLogoUpload, activeTab, setActiveTab }: any) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md font-medium text-sm transition-all ${activeTab === 'general' ? 'bg-white text-[#a4240e] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Truck className="w-4 h-4" />
          <span>Configuração Geral</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('api')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md font-medium text-sm transition-all ${activeTab === 'api' ? 'bg-white text-[#a4240e] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Key className="w-4 h-4" />
          <span>Integração API</span>
        </button>
      </div>

      {/* GENERAL TAB */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome *</label>
              <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Jadlog" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Código *</label>
              <input type="text" value={formData.code || ''} onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ex: jadlog" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
            </div>
          </div>

          {/* Logo */}
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Logo da Transportadora</label>
            <div className="flex space-x-2 mb-4">
              <button type="button" onClick={() => setLogoMode('url')}
                className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${logoMode === 'url' ? 'bg-[#a4240e] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                🔗 URL
              </button>
              <button type="button" onClick={() => setLogoMode('upload')}
                className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${logoMode === 'upload' ? 'bg-[#a4240e] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                📤 Upload
              </button>
            </div>

            {logoMode === 'url' && (
              <input type="url" value={formData.logo_url || ''} onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                placeholder="https://exemplo.com/logo.png"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
            )}

            {logoMode === 'upload' && (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                {uploading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a4240e]"></div>
                ) : (
                  <><Image className="w-8 h-8 mb-1 text-gray-400" /><p className="text-xs text-gray-500">Clique para selecionar (máx: 2MB)</p></>
                )}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) { const url = await handleLogoUpload(file); if (url) setFormData({ ...formData, logo_url: url }); }
                  }} />
              </label>
            )}

            {formData.logo_url && (
              <div className="mt-3 flex items-center space-x-3">
                <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                  <img src={formData.logo_url} alt="Preview" className="max-w-full max-h-full object-contain p-1"
                    onError={(e) => { e.currentTarget.src = ''; e.currentTarget.alt = '❌'; }} />
                </div>
                <button type="button" onClick={() => setFormData({ ...formData, logo_url: '' })}
                  className="text-xs text-red-600 hover:text-red-800 font-medium">🗑️ Remover</button>
              </div>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center space-x-2">
            <input type="checkbox" checked={formData.is_active ?? true}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-5 h-5 text-[#a4240e] border-gray-300 rounded focus:ring-[#a4240e]" />
            <span className="text-sm font-medium text-gray-700">Transportadora Ativa</span>
          </div>
        </div>
      )}

      {/* API TAB */}
      {activeTab === 'api' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>⚙️ Integração API:</strong> Preencha quando o TI da transportadora fornecer as credenciais.
              O site já está pronto para usar esses dados automaticamente no cálculo de frete.
            </p>
          </div>

          {/* API Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Integração</label>
            <select value={formData.api_type || 'manual'} onChange={(e) => setFormData({ ...formData, api_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent bg-white">
              <option value="manual">Manual (sem API)</option>
              <option value="bbm">BBM Logística</option>
              <option value="jadlog">Jadlog</option>
              <option value="total_express">Total Express</option>
              <option value="custom">API Personalizada</option>
            </select>
          </div>

          {/* API Endpoint */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center space-x-1">
              <Globe className="w-4 h-4" />
              <span>Endpoint da API</span>
            </label>
            <input type="url" value={formData.api_endpoint || ''} onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
              placeholder="https://api.transportadora.com.br/"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent font-mono text-sm" />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center space-x-1">
              <Key className="w-4 h-4" />
              <span>API Key / Token</span>
            </label>
            <input type="text" value={formData.api_key || ''} onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              placeholder="Token ou chave de autenticação"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent font-mono text-sm" />
          </div>

          {/* Username / Password */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Usuário</label>
              <input type="text" value={formData.api_username || ''} onChange={(e) => setFormData({ ...formData, api_username: e.target.value })}
                placeholder="Usuário da API"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={formData.api_password || ''}
                  onChange={(e) => setFormData({ ...formData, api_password: e.target.value })}
                  placeholder="Senha da API"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notas de Integração</label>
            <textarea value={formData.integration_notes || ''} onChange={(e) => setFormData({ ...formData, integration_notes: e.target.value })}
              placeholder="Ex: Solicitar credenciais ao TI da BBM — contrato nº 12345"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent resize-none" />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center space-x-3 pt-2 border-t border-gray-100">
        <button onClick={onSave}
          className="flex items-center space-x-2 px-6 py-2.5 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors font-medium">
          <Save className="w-4 h-4" />
          <span>Salvar</span>
        </button>
        <button onClick={onCancel}
          className="flex items-center space-x-2 px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium">
          <X className="w-4 h-4" />
          <span>Cancelar</span>
        </button>
      </div>
    </div>
  );
}
