import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Save, X, Truck, Trash2, Image } from 'lucide-react';

interface ShippingCarrier {
  id: string;
  name: string;
  code: string;
  price_per_kg: number;
  fixed_price: number;
  delivery_time_days: number;
  is_active: boolean;
  logo_url?: string;
}

export function ShippingManagement() {
  const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<ShippingCarrier>>({
    name: '',
    code: '',
    price_per_kg: 0,
    fixed_price: 0,
    delivery_time_days: 7,
    is_active: true,
    logo_url: '',
  });
  const [logoMode, setLogoMode] = useState<'upload' | 'url'>('url');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadCarriers();
  }, []);

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
    setFormData(carrier);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setFormData({
      name: '',
      code: '',
      price_per_kg: 0,
      fixed_price: 0,
      delivery_time_days: 7,
      is_active: true,
      logo_url: '',
    });
  };

  const handleSave = async () => {
    try {
      // Validation
      if (!formData.name || formData.name.trim() === '') {
        alert('Por favor, preencha o nome da transportadora');
        return;
      }

      if (!formData.code || formData.code.trim() === '') {
        alert('Por favor, preencha o código da transportadora');
        return;
      }

      if (formData.fixed_price === undefined || formData.fixed_price < 0) {
        alert('Por favor, preencha um preço fixo válido');
        return;
      }

      if (formData.delivery_time_days === undefined || formData.delivery_time_days < 1) {
        alert('Por favor, preencha um prazo de entrega válido (mínimo 1 dia)');
        return;
      }

      // Ensure numbers are valid before saving
      const dataToSave = {
        name: formData.name.trim(),
        code: formData.code.trim().toLowerCase().replace(/\s+/g, '-'),
        price_per_kg: Number(formData.price_per_kg) || 0,
        fixed_price: Number(formData.fixed_price) || 0,
        delivery_time_days: Number(formData.delivery_time_days) || 7,
        is_active: formData.is_active !== undefined ? formData.is_active : true,
        logo_url: formData.logo_url?.trim() || null,
      };

      if (isAdding) {
        const { error } = await supabase.from('shipping_carriers').insert([dataToSave]);
        if (error) {
          // Check for duplicate code error
          if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
            alert(`Erro: Já existe uma transportadora com o código "${dataToSave.code}".Por favor, use um código diferente.`);
            return;
          }
          throw error;
        }
        alert('Transportadora adicionada com sucesso!');
      } else if (editingId) {
        const { error } = await supabase
          .from('shipping_carriers')
          .update(dataToSave)
          .eq('id', editingId);
        if (error) {
          // Check for duplicate code error
          if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
            alert(`Erro: Já existe uma transportadora com o código "${dataToSave.code}".Por favor, use um código diferente.`);
            return;
          }
          throw error;
        }
        alert('Transportadora atualizada com sucesso!');
      }

      loadCarriers();
      setEditingId(null);
      setIsAdding(false);
      setFormData({});
    } catch (error: any) {
      console.error('Error saving carrier:', error);

      // More detailed error messages
      let errorMessage = 'Erro ao salvar transportadora';

      if (error.message) {
        errorMessage += `: ${error.message} `;
      }

      if (error.hint) {
        errorMessage += `\n\nDica: ${error.hint} `;
      }

      if (error.details) {
        errorMessage += `\n\nDetalhes: ${error.details} `;
      }

      alert(errorMessage);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({});
  };

  const handleDelete = async (carrier: ShippingCarrier) => {
    const confirmMessage = `Tem certeza que deseja DELETAR a transportadora "${carrier.name}" ?\n\nEsta ação NÃO pode ser desfeita!\n\nClique OK para confirmar a exclusão.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('shipping_carriers')
        .delete()
        .eq('id', carrier.id);

      if (error) throw error;

      alert(`Transportadora "${carrier.name}" deletada com sucesso!`);
      loadCarriers();
    } catch (error: any) {
      console.error('Error deleting carrier:', error);
      alert(`Erro ao deletar transportadora: ${error.message || 'Erro desconhecido'} `);
    }
  };

  const handleLogoUpload = async (file: File): Promise<string | null> => {
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione apenas arquivos de imagem (PNG, JPEG, etc.)');
        return null;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Imagem muito grande! Tamanho máximo: 2MB');
        return null;
      }

      setUploading(true);

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('carrier-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);

        if (error.message.includes('new row violates row-level security')) {
          alert('Erro: Você precisa configurar o bucket "carrier-logos" no Supabase Storage primeiro. Veja o guia de configuração.');
        } else {
          alert(`Erro ao fazer upload: ${error.message}`);
        }
        return null;
      }

      // Get public URL  
      const { data: { publicUrl } } = supabase.storage
        .from('carrier-logos')
        .getPublicUrl(filePath);

      return publicUrl;

    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Erro ao fazer upload: ${error.message || 'Erro desconhecido'}`);
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Gerenciamento de Transportadoras</h2>
          <p className="text-gray-600">Configure as opções de envio disponíveis para seus clientes</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center space-x-2 px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Adicionar Transportadora</span>
        </button>
      </div>

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
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {carriers.map((carrier) => (
          <div
            key={carrier.id}
            className={`bg - white rounded - xl p - 6 shadow - sm hover: shadow - md transition - shadow ${editingId === carrier.id ? 'border-2 border-[#a4240e]' : 'border border-gray-200'
              } `}
          >
            {editingId === carrier.id ? (
              <CarrierForm
                formData={formData}
                setFormData={setFormData}
                onSave={handleSave}
                onCancel={handleCancel}
                logoMode={logoMode}
                setLogoMode={setLogoMode}
                uploading={uploading}
                handleLogoUpload={handleLogoUpload}
              />
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-stone-100 rounded-lg flex items-center justify-center overflow-hidden ml-4 mt-4">
                      {carrier.logo_url ? (
                        <img
                          src={carrier.logo_url}
                          alt={`${carrier.name} logo`}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            // If image fails to load, show truck icon
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<svg class="w-6 h-6 text-[#a4240e]" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="m16 8 6-2v5.5c0 .8-.7 1.5-1.5 1.5h-6.9"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
                          }}
                        />
                      ) : (
                        <Truck className="w-6 h-6 text-[#a4240e]" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{carrier.name}</h3>
                      <p className="text-sm text-gray-500">Código: {carrier.code}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {carrier.is_active ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                        Ativa
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs font-semibold rounded">
                        Inativa
                      </span>
                    )}
                    <button
                      onClick={() => handleEdit(carrier)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(carrier)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Deletar"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 px-4 border-t border-gray-200">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Preço por Kg</p>
                    <p className="text-lg font-bold text-gray-900">
                      R$ {carrier.price_per_kg.toFixed(2)}/kg
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Preço Fixo</p>
                    <p className="text-lg font-bold text-gray-900">
                      R$ {carrier.fixed_price.toFixed(2)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600 mb-1">Prazo de Entrega</p>
                    <p className="text-lg font-bold text-gray-900">
                      {carrier.delivery_time_days} dias úteis
                    </p>
                  </div>
                </div>
              </>
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

function CarrierForm({
  formData,
  setFormData,
  onSave,
  onCancel,
  logoMode,
  setLogoMode,
  uploading,
  handleLogoUpload
}: any) {
  return (
    <div className="space-y-4 px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Nome *</label>
          <input
            type="text"
            required
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Correios PAC"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Código *</label>
          <input
            type="text"
            required
            value={formData.code || ''}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="Ex: correios-pac"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          />
        </div>
      </div>

      {/* Hybrid Logo System */}
      <div className="border-2 border-gray-200 rounded-xl p-4">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Logo da Transportadora
        </label>

        {/* Mode Selection */}
        <div className="flex space-x-2 mb-4">
          <button
            type="button"
            onClick={() => setLogoMode('url')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${logoMode === 'url'
              ? 'bg-[#a4240e] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            🔗 URL
          </button>
          <button
            type="button"
            onClick={() => setLogoMode('upload')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${logoMode === 'upload'
              ? 'bg-[#a4240e] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            📤 Upload
          </button>
        </div>

        {/* URL Mode */}
        {logoMode === 'url' && (
          <div>
            <input
              type="url"
              value={formData.logo_url || ''}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              placeholder="https://exemplo.com/logo-transportadora.png"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Cole a URL de uma imagem da internet (opcional)
            </p>
          </div>
        )}

        {/* Upload Mode */}
        {logoMode === 'upload' && (
          <div>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a4240e] mb-2"></div>
                    <p className="text-sm text-gray-600">Fazendo upload...</p>
                  </>
                ) : (
                  <>
                    <Image className="w-10 h-10 mb-2 text-gray-400" />
                    <p className="mb-1 text-sm text-gray-600">
                      <span className="font-semibold">Clique para selecionar</span> ou arraste
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPEG (Max: 2MB)</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleLogoUpload(file);
                    if (url) {
                      setFormData({ ...formData, logo_url: url });
                    }
                  }
                }}
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              ⚠️ Requer bucket "carrier-logos" configurado no Supabase
            </p>
          </div>
        )}

        {/* Preview */}
        {formData.logo_url && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-2">Preview:</p>
            <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center border border-gray-200">
              <img
                src={formData.logo_url}
                alt="Preview do logo"
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = '';
                  e.currentTarget.alt = '❌ Erro ao carregar';
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, logo_url: '' })}
              className="mt-2 text-xs text-red-600 hover:text-red-800 font-medium"
            >
              🗑️ Remover logo
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Preço por Kg (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.price_per_kg || 0}
            onChange={(e) => {
              const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
              setFormData({ ...formData, price_per_kg: isNaN(value) ? 0 : value });
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Deixe 0 para não usar</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Preço Fixo (R$) *
          </label>
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={formData.fixed_price || 0}
            onChange={(e) => {
              const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
              setFormData({ ...formData, fixed_price: isNaN(value) ? 0 : value });
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Prazo (dias úteis) *
          </label>
          <input
            type="number"
            required
            min="1"
            value={formData.delivery_time_days || 7}
            onChange={(e) => {
              const value = e.target.value === '' ? 7 : parseInt(e.target.value);
              setFormData({ ...formData, delivery_time_days: isNaN(value) ? 7 : value });
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={formData.is_active || false}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          className="w-5 h-5 text-[#a4240e] border-gray-300 rounded focus:ring-[#a4240e]"
        />
        <span className="text-sm font-medium text-gray-700">Transportadora Ativa</span>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Cálculo do Frete:</strong> O valor final será{' '}
          <strong>Preço Fixo + (Peso em Kg × Preço por Kg)</strong>
        </p>
      </div>

      <div className="flex items-center space-x-3 pt-4">
        <button
          onClick={onSave}
          className="flex items-center space-x-2 px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors"
        >
          <Save className="w-5 h-5" />
          <span>Salvar</span>
        </button>
        <button
          onClick={onCancel}
          className="flex items-center space-x-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
          <span>Cancelar</span>
        </button>
      </div>
    </div>
  );
}
