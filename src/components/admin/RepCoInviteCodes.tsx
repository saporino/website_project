import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { KeyRound, Copy, Check, Loader2, Plus, Clock, Trash2 } from 'lucide-react';

const BRAND = '#8B2214';

// Convite UNIFICADO: um só lugar para gerar código de Representante OU Promotor.
// A tabela repco_invite_codes já é única (coluna role_code); só as RPCs eram separadas.
// Representante -> repco_generate_invite (role_code default 'representante')
// Promotor      -> promoter_generate_invite (role_code 'promotor' + company_id)
type Role = 'representante' | 'promotor';
const ROLES: { value: Role; label: string }[] = [
  { value: 'representante', label: 'Representante de Vendas' },
  { value: 'promotor', label: 'Promotor de Merchandising' },
];
const roleLabel = (r: Role) => ROLES.find(x => x.value === r)?.label ?? r;
const roleBadge = (r: Role) => r === 'promotor'
  ? 'bg-amber-100 text-amber-700'
  : 'bg-[#f5f0ef] text-[#8B2214]';

interface Invite {
  code: string; note: string | null; created_at: string; expires_at: string;
  used_by: string | null; used_at: string | null; role: Role;
}

// Status de um código: usado / expirado / válido (com tempo restante)
function statusOf(i: Invite): { label: string; cls: string } {
  if (i.used_by) return { label: 'Usado', cls: 'bg-gray-100 text-gray-500' };
  if (new Date(i.expires_at) < new Date()) return { label: 'Expirado', cls: 'bg-red-100 text-red-600' };
  const mins = Math.round((new Date(i.expires_at).getTime() - Date.now()) / 60000);
  const left = mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins}min`;
  return { label: `Válido · ${left}`, cls: 'bg-green-100 text-green-700' };
}

export default function RepCoInviteCodes() {
  const { activeCompanyId } = useCompany();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [role, setRole] = useState<Role>('representante');
  const [note, setNote] = useState('');
  const [gen, setGen] = useState(false);
  const [fresh, setFresh] = useState<{ code: string; role: Role } | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    const [rep, promo] = await Promise.all([
      supabase.rpc('repco_list_invites'),
      supabase.rpc('promoter_list_invites'),
    ]);
    const merged: Invite[] = [
      ...(((rep.data as Omit<Invite, 'role'>[]) || []).map(i => ({ ...i, role: 'representante' as Role }))),
      ...(((promo.data as Omit<Invite, 'role'>[]) || []).map(i => ({ ...i, role: 'promotor' as Role }))),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setInvites(merged);
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    setGen(true); setFresh(null); setCopied(false);
    const { data, error } = role === 'promotor'
      ? await supabase.rpc('promoter_generate_invite', { p_note: note.trim() || null, p_company: activeCompanyId })
      : await supabase.rpc('repco_generate_invite', { p_note: note.trim() || null });
    setGen(false);
    if (error) { alert('Erro ao gerar: ' + error.message); return; }
    const code = Array.isArray(data) ? (data[0] as any)?.code : (data as any)?.code;
    if (code) { setFresh({ code, role }); setNote(''); load(); }
  }

  function copy(code: string) {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  async function remove(code: string, r: Role) {
    if (!confirm(`Apagar o código ${code}? Ele não poderá mais ser usado.`)) return;
    // rep usa repco_delete_invite; promotor usa repco_revoke_invite (ambos por código, na mesma tabela).
    const rpc = r === 'promotor' ? 'repco_revoke_invite' : 'repco_delete_invite';
    const { error } = await supabase.rpc(rpc, { p_code: code });
    if (error) { alert('Erro ao apagar: ' + error.message); return; }
    if (fresh?.code === code) setFresh(null);
    load();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold text-gray-900">
          <span className="w-9 h-9 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center"><KeyRound className="w-5 h-5" /></span>
          Convites (representante e promotor)
        </span>
        <span className="text-xs text-gray-400">{open ? 'ocultar' : 'abrir'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-500">Escolha a função, gere o código e envie por WhatsApp. Ele é <strong>válido por 24 horas</strong> e só pode ser usado <strong>uma vez</strong>. O representante digita no cadastro do RepCo; o promotor, em <span className="font-mono">/promotor</span>.</p>

          {/* seletor de função */}
          <div className="flex flex-wrap gap-2">
            {ROLES.map(r => (
              <button key={r.value} onClick={() => setRole(r.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${role === r.value ? 'bg-[#8B2214] text-white border-[#8B2214]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Para quem? (opcional — ex.: João, Zona Leste)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <button onClick={generate} disabled={gen}
              className="inline-flex items-center justify-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: BRAND }}>
              {gen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Gerar código
            </button>
          </div>

          {fresh && (
            <div className="bg-[#f8f7f5] border-2 border-dashed border-[#8B2214] rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Código de <strong>{roleLabel(fresh.role)}</strong> — envie para a pessoa:</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-mono font-bold tracking-widest text-[#8B2214]">{fresh.code}</span>
                <button onClick={() => copy(fresh.code)} className="text-gray-500 hover:text-gray-800" title="Copiar">
                  {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> expira em 24 horas · uso único</p>
              <button onClick={() => remove(fresh.code, fresh.role)} className="mt-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" /> Apagar este código
              </button>
            </div>
          )}

          {invites.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500">Códigos ativos (ainda válidos)</p>
              {invites.map(i => {
                const s = statusOf(i);
                return (
                  <div key={i.code} className="flex items-center gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2">
                    <span className="font-mono font-bold tracking-wider text-gray-800">{i.code}</span>
                    <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${roleBadge(i.role)}`}>{i.role === 'promotor' ? 'Promotor' : 'Representante'}</span>
                    {i.note && <span className="text-xs text-gray-400 truncate">· {i.note}</span>}
                    <span className={`ml-auto text-[11px] font-semibold rounded-full px-2 py-0.5 ${s.cls}`}>{s.label}</span>
                    <button onClick={() => remove(i.code, i.role)} title="Apagar código" className="text-gray-300 hover:text-red-600 flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Selo do código de convite que ESTE representante usou pra se cadastrar (aparece no perfil dele).
export function RepInviteBadge({ userId }: { userId: string }) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    let ok = true;
    supabase.rpc('repco_code_used_by', { p_user: userId }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : null;
      if (ok) setCode(row?.code ?? null);
    });
    return () => { ok = false; };
  }, [userId]);
  if (!code) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500" title="Código de convite usado no cadastro">
      <KeyRound className="w-3.5 h-3.5 text-[#8B2214]" /> convite <span className="font-mono font-semibold text-gray-700">{code}</span>
    </span>
  );
}
