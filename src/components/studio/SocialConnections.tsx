import { useState, useEffect, useCallback } from 'react';
import { Instagram, Music2, Youtube, CheckCircle2, Link2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface Conn {
  id: string; company_id: string | null; platform: string;
  account_name: string | null; account_id: string | null;
  access_token: string | null; status: string; expires_at: string | null;
}

const NETS: { key: string; label: string; icon: any; hint: string }[] = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, hint: 'Conta Comercial/Criador ligada a uma Página do Facebook. Token vem do app Meta (Graph API).' },
  { key: 'tiktok', label: 'TikTok', icon: Music2, hint: 'App no TikTok for Developers com Content Posting API. Token vem de lá.' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, hint: 'Projeto no Google Cloud com YouTube Data API v3 (OAuth). Depois.' },
];

// Conexões de redes sociais do Studio (por empresa). Enquanto não há OAuth automático
// (depende dos apps aprovados na Meta/TikTok), a conexão é feita colando o token do app.
export default function SocialConnections({ companyId }: { companyId: string | null }) {
  const [conns, setConns] = useState<Record<string, Conn>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ account_name: '', account_id: '', access_token: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase.from('studio_social_connections').select('*').eq('company_id', companyId);
    const map: Record<string, Conn> = {};
    (data as Conn[] || []).forEach(c => { map[c.platform] = c; });
    setConns(map);
    setLoading(false);
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  function openEdit(platform: string) {
    const c = conns[platform];
    setForm({ account_name: c?.account_name || '', account_id: c?.account_id || '', access_token: '' });
    setEditing(platform);
  }

  // TikTok conecta por OAuth (abre a autorização do TikTok numa nova aba)
  function connectTikTok() {
    const base = import.meta.env.VITE_SUPABASE_URL;
    window.open(`${base}/functions/v1/tiktok-oauth?start=1&company=${companyId || ''}`, '_blank');
    toast.info('Autorize o app na aba do TikTok que abriu; depois volte e atualize a página.');
  }

  async function save() {
    if (!form.access_token.trim() && !conns[editing!]?.access_token) { toast.error('Cole o token de acesso da rede.'); return; }
    setSaving(true);
    const payload: any = {
      company_id: companyId, platform: editing,
      account_name: form.account_name.trim() || null, account_id: form.account_id.trim() || null,
      status: 'connected', updated_at: new Date().toISOString(),
    };
    if (form.access_token.trim()) payload.access_token = form.access_token.trim();
    const { error } = await supabase.from('studio_social_connections').upsert(payload, { onConflict: 'company_id,platform' });
    setSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Conexão salva!');
    setEditing(null); load();
  }

  async function disconnect(platform: string) {
    if (!confirm('Desconectar esta rede?')) return;
    await supabase.from('studio_social_connections').delete().eq('company_id', companyId).eq('platform', platform);
    load();
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B2214]" /></div>;

  return (
    <div className="space-y-3">
      <div className="bg-[#f8f7f5] border border-[#ddd0cc] rounded-xl p-4 text-sm text-gray-600">
        Ligue aqui as contas onde o Studio vai publicar. Enquanto os apps da Meta/TikTok não estão aprovados,
        a conexão é feita <strong>colando o token</strong> do app. Quando aprovar, ligo o botão "Conectar" automático.
      </div>
      {NETS.map(n => {
        const c = conns[n.key];
        const on = c?.status === 'connected';
        const Icon = n.icon;
        return (
          <div key={n.key} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">{n.label}</p>
                  {on
                    ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" /> Conectado</span>
                    : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Não conectado</span>}
                </div>
                {on && c?.account_name && <p className="text-xs text-gray-500 mt-0.5">Conta: {c.account_name}</p>}
                <p className="text-xs text-gray-400 mt-1">{n.hint}</p>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={() => n.key === 'tiktok' ? connectTikTok() : openEdit(n.key)} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#8B2214] hover:bg-[#6d1a10] rounded-lg px-3 py-1.5">
                  <Link2 className="w-3.5 h-3.5" /> {n.key === 'tiktok' ? (on ? 'Reconectar' : 'Conectar') : (on ? 'Editar' : 'Conectar')}
                </button>
                {on && <button onClick={() => disconnect(n.key)} className="text-xs text-gray-500 hover:text-red-600 px-3 py-1">Desconectar</button>}
              </div>
            </div>
          </div>
        );
      })}

      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">Conectar {NETS.find(x => x.key === editing)?.label}</h3>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Nome da conta (ex.: @cafesaporino)</label>
                <input value={form.account_name} onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">ID da conta (opcional)</label>
                <input value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Token de acesso {conns[editing]?.access_token ? '(deixe em branco para manter o atual)' : ''}</label>
                <textarea value={form.access_token} onChange={e => setForm(p => ({ ...p, access_token: e.target.value }))} rows={3} placeholder="Cole o token do app aqui" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-[#8B2214] hover:bg-[#6d1a10] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
