// Seções editáveis da ficha PJ.
//
// Cada seção salva sozinha. O cliente preenche o que sabe agora, salva, e volta
// depois para o resto — um formulário único de quarenta campos é abandonado no
// meio, e aí não se tem nem a metade.
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, Loader2, Pencil, X, Plus, Trash2 } from 'lucide-react';
import {
  type Contato, type TipoContato, PAPEIS, PAPEIS_ESSENCIAIS,
  formatarTelefone, formatarCEP, emailParece, soDigitos,
} from './fichaPJ';

const campo = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B2214]/30 focus:border-[#8B2214]';
const rotulo = 'block text-xs font-semibold text-gray-600 mb-1.5';

/** Moldura comum: título, estado de edição, salvar e cancelar. */
export function Secao({ titulo, icone, resumo, completa, children, onSalvar }: {
  titulo: string;
  icone: JSX.Element;
  resumo?: string | null;
  completa?: boolean;
  children: (editando: boolean) => JSX.Element;
  onSalvar: () => Promise<string | null>;   // devolve mensagem de erro, ou null
}) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);

  async function salvar() {
    setSalvando(true); setErro('');
    const e = await onSalvar();
    setSalvando(false);
    if (e) { setErro(e); return; }
    setEditando(false);
    setSalvo(true); setTimeout(() => setSalvo(false), 2500);
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-gray-900 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-[#f5f0ef] text-[#8B2214] flex items-center justify-center flex-shrink-0">
            {icone}
          </span>
          <span>{titulo}</span>
          {completa === false && !editando && (
            <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 flex-shrink-0">falta</span>
          )}
        </h2>
        {!editando ? (
          <button onClick={() => { setEditando(true); setErro(''); }}
            className="inline-flex items-center gap-1 text-sm text-[#8B2214] font-semibold hover:underline flex-shrink-0">
            <Pencil className="w-3.5 h-3.5" /> {resumo ? 'Editar' : 'Preencher'}
          </button>
        ) : (
          <button onClick={() => { setEditando(false); setErro(''); }}
            className="text-sm text-gray-400 hover:text-gray-700 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {salvo && (
        <p className="mb-3 inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
          <Check className="w-3.5 h-3.5" /> Salvo
        </p>
      )}
      {erro && <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}

      {children(editando)}

      {editando && (
        <button onClick={salvar} disabled={salvando}
          className="mt-4 w-full sm:w-auto bg-[#8B2214] hover:bg-[#6d1a10] text-white font-semibold rounded-lg px-6 py-2.5 text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
        </button>
      )}
    </section>
  );
}

/** Linha de leitura: rótulo em cima, valor embaixo. Some quando vazio. */
export function Linha({ rotulo: r, valor }: { rotulo: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <dt className="text-xs text-gray-500">{r}</dt>
      <dd className="text-sm text-gray-900 font-medium mt-0.5 break-words">{valor}</dd>
    </div>
  );
}

export function Texto({ label, valor, onChange, tipo = 'text', placeholder, dica }: {
  label: string; valor: string; onChange: (v: string) => void;
  tipo?: string; placeholder?: string; dica?: string;
}) {
  return (
    <div>
      <label className={rotulo}>{label}</label>
      <input type={tipo} value={valor} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className={campo} />
      {dica && <p className="text-[11px] text-gray-400 mt-1">{dica}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------
// Contatos por departamento
// ---------------------------------------------------------------------
export function ContatosDoDepartamento({ contatos, onChange }: {
  contatos: Contato[];
  onChange: (c: Contato[]) => void;
}) {
  const porTipo = (t: TipoContato) => contatos.find(c => c.tipo === t);

  function mexer(tipo: TipoContato, campo: keyof Contato, valor: string) {
    const existe = porTipo(tipo);
    if (existe) {
      onChange(contatos.map(c => c.tipo === tipo ? { ...c, [campo]: valor } : c));
    } else {
      onChange([...contatos, { tipo, nome: '', [campo]: valor } as Contato]);
    }
  }

  const [extras, setExtras] = useState<TipoContato[]>(() =>
    PAPEIS.filter(p => !PAPEIS_ESSENCIAIS.includes(p.tipo) && !!porTipo(p.tipo)).map(p => p.tipo));

  const visiveis = PAPEIS.filter(p => PAPEIS_ESSENCIAIS.includes(p.tipo) || extras.includes(p.tipo));
  const disponiveis = PAPEIS.filter(p => !visiveis.some(v => v.tipo === p.tipo));

  return (
    <div className="space-y-5">
      {visiveis.map(p => {
        const c = porTipo(p.tipo);
        const essencial = PAPEIS_ESSENCIAIS.includes(p.tipo);
        return (
          <div key={p.tipo} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {p.titulo} {essencial && <span className="text-[#8B2214]">*</span>}
                </p>
                <p className="text-[11px] text-gray-500">{p.ajuda}</p>
              </div>
              {!essencial && (
                <button type="button" onClick={() => {
                  setExtras(x => x.filter(t => t !== p.tipo));
                  onChange(contatos.filter(x => x.tipo !== p.tipo));
                }} className="text-gray-300 hover:text-red-600 flex-shrink-0" title="Remover">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={c?.nome ?? ''} onChange={e => mexer(p.tipo, 'nome', e.target.value)}
                placeholder="Nome" className={campo} />
              <input value={c?.cargo ?? ''} onChange={e => mexer(p.tipo, 'cargo', e.target.value)}
                placeholder="Cargo (opcional)" className={campo} />
              <input value={c?.email ?? ''} onChange={e => mexer(p.tipo, 'email', e.target.value)}
                type="email" placeholder="E-mail" className={`${campo} ${c?.email && !emailParece(c.email) ? 'border-red-400' : ''}`} />
              <input value={c?.telefone ?? ''} onChange={e => mexer(p.tipo, 'telefone', formatarTelefone(e.target.value))}
                inputMode="tel" placeholder="Telefone" className={campo} />
              <input value={c?.whatsapp ?? ''} onChange={e => mexer(p.tipo, 'whatsapp', formatarTelefone(e.target.value))}
                inputMode="tel" placeholder="WhatsApp (opcional)" className={`${campo} sm:col-span-2`} />
            </div>
          </div>
        );
      })}

      {disponiveis.length > 0 && (
        <div>
          <p className={rotulo}>Acrescentar outro contato</p>
          <div className="flex flex-wrap gap-2">
            {disponiveis.map(p => (
              <button key={p.tipo} type="button" onClick={() => setExtras(x => [...x, p.tipo])}
                className="inline-flex items-center gap-1 text-xs font-semibold border border-gray-300 text-gray-600 hover:border-[#8B2214] hover:text-[#8B2214] rounded-lg px-3 py-1.5">
                <Plus className="w-3.5 h-3.5" /> {p.titulo}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Salva os contatos: apaga os que sumiram, grava os que têm nome. */
export async function salvarContatos(clienteId: string, contatos: Contato[]): Promise<string | null> {
  const validos = contatos.filter(c => (c.nome ?? '').trim());
  const ruim = validos.find(c => c.email && !emailParece(c.email));
  if (ruim) return `O e-mail de ${PAPEIS.find(p => p.tipo === ruim.tipo)?.titulo ?? ruim.tipo} parece incompleto.`;

  // Troca o conjunto inteiro: é a operação que o cliente entende ("salvei esta
  // seção"), e evita contato órfão de um papel que ele removeu da tela.
  const { error: eDel } = await supabase.from('cliente_contatos').delete().eq('cliente_id', clienteId);
  if (eDel) return 'Não foi possível salvar agora. Tente de novo.';

  if (validos.length === 0) return null;
  const { error } = await supabase.from('cliente_contatos').insert(
    validos.map(c => ({
      cliente_id: clienteId, tipo: c.tipo, nome: c.nome.trim(),
      cargo: c.cargo?.trim() || null,
      email: c.email?.trim().toLowerCase() || null,
      telefone: c.telefone?.trim() || null,
      whatsapp: c.whatsapp?.trim() || null,
    })),
  );
  return error ? 'Não foi possível salvar os contatos.' : null;
}

export { campo, rotulo, formatarCEP, soDigitos };
