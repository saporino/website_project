// Formulário de candidatura a Representante Saporino. Grava em candidaturas_representante
// (insert público, status 'pendente'). Admin recebe na aba "Candidaturas" + sininho.
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle } from 'lucide-react';

const EXPERIENCIA = ['Menos de 1 ano', '1 a 3 anos', '3 a 5 anos', 'Mais de 5 anos'];
const CANAIS = ['Supermercado', 'Padaria', 'Food Service', 'Atacado', 'Mercearia', 'Outro'];
const SITUACAO = ['CPF com CORE ativo', 'CNPJ regular (MEI não habilitado)'];

export default function RepApplicationForm() {
  const [f, setF] = useState({
    nome_completo: '', whatsapp: '', cidade_regiao: '', experiencia: '',
    carteira_ativa: '', clientes_aprox: '', situacao_cadastral: '', marcas_atuais: '',
  });
  const [canais, setCanais] = useState<string[]>([]);
  const [ciente, setCiente] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');

  const toggleCanal = (v: string) => setCanais(c => c.includes(v) ? c.filter(x => x !== v) : [...c, v]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome_completo.trim() || !f.whatsapp.trim()) { setErr('Informe seu nome e WhatsApp.'); return; }
    if (!ciente) { setErr('Confirme que está ciente das condições para enviar.'); return; }
    setSaving(true); setErr('');
    const { error } = await supabase.from('candidaturas_representante').insert({
      nome_completo: f.nome_completo.trim(),
      whatsapp: f.whatsapp.trim(),
      cidade_regiao: f.cidade_regiao.trim() || null,
      experiencia: f.experiencia || null,
      carteira_ativa: f.carteira_ativa === '' ? null : f.carteira_ativa === 'sim',
      clientes_aprox: f.clientes_aprox.trim() || null,
      canais: canais.length ? canais : null,
      situacao_cadastral: f.situacao_cadastral || null,
      marcas_atuais: f.marcas_atuais.trim() || null,
      ciente_condicoes: ciente,
    });
    setSaving(false);
    if (error) { setErr('Erro ao enviar. Tente novamente.'); return; }
    setOk(true);
  }

  if (ok) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 flex items-start gap-3">
        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-base font-semibold text-green-800">Candidatura enviada! 🎉</p>
          <p className="text-sm text-green-700 mt-1">Recebemos seus dados. Nossa equipe comercial vai analisar seu perfil e, se houver aderência, entramos em contato pelo seu WhatsApp para a próxima etapa.</p>
        </div>
      </div>
    );
  }

  const inp = (k: keyof typeof f, ph: string, type = 'text') => (
    <input type={type} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} placeholder={ph}
      className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B2214] focus:border-transparent" />
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      {inp('nome_completo', 'Nome completo *')}
      {inp('whatsapp', 'WhatsApp * (com DDD)')}
      {inp('cidade_regiao', 'Cidade e região de atuação')}

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Anos de experiência com café</label>
        <select value={f.experiencia} onChange={e => setF({ ...f, experiencia: e.target.value })}
          className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#8B2214]">
          <option value="">Selecione…</option>
          {EXPERIENCIA.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Possui carteira ativa de clientes?</label>
        <div className="flex gap-2">
          {[['sim', 'Sim'], ['nao', 'Não']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setF({ ...f, carteira_ativa: v })}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border ${f.carteira_ativa === v ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>{l}</button>
          ))}
        </div>
      </div>

      {inp('clientes_aprox', 'Quantos clientes ativos aproximadamente')}

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quais canais você atende</label>
        <div className="flex flex-wrap gap-1.5">
          {CANAIS.map(c => (
            <button key={c} type="button" onClick={() => toggleCanal(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${canais.includes(c) ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Situação cadastral</label>
        <select value={f.situacao_cadastral} onChange={e => setF({ ...f, situacao_cadastral: e.target.value })}
          className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#8B2214]">
          <option value="">Selecione…</option>
          {SITUACAO.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      {inp('marcas_atuais', 'Marcas que representa atualmente (opcional)')}

      <label className="flex items-start gap-2 text-xs text-gray-600 bg-[#f8f7f5] border border-[#ddd0cc] rounded-lg p-3">
        <input type="checkbox" checked={ciente} onChange={e => setCiente(e.target.checked)} className="mt-0.5 accent-[#8B2214]" />
        <span>Estou ciente de que a representação é <strong>autônoma, com contrato formal</strong>, e que <strong>não há vínculo CLT, salário fixo nem ajuda de custo</strong> — a remuneração é por comissão sobre vendas. *</span>
      </label>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="submit" disabled={saving}
        className="w-full h-12 rounded-full bg-cofico-ink hover:bg-[#b81c1c] text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : 'Enviar candidatura'}
      </button>
    </form>
  );
}
