import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany, type Company } from '../../contexts/CompanyContext';
import { Building2, Upload, Loader2, Check, Save } from 'lucide-react';

const BUCKET = 'product-images';

// Gerência das empresas (Saporino / Fazendinha): dados, logo e modelo de comissão.
export default function CompanyManagement() {
  const { companies, reloadCompanies } = useCompany();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-5">
        <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
          <Building2 className="w-5 h-5 text-[#8B2214]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Empresas</h3>
          <p className="text-sm text-gray-500">Cada empresa tem estoque, catálogo, clientes e comissão próprios. O seletor no topo troca a empresa ativa.</p>
        </div>
      </div>
      <div className="space-y-3">
        {companies.map(c => <CompanyRow key={c.id} company={c} onSaved={reloadCompanies} />)}
        {companies.length === 0 && <p className="text-sm text-gray-400">Nenhuma empresa cadastrada.</p>}
      </div>
    </div>
  );
}

function CompanyRow({ company, onSaved }: { company: Company; onSaved: () => void }) {
  const [f, setF] = useState({ ...company });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof Company, v: any) => setF(p => ({ ...p, [k]: v }));

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `companies/${company.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      set('logo_url', pub.publicUrl);
    } catch (e) { alert('Erro ao enviar logo: ' + (e instanceof Error ? e.message : e)); }
    setUploading(false);
  }

  async function save() {
    setSaving(true); setSaved(false);
    const { error } = await supabase.from('companies').update({
      name: f.name, fantasia: f.fantasia || null, cnpj: (f.cnpj || '').replace(/\D/g, '') || null,
      endereco: f.endereco || null, cidade: f.cidade || null, uf: f.uf || null, cep: f.cep || null,
      logo_url: f.logo_url || null, commission_model: f.commission_model, is_active: f.is_active,
    }).eq('id', company.id);
    setSaving(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    onSaved();
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-start gap-4">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
            {f.logo_url ? <img src={f.logo_url} alt="" className="w-full h-full object-contain" /> : <Building2 className="w-7 h-7 text-gray-300" />}
          </div>
          <label className="inline-flex items-center gap-1 text-[11px] text-[#8B2214] font-semibold cursor-pointer hover:underline">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} logo
            <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) uploadLogo(file); e.target.value = ''; }} />
          </label>
        </div>
        {/* Campos */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Razão social"><input value={f.name || ''} onChange={e => set('name', e.target.value)} className="inp" /></Field>
          <Field label="Nome fantasia"><input value={f.fantasia || ''} onChange={e => set('fantasia', e.target.value)} className="inp" /></Field>
          <Field label="CNPJ"><input value={f.cnpj || ''} onChange={e => set('cnpj', e.target.value)} className="inp" /></Field>
          <Field label="Modelo de comissão">
            <select value={f.commission_model} onChange={e => set('commission_model', e.target.value)} className="inp">
              <option value="formula">Fórmula Saporino (5% + bônus PIX/entrega, cap 8%)</option>
              <option value="flat">% fixo por representante (Fazendinha)</option>
            </select>
          </Field>
          <Field label="Endereço"><input value={f.endereco || ''} onChange={e => set('endereco', e.target.value)} className="inp" /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Cidade"><input value={f.cidade || ''} onChange={e => set('cidade', e.target.value)} className="inp" /></Field>
            <Field label="UF"><input value={f.uf || ''} onChange={e => set('uf', e.target.value)} maxLength={2} className="inp uppercase" /></Field>
            <Field label="CEP"><input value={f.cep || ''} onChange={e => set('cep', e.target.value)} className="inp" /></Field>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 mt-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 mr-auto cursor-pointer">
          <input type="checkbox" checked={f.is_active} onChange={e => set('is_active', e.target.checked)} /> Ativa (aparece no seletor)
        </label>
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
      <style>{`.inp{width:100%;border:1px solid #d1d5db;border-radius:.5rem;padding:.4rem .6rem;font-size:.8rem}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-semibold text-gray-500 mb-0.5">{label}</label>{children}</div>;
}
