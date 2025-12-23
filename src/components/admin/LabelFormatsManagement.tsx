import { useState, useEffect } from 'react';
import { Tag, Plus, Edit, Trash2, Save, X, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface LabelFormat {
  id: string;
  name: string;
  code: string;
  width_mm: number;
  height_mm: number;
  format_type: 'correios' | 'transportadora' | 'marketplace';
  is_active: boolean;
  is_default: boolean;
  notes?: string;
}

export const LabelFormatsManagement = () => {
  const [formats, setFormats] = useState<LabelFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFormat, setEditingFormat] = useState<LabelFormat | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<LabelFormat>>({
    name: '',
    code: '',
    width_mm: 100,
    height_mm: 150,
    format_type: 'transportadora',
    is_active: true,
    is_default: false,
  });

  useEffect(() => {
    loadFormats();
  }, []);

  const loadFormats = async () => {
    try {
      const { data, error } = await supabase
        .from('label_formats')
        .select('*')
        .order('format_type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setFormats(data || []);
    } catch (error) {
      console.error('Error loading formats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingFormat) {
        const { error } = await supabase
          .from('label_formats')
          .update({
            name: formData.name,
            width_mm: formData.width_mm,
            height_mm: formData.height_mm,
            format_type: formData.format_type,
            is_active: formData.is_active,
            notes: formData.notes,
          })
          .eq('id', editingFormat.id);

        if (error) throw error;
        alert('Formato atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('label_formats')
          .insert({
            name: formData.name,
            code: formData.code?.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            width_mm: formData.width_mm,
            height_mm: formData.height_mm,
            format_type: formData.format_type,
            is_active: formData.is_active,
            is_default: formData.is_default,
            notes: formData.notes,
          });

        if (error) throw error;
        alert('Formato criado com sucesso!');
      }

      setEditingFormat(null);
      setIsCreating(false);
      setFormData({
        name: '',
        code: '',
        width_mm: 100,
        height_mm: 150,
        format_type: 'transportadora',
        is_active: true,
        is_default: false,
      });
      loadFormats();
    } catch (error) {
      console.error('Error saving format:', error);
      alert('Erro ao salvar formato');
    }
  };

  const handleDelete = async (format: LabelFormat) => {
    if (!confirm(`Tem certeza que deseja excluir "${format.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('label_formats')
        .delete()
        .eq('id', format.id);

      if (error) throw error;
      alert('Formato excluído com sucesso!');
      loadFormats();
    } catch (error) {
      console.error('Error deleting format:', error);
      alert('Erro ao excluir formato');
    }
  };

  const handleEdit = (format: LabelFormat) => {
    setEditingFormat(format);
    setFormData(format);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingFormat(null);
    setFormData({
      name: '',
      code: '',
      width_mm: 100,
      height_mm: 150,
      format_type: 'transportadora',
      is_active: true,
      is_default: false,
    });
  };

  const handleCancel = () => {
    setEditingFormat(null);
    setIsCreating(false);
    setFormData({
      name: '',
      code: '',
      width_mm: 100,
      height_mm: 150,
      format_type: 'transportadora',
      is_active: true,
      is_default: false,
    });
  };

  const getFormatTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      correios: 'Correios',
      transportadora: 'Transportadora',
      marketplace: 'Marketplace',
    };
    return labels[type] || type;
  };

  const getFormatTypeBadge = (type: string) => {
    const colors: { [key: string]: string } = {
      correios: 'bg-blue-100 text-blue-700',
      transportadora: 'bg-green-100 text-green-700',
      marketplace: 'bg-purple-100 text-purple-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a4240e]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Formatos de Etiquetas</h2>
          <p className="text-gray-600 mt-1">
            Gerencie os formatos de etiquetas para diferentes transportadoras e marketplaces
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          <span>Adicionar Formato</span>
        </button>
      </div>

      {(editingFormat || isCreating) && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {editingFormat ? 'Editar Formato' : 'Novo Formato'}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Jadlog, Total Express"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            {!editingFormat && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Ex: jadlog, total_express"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Largura (mm) *
              </label>
              <input
                type="number"
                value={formData.width_mm || 100}
                onChange={(e) => setFormData({ ...formData, width_mm: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Altura (mm) *
              </label>
              <input
                type="number"
                value={formData.height_mm || 150}
                onChange={(e) => setFormData({ ...formData, height_mm: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo *
              </label>
              <select
                value={formData.format_type || 'transportadora'}
                onChange={(e) => setFormData({ ...formData, format_type: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              >
                <option value="correios">Correios</option>
                <option value="transportadora">Transportadora</option>
                <option value="marketplace">Marketplace</option>
              </select>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_active || false}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-[#a4240e] rounded focus:ring-[#a4240e]"
                />
                <span className="text-sm font-medium text-gray-700">Ativo</span>
              </label>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a4240e] focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 mt-6">
            <button
              onClick={handleCancel}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-[#a4240e] text-white rounded-lg hover:bg-[#8a1f0c] transition-colors font-medium"
            >
              <Save className="w-5 h-5" />
              <span>Salvar</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Nome</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tipo</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Dimensões</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {formats.map((format) => (
              <tr key={format.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <Package className="w-5 h-5 text-gray-400" />
                    <span className="font-medium text-gray-900">{format.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getFormatTypeBadge(format.format_type)}`}>
                    {getFormatTypeLabel(format.format_type)}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {format.width_mm}mm x {format.height_mm}mm
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    format.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {format.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleEdit(format)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(format)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
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
    </div>
  );
};
