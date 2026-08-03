// Formulário de cotação B2B (Para Seu Negócio). Grava em b2b_leads (insert público).
// Qualifica o lead: tipo de café, torra, grão, volume e embalagem. Admin recebe na aba Leads B2B.
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle } from 'lucide-react';

const TIPOS = ['Tradicional', 'Extra Forte', '100% Arábica', 'Café de Combate', 'Grão Expresso Gourmet'];
const TORRAS = ['Média Clara', 'Média', 'Média Escura', 'Escura'];
const EMBALAGENS = ['Fardo 5kg', 'Fardo 10kg', 'Fardo 20kg', 'Pacote 250g', 'Pacote 500g', 'Pacote 1kg', 'Pacote 5kg', 'Outra'];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
      {children}
    </button>
  );
}

export default function B2BLeadForm({ segmento }: { segmento?: string }) {
  const [f, setF] = useState({
    nome: '', empresa: '', telefone: '', email: '', site: '', redes_sociais: '', cidade: '', uf: '',
    descricao: '', formato: '', grao_tipo: '', volume_valor: '', volume_unidade: 'kg',
  });
  const [tipos, setTipos] = useState<string[]>([]);
  const [torras, setTorras] = useState<string[]>([]);
  const [embalagens, setEmbalagens] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim() || !(f.email.trim() || f.telefone.trim())) { setErr('Informe seu nome e ao menos e-mail ou telefone.'); return; }
    if (!consent) { setErr('Marque o aceite para enviarmos a proposta.'); return; }
    setSaving(true); setErr('');
    const { error } = await supabase.from('b2b_leads').insert({
      nome: f.nome.trim(), empresa: f.empresa.trim() || null, telefone: f.telefone.trim() || null,
      email: f.email.trim() || null, site: f.site.trim() || null, redes_sociais: f.redes_sociais.trim() || null,
      cidade: f.cidade.trim() || null, uf: f.uf.trim() || null,
      descricao: [segmento ? `[${segmento}]` : '', f.descricao.trim()].filter(Boolean).join(' ') || null,
      tipos_cafe: tipos.length ? tipos : null,
      formato: f.formato || null,
      torras: torras.length ? torras : null,
      grao_tipo: f.formato === 'grao' ? (f.grao_tipo || null) : null,
      volume_valor: f.volume_valor ? Number(f.volume_valor) : null,
      volume_unidade: f.volume_unidade,
      embalagens: embalagens.length ? embalagens : null,
      consent_lgpd: consent,
    });
    setSaving(false);
    if (error) { setErr('Erro ao enviar. Tente novamente ou use o e-mail acima.'); return; }
    setOk(true);
  }

  if (ok) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-green-800">Obrigado pelo seu contato! 🎉</p>
          <p className="text-xs text-green-700 mt-0.5">Recebemos suas informações e, em breve, alguém do nosso time comercial vai entrar em contato com você.</p>
        </div>
      </div>
    );
  }

  const inp = (k: keyof typeof f, ph: string, type = 'text') => (
    <input type={type} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} placeholder={ph}
      className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm font-semibold text-gray-800">Peça sua cotação</p>

      <div className="grid grid-cols-2 gap-2">
        {inp('nome', 'Nome *')}{inp('empresa', 'Empresa')}
        {inp('telefone', 'Telefone / WhatsApp')}{inp('email', 'E-mail', 'email')}
        {inp('cidade', 'Cidade')}{inp('uf', 'UF')}
        {inp('site', 'Site (opcional)')}{inp('redes_sociais', 'Redes sociais (opcional)')}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo de café</label>
        <div className="flex flex-wrap gap-1.5">
          {TIPOS.map(t => <Pill key={t} active={tipos.includes(t)} onClick={() => toggle(tipos, setTipos, t)}>{t}</Pill>)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Formato</label>
          <div className="flex gap-1.5">
            <Pill active={f.formato === 'moido'} onClick={() => setF({ ...f, formato: 'moido' })}>Moído</Pill>
            <Pill active={f.formato === 'grao'} onClick={() => setF({ ...f, formato: 'grao' })}>Grão</Pill>
          </div>
        </div>
        {f.formato === 'grao' && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Grão</label>
            <div className="flex gap-1.5">
              <Pill active={f.grao_tipo === 'arabica'} onClick={() => setF({ ...f, grao_tipo: 'arabica' })}>Arábica</Pill>
              <Pill active={f.grao_tipo === 'conilon'} onClick={() => setF({ ...f, grao_tipo: 'conilon' })}>Conilon</Pill>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Torra</label>
        <div className="flex flex-wrap gap-1.5">
          {TORRAS.map(t => <Pill key={t} active={torras.includes(t)} onClick={() => toggle(torras, setTorras, t)}>{t}</Pill>)}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Volume mensal</label>
        <div className="flex gap-2">
          <input type="number" min="0" value={f.volume_valor} onChange={e => setF({ ...f, volume_valor: e.target.value })} placeholder="Ex.: 500"
            className="flex-1 h-10 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B2214]" />
          <select value={f.volume_unidade} onChange={e => setF({ ...f, volume_unidade: e.target.value })} className="h-10 px-2 text-sm border border-gray-300 rounded-lg bg-white">
            <option value="kg">kg / mês</option>
            <option value="ton">ton / mês</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Embalagem</label>
        <div className="flex flex-wrap gap-1.5">
          {EMBALAGENS.map(t => <Pill key={t} active={embalagens.includes(t)} onClick={() => toggle(embalagens, setEmbalagens, t)}>{t}</Pill>)}
        </div>
      </div>

      <textarea value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} rows={2} placeholder="Conte o que você procura (opcional)"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B2214]" />

      <label className="flex items-start gap-2 text-[11px] text-gray-500">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 accent-[#8B2214]" />
        <span>Autorizo o contato da Café Saporino e o uso dos meus dados para elaborar a proposta (LGPD).</span>
      </label>

      {err && <p className="text-xs text-red-600">{err}</p>}
      <button type="submit" disabled={saving}
        className="w-full h-11 rounded-full bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : 'Enviar cotação'}
      </button>
    </form>
  );
}
