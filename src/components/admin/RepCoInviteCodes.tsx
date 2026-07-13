import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { KeyRound, Copy, Check, Loader2, Plus, Clock } from 'lucide-react';

const BRAND = '#8B2214';

interface Invite {
  code: string; note: string | null; created_at: string; expires_at: string;
  used_by: string | null; used_at: string | null;
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
  const [invites, setInvites] = useState<Invite[]>([]);
  const [note, setNote] = useState('');
  const [gen, setGen] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase.rpc('repco_list_invites');
    setInvites((data as Invite[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    setGen(true); setFresh(null); setCopied(false);
    const { data, error } = await supabase.rpc('repco_generate_invite', { p_note: note.trim() || null });
    setGen(false);
    if (error) { alert('Erro ao gerar: ' + error.message); return; }
    const code = Array.isArray(data) ? data[0]?.code : (data as any)?.code;
    if (code) { setFresh(code); setNote(''); load(); }
  }

  function copy(code: string) {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold text-gray-900">
          <span className="w-9 h-9 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center"><KeyRound className="w-5 h-5" /></span>
          Convites de representante
        </span>
        <span className="text-xs text-gray-400">{open ? 'ocultar' : 'abrir'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-500">Gere um código para convidar um novo representante. Ele é <strong>válido por 24 horas</strong> e só pode ser usado <strong>uma vez</strong>. Envie por WhatsApp; a pessoa digita no cadastro do RepCo.</p>

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
              <p className="text-xs text-gray-500 mb-1">Código gerado — envie para o novo representante:</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-mono font-bold tracking-widest text-[#8B2214]">{fresh}</span>
                <button onClick={() => copy(fresh)} className="text-gray-500 hover:text-gray-800" title="Copiar">
                  {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> expira em 24 horas · uso único</p>
            </div>
          )}

          {invites.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500">Últimos códigos</p>
              {invites.map(i => {
                const s = statusOf(i);
                return (
                  <div key={i.code} className="flex items-center gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2">
                    <span className="font-mono font-bold tracking-wider text-gray-800">{i.code}</span>
                    {i.note && <span className="text-xs text-gray-400 truncate">· {i.note}</span>}
                    <span className={`ml-auto text-[11px] font-semibold rounded-full px-2 py-0.5 ${s.cls}`}>{s.label}</span>
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
