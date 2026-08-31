// Captação de marcas COFICO — "Quero distribuir minha marca".
// REUSA a infraestrutura de leads existente do RepCo: grava na MESMA tabela `b2b_leads`
// (insert público, policy b2b_insert_public), que já é lida pelo admin em
// B2BLeadsManagement.tsx e notificada em AdminNotificationBell.tsx. NÃO cria novo CRM.
// Marca o lead com o prefixo [COFICO — Distribuir marca] em `descricao` para o admin
// distinguir de leads de compra da Saporino. Estilo/consent próprios da COFICO.
import { useState } from 'react';
import { Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const TAG = '[COFICO — Distribuir marca]';
const CATEGORIAS = ['Café', 'Açúcar', 'Bebidas', 'Outros alimentos'];

export default function CoficoMarcaLeadForm() {
  const [f, setF] = useState({
    nome: '', empresa: '', telefone: '', email: '', cidade: '', uf: '', site: '', redes_sociais: '', descricao: '',
  });
  const [categorias, setCategorias] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');

  const toggleCat = (v: string) =>
    setCategorias(categorias.includes(v) ? categorias.filter(x => x !== v) : [...categorias, v]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim() || !f.empresa.trim()) { setErr('Informe seu nome e o nome da marca.'); return; }
    if (!(f.email.trim() || f.telefone.trim())) { setErr('Informe ao menos e-mail ou telefone.'); return; }
    if (!consent) { setErr('Marque o aceite para entrarmos em contato.'); return; }
    setSaving(true); setErr('');
    const descricao = [TAG, categorias.length ? `Categoria: ${categorias.join(', ')}.` : '', f.descricao.trim()]
      .filter(Boolean).join(' ');
    const { error } = await supabase.from('b2b_leads').insert({
      nome: f.nome.trim(),
      empresa: f.empresa.trim(),
      telefone: f.telefone.trim() || null,
      email: f.email.trim() || null,
      cidade: f.cidade.trim() || null,
      uf: f.uf.trim() || null,
      site: f.site.trim() || null,
      redes_sociais: f.redes_sociais.trim() || null,
      descricao,
      consent_lgpd: consent,
    });
    setSaving(false);
    if (error) { setErr('Erro ao enviar. Tente novamente ou fale com a gente pelos canais acima.'); return; }
    setOk(true);
  }

  if (ok) {
    return (
      <div className="border border-green-200 bg-green-50 p-5 flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-green-800">Recebemos sua proposta! 🎉</p>
          <p className="text-xs text-green-700 mt-0.5">Nosso time comercial vai analisar e entrar em contato. Obrigado pelo interesse em distribuir com a COFICO.</p>
        </div>
      </div>
    );
  }

  const inp = (k: keyof typeof f, ph: string, type = 'text') => (
    <input type={type} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} placeholder={ph}
      className="w-full h-11 px-3 text-sm border border-neutral-300 rounded-none focus:outline-none focus:ring-2 focus:ring-cofico-ink focus:border-transparent" />
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {inp('nome', 'Seu nome *')}{inp('empresa', 'Nome da marca *')}
        {inp('telefone', 'Telefone / WhatsApp')}{inp('email', 'E-mail', 'email')}
        {inp('cidade', 'Cidade')}{inp('uf', 'UF')}
        {inp('site', 'Site (opcional)')}{inp('redes_sociais', 'Instagram / redes (opcional)')}
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Categoria do produto</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS.map(c => (
            <button key={c} type="button" onClick={() => toggleCat(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${categorias.includes(c) ? 'bg-cofico-ink text-white border-cofico-ink' : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <textarea value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} rows={3}
        placeholder="Conte sobre a sua marca: o que você produz, volume aproximado, onde já vende e por que quer distribuir com a COFICO."
        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-none focus:outline-none focus:ring-2 focus:ring-cofico-ink" />

      <label className="flex items-start gap-2 text-[11px] text-neutral-500">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 accent-cofico-ink" />
        <span>Autorizo o contato da COFICO e o uso dos meus dados para avaliar a parceria de distribuição (LGPD).</span>
      </label>

      {err && <p className="text-xs text-red-600">{err}</p>}
      <button type="submit" disabled={saving}
        className="inline-flex items-center justify-center gap-2 bg-cofico-ink text-white font-semibold text-sm px-6 py-3.5 rounded-none hover:bg-cofico-dark transition-colors disabled:opacity-60">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : <>Enviar proposta <ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
      </button>
    </form>
  );
}
