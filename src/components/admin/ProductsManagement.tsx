import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Trash2, Save, X, Image as ImageIcon } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  promotional_price: number | null;
  discount_percentage: number;
  image_url: string | null;
  weight_grams: number;
  stock: number;
  is_active: boolean;
  category: string;
  featured: boolean;
  roast_type: string | null;
  flavor_notes: string | null;
  display_order: number;
}

export function ProductsManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    promotional_price: null,
    discount_percentage: 0,
    image_url: '',
    weight_grams: 500,
    stock: 0,
    is_active: true,
    category: 'café',
    featured: false,
    roast_type: '',
    flavor_notes: '',
    display_order: 0,
  });
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('url');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Sort in JS to treat 0 as "end of list"
      const sortedData = (data || []).sort((a, b) => {
        const orderA = a.display_order === 0 ? Number.MAX_SAFE_INTEGER : a.display_order;
        const orderB = b.display_order === 0 ? Number.MAX_SAFE_INTEGER : b.display_order;
        return orderA - orderB;
      });

      setProducts(sortedData);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData(product);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setFormData({
      name: '',
      description: '',
      price: 0,
      promotional_price: null,
      discount_percentage: 0,
      image_url: '',
      weight_grams: 500,
      stock: 0,
      is_active: true,
      category: 'café',
      featured: false,
      roast_type: '',
      flavor_notes: '',
    });
  };

  const handleSave = async () => {
    try {
      // 1. Prepare clean payload (prevent sending id, created_at, or NaN)
      const payload = {
        name: formData.name,
        description: formData.description,
        price: formData.price || 0,
        promotional_price: formData.promotional_price,
        discount_percentage: formData.discount_percentage || 0,
        image_url: formData.image_url,
        weight_grams: formData.weight_grams || 500,
        stock: formData.stock || 0,
        is_active: formData.is_active,
        category: formData.category || 'café',
        featured: formData.featured,
        roast_type: formData.roast_type,
        flavor_notes: formData.flavor_notes,
        display_order: Number.isNaN(Number(formData.display_order)) ? 0 : Number(formData.display_order),
      };

      if (isAdding) {
        const { data, error } = await supabase
          .from('products')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        // Reorder if needed
        if (data && payload.display_order > 0) {
          await supabase.rpc('update_product_order', {
            p_id: data.id,
            new_order: payload.display_order
          });
        }
      } else if (editingId) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;

        // Reorder if needed
        if (payload.display_order > 0) {
          await supabase.rpc('update_product_order', {
            p_id: editingId,
            new_order: payload.display_order
          });
        }
      }

      loadProducts();
      setEditingId(null);
      setIsAdding(false);
      setFormData({});
    } catch (error: any) {
      console.error('Error saving product:', error);
      alert(`Erro ao salvar: ${error.message || error.details || 'Verifique os dados'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Erro ao excluir produto');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({});
  };

  const calculateDiscount = (price: number, promoPrice: number | null) => {
    if (!promoPrice || promoPrice >= price) return 0;
    return Math.round(((price - promoPrice) / price) * 100);
  };

  const handleImageUpload = async (file: File): Promise<string | null> => {
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
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);

        if (error.message.includes('new row violates row-level security')) {
          alert('Erro: Você precisa configurar o bucket "product-images" no Supabase Storage primeiro.');
        } else {
          alert(`Erro ao fazer upload: ${error.message}`);
        }
        return null;
      }

      // Get public URL  
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
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
        <h2 className="text-3xl font-bold text-gray-900">Gerenciamento de Produtos</h2>
        <button
          onClick={handleAdd}
          className="flex items-center space-x-2 px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Adicionar Produto</span>
        </button>
      </div>

      {isAdding && (
        <div className="bg-white border-2 border-[#a4240e] rounded-xl p-6 mb-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Novo Produto</h3>
          <ProductForm
            formData={formData}
            setFormData={setFormData}
            onSave={handleSave}
            onCancel={handleCancel}
            imageMode={imageMode}
            setImageMode={setImageMode}
            uploading={uploading}
            handleImageUpload={handleImageUpload}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {products.map((product) => (
          <div
            key={product.id}
            className={`bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow ${editingId === product.id ? 'border-2 border-[#a4240e]' : 'border border-gray-200'
              }`}
          >
            {editingId === product.id ? (
              <ProductForm
                formData={formData}
                setFormData={setFormData}
                onSave={handleSave}
                onCancel={handleCancel}
                imageMode={imageMode}
                setImageMode={setImageMode}
                uploading={uploading}
                handleImageUpload={handleImageUpload}
              />
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{product.name}</h3>
                      {product.featured && (
                        <span className="px-2 py-1 bg-[#a4240e] text-white text-xs font-semibold rounded">
                          Destaque
                        </span>
                      )}
                      {!product.is_active && (
                        <span className="px-2 py-1 bg-gray-400 text-white text-xs font-semibold rounded">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                    <div className="space-y-1 text-xs text-gray-500">
                      <p>Categoria: {product.category} | Peso: {product.weight_grams}g</p>
                      {product.roast_type && <p>Torra: {product.roast_type}</p>}
                      {product.flavor_notes && <p>Notas: {product.flavor_notes}</p>}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-sm text-gray-600">Estoque: {product.stock} unidades</p>
                    {product.promotional_price ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-lg line-through text-gray-400">
                          R$ {product.price.toFixed(2)}
                        </span>
                        <span className="text-2xl font-bold text-[#a4240e]">
                          R$ {product.promotional_price.toFixed(2)}
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                          -{calculateDiscount(product.price, product.promotional_price)}%
                        </span>
                      </div>
                    ) : (
                      <p className="text-2xl font-bold text-[#a4240e]">
                        R$ {product.price.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductForm({ formData, setFormData, onSave, onCancel, imageMode, setImageMode, uploading, handleImageUpload }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Nome *</label>
          <input
            type="text"
            required
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          />
        </div>

        <div className="md:col-span-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Ordem de Exibição</label>
          <input
            type="number"
            min="0"
            value={formData.display_order || ''}
            onChange={(e) => setFormData({ ...formData, display_order: e.target.value ? parseInt(e.target.value) : 0 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
            title="Dica: Coloque 1 para aparecer em primeiro, 2 para segundo..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Categoria</label>
          <select
            value={formData.category || ''}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          >
            <option value="">Selecione...</option>
            <option value="Café em Grãos">Café em Grãos</option>
            <option value="Café Moído">Café Moído</option>
            <option value="Acessórios">Acessórios</option>
            <option value="Kit">Kit</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Descrição *</label>
        <textarea
          required
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Torra</label>
          <select
            value={formData.roast_type || ''}
            onChange={(e) => setFormData({ ...formData, roast_type: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          >
            <option value="">Selecione...</option>
            <option value="Torra clara">Torra clara</option>
            <option value="Torra média-clara">Torra média-clara</option>
            <option value="Torra média">Torra média</option>
            <option value="Torra média-escura">Torra média-escura</option>
            <option value="Torra escura">Torra escura</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Notas de Sabor</label>
          <input
            type="text"
            value={formData.flavor_notes || ''}
            onChange={(e) => setFormData({ ...formData, flavor_notes: e.target.value })}
            placeholder="Ex: Chocolate, Caramelo, Nozes"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Preço (R$) *</label>
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={formData.price || ''}
            onChange={(e) => setFormData({ ...formData, price: e.target.value ? parseFloat(e.target.value) : 0 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Preço Promocional (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.promotional_price || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                promotional_price: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Peso (gramas) *</label>
          <input
            type="number"
            required
            min="1"
            value={formData.weight_grams || ''}
            onChange={(e) => setFormData({ ...formData, weight_grams: e.target.value ? parseInt(e.target.value) : 0 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Estoque *</label>
          <input
            type="number"
            required
            min="0"
            value={formData.stock || ''}
            onChange={(e) => setFormData({ ...formData, stock: e.target.value ? parseInt(e.target.value) : 0 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
          />
        </div>

        <div className="col-span-2">
          <div className="border-2 border-gray-200 rounded-xl p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Imagem do Produto
            </label>

            {/* Mode Selection */}
            <div className="flex space-x-2 mb-4">
              <button
                type="button"
                onClick={() => setImageMode('url')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${imageMode === 'url'
                  ? 'bg-[#a4240e] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                🔗 URL
              </button>
              <button
                type="button"
                onClick={() => setImageMode('upload')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${imageMode === 'upload'
                  ? 'bg-[#a4240e] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                📤 Upload
              </button>
            </div>

            {/* URL Mode */}
            {imageMode === 'url' && (
              <div>
                <input
                  type="url"
                  value={formData.image_url || ''}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://exemplo.com/imagem-produto.png"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Cole a URL de uma imagem da internet (opcional)
                </p>
              </div>
            )}

            {/* Upload Mode */}
            {imageMode === 'upload' && (
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
                        <ImageIcon className="w-10 h-10 mb-2 text-gray-400" />
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
                        const url = await handleImageUpload(file);
                        if (url) {
                          setFormData({ ...formData, image_url: url });
                        }
                      }
                    }}
                  />
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  ⚠️ Requer bucket "product-images" configurado no Supabase
                </p>
              </div>
            )}

            {/* Preview */}
            {formData.image_url && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-2">Preview:</p>
                <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                  <img
                    src={formData.image_url}
                    alt="Preview do produto"
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = '';
                      e.currentTarget.alt = '❌ Erro ao carregar';
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, image_url: '' })}
                  className="mt-2 text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  🗑️ Remover imagem
                </button>
              </div>
            )}
          </div>
        </div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.is_active || false}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-5 h-5 text-[#a4240e] border-gray-300 rounded focus:ring-[#a4240e]"
          />
          <span className="text-sm font-medium text-gray-700">Produto Ativo</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.featured || false}
            onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
            className="w-5 h-5 text-[#a4240e] border-gray-300 rounded focus:ring-[#a4240e]"
          />
          <span className="text-sm font-medium text-gray-700">Produto em Destaque</span>
        </label>
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
