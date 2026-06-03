import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

interface Props { rep: { id: string; full_name: string; cpf: string; phone: string; cnpj: string; email?: string; commission_rate: number; has_personal_delivery: boolean; experience_start_date: string | null }; onUpdate: () => void; }

const DOC_TYPES = [
  { key: 'cnh', label: 'CNH' },
  { key: 'cpf_doc', label: 'CPF' },
  { key: 'cnpj_doc', label: 'CNPJ' },
  { key: 'core', label: 'CORE' },
  { key: 'contrato', label: 'Contrato de Representação' },
];

export function RepCoProfile({ rep, onUpdate }: Props) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  async function saveContact() {
    setSavingContact(true);
    const { error } = await supabase.rpc('repco_update_my_contact', { p_email: email, p_phone: phone });
    setSavingContact(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Contato atualizado');
    setEditing(false);
    onUpdate?.();
  }

  const handleUpload = async (docType: string, file: File) => {
    setUploading(docType);
    const path = `${user!.id}/${docType}/${file.name}`;
    const { error } = await supabase.storage.from('representative-docs').upload(path, file, { upsert: true });
    if (error) { toast.error('Erro no upload'); setUploading(null); return; }
    const { data } = supabase.storage.from('representative-docs').getPublicUrl(path);
    await supabase.from('representative_documents').insert({
      representative_id: rep.id,
      doc_type: docType,
      file_url: data.publicUrl,
      file_name: file.name,
      file_size: file.size,
    });
    setUploaded(prev => new Set([...prev, docType]));
    toast.success(`${DOC_TYPES.find(d => d.key === docType)?.label} enviado!`);
    setUploading(null);
  };

  const expDays = rep.experience_start_date
    ? Math.floor((Date.now() - new Date(rep.experience_start_date).getTime()) / 86400000)
    : null;

  return (
    <div className="space-y-8">
      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Comissão Base</p>
          <p className="text-2xl font-bold text-[#a4240e]">{rep.commission_rate}%</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Bônus PIX</p>
          <p className="text-2xl font-bold text-teal-600">+0,5%</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Bônus Entrega Pessoal</p>
          <p className="text-2xl font-bold text-purple-600">{expDays !== null && expDays >= 90 ? '+2,5%' : 'Após 90 dias'}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Tempo de Experiência</p>
          <p className="text-2xl font-bold text-gray-900">{expDays !== null ? `${expDays}d` : '—'}</p>
        </div>
      </div>

      {/* Personal data */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Dados Pessoais</h3>
          {!editing && (
            <button onClick={() => { setEmail(rep.email || ''); setPhone(rep.phone || ''); setEditing(true); }}
              className="text-sm font-medium text-[#8B2214] hover:underline">Editar contato</button>
          )}
        </div>
        {!editing ? (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Nome:</span> <span className="font-medium ml-2">{rep.full_name}</span></div>
              <div><span className="text-gray-500">CPF:</span> <span className="font-medium ml-2">{rep.cpf || '—'}</span></div>
              <div><span className="text-gray-500">WhatsApp:</span> <span className="font-medium ml-2">{rep.phone || '—'}</span></div>
              <div><span className="text-gray-500">CNPJ:</span> <span className="font-medium ml-2">{rep.cnpj || '—'}</span></div>
              <div><span className="text-gray-500">E-mail:</span> <span className="font-medium ml-2">{rep.email || '—'}</span></div>
            </div>
            <p className="text-xs text-gray-400 mt-4">Você edita seu <b>e-mail</b> e <b>WhatsApp</b>. Nome/CPF/CNPJ são alterados pelo administrador.</p>
          </>
        ) : (
          <div className="space-y-3 max-w-md">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="h-[34px] w-full rounded border border-gray-300 px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp / Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="h-[34px] w-full rounded border border-gray-300 px-3 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={saveContact} disabled={savingContact} className="rounded-lg bg-[#8B2214] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6d1a10] disabled:opacity-50">{savingContact ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Document uploads */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-bold text-gray-900 mb-2">Documentos</h3>
        <p className="text-sm text-gray-500 mb-4">Faça upload dos documentos necessários. Documentos enviados não podem ser removidos.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DOC_TYPES.map(doc => (
            <label key={doc.key}
              className={`flex items-center gap-3 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                uploaded.has(doc.key) ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-[#a4240e] hover:bg-red-50'
              }`}>
              {uploaded.has(doc.key)
                ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                : uploading === doc.key
                  ? <div className="w-5 h-5 border-2 border-[#a4240e] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  : <Upload className="w-5 h-5 text-gray-400 flex-shrink-0" />
              }
              <div>
                <p className="text-sm font-medium text-gray-900">{doc.label}</p>
                <p className="text-xs text-gray-400">PDF, JPG, PNG — máx 10MB</p>
              </div>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleUpload(doc.key, e.target.files[0]); }} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
