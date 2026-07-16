import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, ChevronDown, ChevronUp, X, Plus, Loader2 } from 'lucide-react';

// Sub-seção "Papéis" (RBAC — Bloco 0). Lista usuários e seus papéis; concede/revoga.
// Aditivo: NÃO substitui os checks de is_admin existentes; só gerencia a tabela user_roles.
interface Role { code: string; label: string }
interface UserRole { id: string; user_id: string; role_code: string; company_id: string | null; is_active: boolean }
interface Row { user_id: string; name: string; roles: UserRole[] }

export default function UserRolesManager() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: rolesData }, { data: profiles }, { data: reps }, { data: urs }] = await Promise.all([
      supabase.from('roles').select('code,label').order('code'),
      supabase.from('user_profiles').select('id,full_name,is_admin'),
      supabase.from('representatives').select('user_id,full_name'),
      supabase.from('user_roles').select('id,user_id,role_code,company_id,is_active').eq('is_active', true),
    ]);
    setRoles((rolesData as Role[]) || []);
    const nameById = new Map<string, string>();
    (profiles || []).forEach((p: any) => { if (p.full_name) nameById.set(p.id, p.full_name); });
    (reps || []).forEach((r: any) => { if (r.user_id && r.full_name) nameById.set(r.user_id, r.full_name); });
    // usuários = todos os que têm profile ou são reps ou já têm papel
    const ids = new Set<string>();
    (profiles || []).forEach((p: any) => ids.add(p.id));
    (reps || []).forEach((r: any) => { if (r.user_id) ids.add(r.user_id); });
    (urs || []).forEach((u: any) => ids.add(u.user_id));
    const byUser = new Map<string, UserRole[]>();
    (urs as UserRole[] | null)?.forEach(u => { const a = byUser.get(u.user_id) || []; a.push(u); byUser.set(u.user_id, a); });
    const list: Row[] = Array.from(ids).map(id => ({
      user_id: id,
      name: nameById.get(id) || id.slice(0, 8) + '…',
      roles: byUser.get(id) || [],
    })).sort((a, b) => a.name.localeCompare(b.name));
    setRows(list);
    setLoading(false);
  }

  useEffect(() => { if (open && rows.length === 0) load(); /* eslint-disable-next-line */ }, [open]);

  async function grant(userId: string, roleCode: string) {
    setBusy(userId + roleCode);
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role_code: roleCode, company_id: null, granted_by: user?.id ?? null });
    setBusy(null);
    if (error) { alert('Erro ao conceder: ' + error.message); return; }
    load();
  }
  async function revoke(ur: UserRole) {
    if (!confirm('Revogar este papel?')) return;
    setBusy(ur.id);
    const { error } = await supabase.from('user_roles').delete().eq('id', ur.id);
    setBusy(null);
    if (error) { alert('Erro ao revogar: ' + error.message); return; }
    load();
  }

  const labelOf = (code: string) => roles.find(r => r.code === code)?.label || code;

  return (
    <div className="bg-white border border-gray-200 rounded-xl">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div>
          <div className="text-left">
            <h3 className="font-bold text-gray-900">Papéis (RBAC)</h3>
            <p className="text-xs text-gray-500">Conceda ou revogue papéis dos usuários. Não altera os acessos atuais — é a fundação para o módulo Promotor.</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#8B2214]" /></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rows.map(row => {
                const active = new Set(row.roles.map(r => r.role_code));
                const grantable = roles.filter(r => !active.has(r.code));
                return (
                  <div key={row.user_id} className="flex flex-col sm:flex-row sm:items-center gap-2 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{row.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {row.roles.length === 0 && <span className="text-xs text-gray-400">sem papel</span>}
                        {row.roles.map(ur => (
                          <span key={ur.id} className="inline-flex items-center gap-1 text-xs font-medium bg-[#f5f0ef] text-[#8B2214] rounded-full pl-2.5 pr-1 py-0.5">
                            {labelOf(ur.role_code)}
                            <button onClick={() => revoke(ur)} disabled={busy === ur.id} className="w-4 h-4 rounded-full hover:bg-[#e6d9d6] flex items-center justify-center disabled:opacity-40" title="Revogar">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    {grantable.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {grantable.map(r => (
                          <button key={r.code} onClick={() => grant(row.user_id, r.code)} disabled={busy === row.user_id + r.code}
                            className="inline-flex items-center gap-1 text-xs font-medium border border-gray-200 text-gray-600 rounded-full px-2.5 py-1 hover:bg-gray-50 disabled:opacity-40">
                            <Plus className="w-3 h-3" /> {r.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {rows.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nenhum usuário encontrado.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
