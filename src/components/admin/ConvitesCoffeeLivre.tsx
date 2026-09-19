// Admin › RepCo › Convites › Coffee LiVRE (convidado).
//
// Convite de USO ÚNICO que vira conta própria: nome + empresa + e-mail + validade (1 ou 7 dias).
// O código vai por e-mail (remetente COFICO) e aparece aqui uma vez, para mandar por WhatsApp.
// O banco guarda só o hash; "Reenviar" gera um código NOVO e o anterior morre.
// Convidados cadastrados podem ser bloqueados um a um.
import { useEffect, useState } from 'react';
import { Copy, Check, Loader2, Plus, Clock, Send, XCircle, Ban, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Convite {
  id: string; nome: string; empresa: string | null; email: string; status: 'pendente' | 'usado' | 'cancelado' | 'substituido';
  expires_at: string; enviado_em: string | null; envio_erro: string | null; usado_em: string | null; user_id: string | null; created_at: string;
}
interface Convidado {
  user_id: string; nome: string; empresa: string | null; email: string; telefone: string | null; cargo: string | null;
  bloqueado: boolean; ultimo_acesso: string | null; created_at: string;
}
interface Antigo { id: string; label: string; expires_at: string | null; uses: number; last_used_at: string | null }

const quando = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dia = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

async function chamar(corpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('lv-convite', { body: corpo });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const j = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error(j?.erro ?? error.message);
  }
  return data as { codigo: string; enviado: boolean; erro_envio: string | null; expira: string };
}

export default function ConvitesCoffeeLivre() {
  const [form, setForm] = useState({ nome: '', empresa: '', email: '', dias: 7 });
  const [gerando, setGerando] = useState(false);
  const [novo, setNovo] = useState<{ codigo: string; email: string; enviado: boolean; erro: string | null; expira: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [convidados, setConvidados] = useState<Convidado[]>([]);
  const [antigos, setAntigos] = useState<Antigo[]>([]);

  async function carregar() {
    const [c, g, a] = await Promise.all([
      supabase.from('lv_convites').select('*').in('status', ['pendente', 'usado']).order('created_at', { ascending: false }).limit(100),
      supabase.from('lv_convidados').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('lv_demo_access').select('id,label,expires_at,uses,last_used_at').eq('ativo', true).order('created_at', { ascending: false }),
    ]);
    setConvites((c.data as Convite[]) ?? []);
    setConvidados((g.data as Convidado[]) ?? []);
    setAntigos(((a.data as Antigo[]) ?? []).filter(x => !x.expires_at || new Date(x.expires_at) > new Date()));
  }
  useEffect(() => { carregar(); }, []);

  async function gerar() {
    if (!form.nome.trim() || !form.email.trim()) { alert('Informe o nome e o e-mail do convidado.'); return; }
    setGerando(true); setNovo(null); setCopiado(false);
    try {
      const r = await chamar({ acao: 'criar', ...form });
      setNovo({ codigo: r.codigo, email: form.email.trim().toLowerCase(), enviado: r.enviado, erro: r.erro_envio, expira: r.expira });
      setForm({ nome: '', empresa: '', email: '', dias: form.dias });
      carregar();
    } catch (e) {
      alert('Não foi possível gerar: ' + (e instanceof Error ? e.message : ''));
    } finally { setGerando(false); }
  }

  async function reenviar(c: Convite) {
    if (!confirm(`Gerar um código NOVO para ${c.nome} (${c.email})? O código anterior deixa de valer.`)) return;
    try {
      const r = await chamar({ acao: 'reenviar', convite_id: c.id });
      setNovo({ codigo: r.codigo, email: c.email, enviado: r.enviado, erro: r.erro_envio, expira: r.expira });
      carregar();
    } catch (e) { alert('Não foi possível reenviar: ' + (e instanceof Error ? e.message : '')); }
  }

  async function cancelar(c: Convite) {
    if (!confirm(`Cancelar o convite de ${c.nome}? O código deixa de valer.`)) return;
    await supabase.from('lv_convites').update({ status: 'cancelado' }).eq('id', c.id);
    carregar();
  }

  async function alternarBloqueio(g: Convidado) {
    const bloquear = !g.bloqueado;
    if (!confirm(bloquear ? `Bloquear o acesso de ${g.nome} ao Coffee LiVRE?` : `Liberar de novo o acesso de ${g.nome}?`)) return;
    await supabase.from('lv_convidados').update({ bloqueado: bloquear, bloqueado_em: bloquear ? new Date().toISOString() : null }).eq('user_id', g.user_id);
    carregar();
  }

  async function desativarAntigo(a: Antigo) {
    if (!confirm(`Desativar o código antigo "${a.label}"? Quem usa esse código perde o acesso.`)) return;
    await supabase.from('lv_demo_access').update({ ativo: false }).eq('id', a.id);
    carregar();
  }

  const usadoPor = (c: Convite) => convidados.find(g => g.user_id === c.user_id);
  const inp = 'border border-gray-300 rounded-lg px-3 py-2 text-sm';

  return (
    <div className="space-y-4" data-convites="coffeelivre">
      <p className="text-sm text-gray-500">
        Convite <strong>pessoal e de uso único</strong> para o Coffee LiVRE. O código vai para o <strong>e-mail</strong> do convidado (e aparece aqui para mandar por WhatsApp).
        No cadastro ele cria a senha, e o código deixa de valer: repassar o código não adianta. Perdeu antes de usar? Ele pede "Perdi meu código" com o e-mail e recebe um novo.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.3fr_auto_auto] gap-2">
        <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do convidado" aria-label="Nome do convidado" className={inp} />
        <input value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} placeholder="Empresa (opcional)" aria-label="Empresa" className={inp} />
        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="E-mail do convidado" aria-label="E-mail do convidado" className={inp} />
        <select value={form.dias} onChange={e => setForm(f => ({ ...f, dias: Number(e.target.value) }))} aria-label="Validade do código" className={inp + ' bg-white'}>
          <option value={1}>vale 24 horas</option>
          <option value={7}>vale 7 dias</option>
        </select>
        <button onClick={gerar} disabled={gerando}
          className="inline-flex items-center justify-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg bg-saporino hover:bg-saporino-deep disabled:opacity-50">
          {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Convidar
        </button>
      </div>

      {novo && (
        <div className="bg-[#f8f7f5] border-2 border-dashed border-saporino rounded-xl p-4 text-center" data-campo="novo-convite">
          <p className="text-xs text-gray-500 mb-1">
            {novo.enviado ? <>Convite enviado para <strong>{novo.email}</strong>. Se quiser, mande também por WhatsApp:</> : <>O e-mail <strong>não saiu</strong> ({novo.erro}). Mande este código por WhatsApp:</>}
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl font-mono font-bold tracking-wider text-saporino" data-campo="codigo-convite">{novo.codigo}</span>
            <button onClick={() => navigator.clipboard.writeText(novo.codigo).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); })}
              className="text-gray-500 hover:text-gray-800" title="Copiar">
              {copiado ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-1 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> vale até {quando(novo.expira)} · uso único · <strong>o código não aparece de novo</strong>
          </p>
        </div>
      )}

      {convites.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500">Convites</p>
          {convites.map(c => {
            const expirado = c.status === 'pendente' && new Date(c.expires_at) < new Date();
            const quem = usadoPor(c);
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2" data-convite={c.email}>
                <span className="font-semibold text-gray-800">{c.nome}</span>
                {c.empresa && <span className="text-xs text-gray-500">{c.empresa}</span>}
                <span className="text-xs text-gray-400 truncate">· {c.email}</span>
                {c.envio_erro && <span className="text-[11px] text-red-600">e-mail não saiu</span>}
                <span className={`ml-auto text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${
                  c.status === 'usado' ? 'bg-gray-100 text-gray-600' : expirado ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-800'}`}>
                  {c.status === 'usado'
                    ? `Usado por ${quem ? `${quem.nome}${quem.empresa ? ` (${quem.empresa})` : ''}` : 'convidado'}${c.usado_em ? ` · ${dia(c.usado_em)}` : ''}`
                    : expirado ? `Expirado em ${dia(c.expires_at)}` : `Aguardando cadastro · até ${dia(c.expires_at)}`}
                </span>
                {c.status === 'pendente' && (
                  <>
                    <button onClick={() => reenviar(c)} title="Gerar e enviar um código novo" className="text-gray-400 hover:text-saporino"><Send className="w-4 h-4" /></button>
                    <button onClick={() => cancelar(c)} title="Cancelar convite" className="text-gray-300 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {convidados.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500">Convidados com conta</p>
          {convidados.map(g => (
            <div key={g.user_id} className="flex flex-wrap items-center gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2" data-convidado={g.email}>
              <span className="font-semibold text-gray-800">{g.nome}</span>
              {g.empresa && <span className="text-xs text-gray-500">{g.empresa}</span>}
              <span className="text-xs text-gray-400 truncate">· {g.email}{g.telefone ? ` · ${g.telefone}` : ''}</span>
              <span className="ml-auto text-[11px] text-gray-500 whitespace-nowrap">{g.ultimo_acesso ? `último acesso ${quando(g.ultimo_acesso)}` : 'ainda não entrou'}</span>
              <button onClick={() => alternarBloqueio(g)}
                className={`inline-flex items-center gap-1 text-xs font-semibold rounded-lg px-2 py-1 border ${g.bloqueado ? 'border-green-200 text-green-700 hover:bg-green-50' : 'border-red-200 text-red-700 hover:bg-red-50'}`}>
                {g.bloqueado ? <><RotateCcw className="w-3.5 h-3.5" /> Liberar acesso</> : <><Ban className="w-3.5 h-3.5" /> Bloquear acesso</>}
              </button>
            </div>
          ))}
        </div>
      )}

      {antigos.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500">Códigos antigos (multiuso, de antes dos convites) — desative quando não forem mais necessários</p>
          {antigos.map(a => (
            <div key={a.id} className="flex items-center gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2">
              <span className="font-semibold text-gray-800 truncate">{a.label}</span>
              <span className="text-xs text-gray-400">· {a.uses} {a.uses === 1 ? 'acesso' : 'acessos'}{a.last_used_at ? ` · último ${dia(a.last_used_at)}` : ''}</span>
              <button onClick={() => desativarAntigo(a)} className="ml-auto text-xs font-semibold text-red-700 hover:underline">Desativar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
