import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Building2, Phone, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface Client { id: string; cnpj: string; razao_social: string; nome_comprador: string; whatsapp_comprador: string; email_comprador: string; forma_pagamento: string; limite_credito: number; status: string; }
interface Props { repId: string; }

const emptyForm = { cnpj: '', razao_social: '', nome_fantasia: '', email_comprador: '', email_xml: '', nome_comprador: '', whatsapp_comprador: '', prazo_pagamento: '', forma_pagamento: 'a_vista', limite_credito: '' };

export function RepCoClients({ repId }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchClients(); }, [repId]);

  const fetchClients = async () => {
    const { data } = await supabase.from('representative_clients').select('*').eq('representative_id', repId).order('created_at', { ascending: false });
    setClients(data || []);
  };

  const lookupCNPJ = async (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return;
    setLookingUp(true);
    try {
      const res = await fetch(`https://publica.cnpj.ws/cnpj/${clean}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForm(f => ({
        ...f,
        razao_social: data.razao_social || '',
        nome_fantasia: data.estabelecimento?.nome_fantasia || '',
        endereco: `${data.estabelecimento?.logradouro || ''}, ${data.estabelecimento?.numero || ''} - ${data.estabelecimento?.bairro || ''}, ${data.estabelecimento?.cidade?.nome || ''}/${data.estabelecimento?.estado?.sigla || ''}`,
      }));
      toast.success('Dados da Receita Federal carregados!');
    } catch {
      toast.error('CNPJ não encontrado na Receita Federal');
    }
    setLookingUp(false);
  };

  const handleSave = async () => {
    if (!form.cnpj || !form.razao_social) { toast.error('CNPJ e Razão Social são obrigatórios'); return; }
    setSaving(true);
    const { error } = await supabase.from('representative_clients').insert({
      representative_id: repId,
      cnpj: form.cnpj.replace(/\D/g, ''),
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia,
      email_comprador: form.email_comprador,
      email_xml: form.email_xml,
      nome_comprador: form.nome_comprador,
      whatsapp_comprador: form.whatsapp_comprador,
      prazo_pagamento: form.prazo_pagamento,
      forma_pagamento: form.forma_pagamento,
      limite_credito: parseFloat(form.limite_credito || '0'),
    });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Cliente cadastrado!');
    setForm(emptyForm);
    setShowForm(false);
    fetchClients();
  };

  const filtered = clients.filter(c =>
    c.razao_social?.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj?.includes(search) ||
    c.nome_comprador?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Meus Clientes</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#a4240e] text-white text-sm font-semibold rounded-xl hover:bg-[#8a1f0c] transition-colors">
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900">Cadastrar Cliente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">CNPJ *</label>
              <div className="flex gap-2">
                <input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00"
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
                <button onClick={() => lookupCNPJ(form.cnpj)} disabled={lookingUp}
                  className="px-4 py-2.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-60">
                  {lookingUp ? '...' : 'Buscar'}
                </button>
              </div>
            </div>
            {[
              { key: 'razao_social', label: 'Razão Social *', col: 2 },
              { key: 'nome_comprador', label: 'Nome do Comprador', col: 1 },
              { key: 'whatsapp_comprador', label: 'WhatsApp Comprador', col: 1 },
              { key: 'email_comprador', label: 'Email Comprador', col: 1 },
              { key: 'email_xml', label: 'Email XML (NF-e)', col: 1 },
              { key: 'prazo_pagamento', label: 'Prazo de Pagamento', col: 1 },
              { key: 'limite_credito', label: 'Limite de Crédito (R$)', col: 1 },
            ].map(({ key, label, col }) => (
              <div key={key} className={col === 2 ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Forma de Pagamento</label>
              <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#a4240e] focus:border-transparent">
                <option value="a_vista">À Vista</option>
                <option value="boleto">Boleto</option>
                <option value="pix">PIX</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 bg-[#a4240e] text-white text-sm font-semibold rounded-xl hover:bg-[#8a1f0c] transition-colors disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar Cliente'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, CNPJ ou comprador..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#a4240e] focus:border-transparent" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>Nenhum cliente encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{c.razao_social}</p>
                    <p className="text-xs text-gray-500">CNPJ: {c.cnpj}</p>
                  </div>
                </div>
                {expandedId === c.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {expandedId === c.id && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Comprador:</span> <span className="font-medium ml-1">{c.nome_comprador || '—'}</span></div>
                  <div className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" />{c.whatsapp_comprador || '—'}</div>
                  <div className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-gray-400" />{c.email_comprador || '—'}</div>
                  <div><span className="text-gray-500">Pagamento:</span> <span className="font-medium ml-1 capitalize">{c.forma_pagamento?.replace('_', ' ')}</span></div>
                  <div><span className="text-gray-500">Limite:</span> <span className="font-medium ml-1">R$ {c.limite_credito?.toFixed(2)}</span></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
