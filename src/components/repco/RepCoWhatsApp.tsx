// RepCo › WhatsApp — central de atendimento dos contatos EXTERNOS da COFICO.
//
// Aba própria, separada de "Mensagens" (que é o chat interno da equipe). São públicos
// diferentes, regras diferentes e acessos diferentes: misturar convida ao erro de
// responder no lugar errado.
//
// ESTA VERSÃO É DEMONSTRAÇÃO: lê de `whatsappDemo.ts` e não fala com banco nem com a
// Meta. Nada aqui envia mensagem. Quando for ligada às tabelas `wa_*`, o arquivo de
// dados sai e a forma do componente não muda — por isso o estado já é o mesmo que a
// view `vw_wa_caixa` entrega (janela_aberta, janela_minutos, nao_lidas, responsavel).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageCircle, Search, Clock, Check, CheckCheck, AlertTriangle, Image, FileText,
  UserCheck, Send, Phone, Building2, Lock, Loader2,
} from 'lucide-react';
import { CONVERSAS_DEMO, ATENDENTES, type ConversaDemo, type MensagemDemo } from './whatsappDemo';
import { lerCaixa, marcarLida, assumirAtendimento, enviarMensagem } from './whatsappDados';
import { supabase } from '../../lib/supabase';

const MARCA = '#8B2214';
const JANELA_MIN = 24 * 60;

/** "agora", "12 min", "3 h", "2 d" — o tempo que importa numa caixa de atendimento. */
function ha(min: number): string {
  if (min < 1) return 'agora';
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h`;
  return `${Math.floor(min / 1440)} d`;
}

/** Quanto falta da janela de 24 h, em palavras de quem atende. */
function janela(desdeEntrada: number) {
  const restam = JANELA_MIN - desdeEntrada;
  if (restam <= 0) return { aberta: false, restam: 0, texto: 'Janela fechada', curto: 'fechada' };
  if (restam < 60) return { aberta: true, restam, texto: `Fecha em ${Math.round(restam)} min`, curto: `${Math.round(restam)} min` };
  return { aberta: true, restam, texto: `Fecha em ${Math.floor(restam / 60)} h`, curto: `${Math.floor(restam / 60)} h` };
}

const telefoneBonito = (e164: string) => {
  const d = e164.replace(/\D/g, '').replace(/^55/, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : e164;
};

function SeloEstado({ m }: { m: MensagemDemo }) {
  if (m.direcao !== 'saida') return null;
  if (m.estado === 'falhou') {
    return <span className="inline-flex items-center gap-1 text-red-600" title={m.erro}>
      <AlertTriangle className="w-3 h-3" /> falhou
    </span>;
  }
  if (m.estado === 'lida') return <CheckCheck className="w-3.5 h-3.5 text-sky-600" />;
  if (m.estado === 'entregue') return <CheckCheck className="w-3.5 h-3.5 text-gray-400" />;
  return <Check className="w-3.5 h-3.5 text-gray-400" />;
}

/** `demo` desenha as conversas ficticias; `banco` le as tabelas wa_* pela RLS. */
export default function RepCoWhatsApp({ fonte = 'banco' }: { fonte?: 'banco' | 'demo' }) {
  const demo = fonte === 'demo';
  const [conversas, setConversas] = useState<ConversaDemo[]>(demo ? CONVERSAS_DEMO : []);
  const [abertaId, setAbertaId] = useState<string>(demo ? CONVERSAS_DEMO[0].id : '');
  const [carregando, setCarregando] = useState(!demo);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [eu, setEu] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [rascunho, setRascunho] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas' | 'minhas'>('todas');

  const EU = demo ? ATENDENTES[0] : (eu ?? '—');

  // ─────────────────────────────────────────── carga e tempo real (só no modo banco)
  const recarregar = useCallback(async () => {
    try {
      const { conversas: cs } = await lerCaixa();
      setConversas(cs);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  const primeira = useRef(true);
  useEffect(() => {
    if (demo) return;
    supabase.auth.getUser().then(({ data }) => setEu(data.user?.id ?? null));
    recarregar();
    // Mensagem nova tem de aparecer sem ninguém apertar F5: numa tela de atendimento,
    // recarregar na mão significa cliente esperando sem ninguém saber.
    const canal = supabase.channel('wa-caixa-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_mensagens' }, () => recarregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversas' }, () => recarregar())
      .subscribe();
    // Rede de segurança: se um evento do realtime se perder, a tela se corrige sozinha.
    const relogio = setInterval(recarregar, 60000);
    return () => { supabase.removeChannel(canal); clearInterval(relogio); };
  }, [demo, recarregar]);

  // Abre a primeira conversa assim que a caixa chega, sem atropelar a escolha de quem usa.
  //
  // Precisa chamar `abrir`, não só `setAbertaId`: a conversa aberta sozinha estava ficando
  // com o contador de não lidas cheio para sempre, porque marcar como lida só acontecia no
  // clique. Quem abre a central e lê a mensagem na hora nunca clicaria nela.
  useEffect(() => {
    if (primeira.current && conversas.length > 0 && !abertaId) {
      primeira.current = false;
      void abrir(conversas[0].id);
    }
    // `abrir` é estável o bastante aqui: só usa setState e a RPC.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas, abertaId]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return conversas
      .filter(c => filtro !== 'nao_lidas' || c.naoLidas > 0)
      .filter(c => filtro !== 'minhas' || c.responsavel === EU)
      .filter(c => !q || c.nome.toLowerCase().includes(q) || c.telefone.includes(q)
        || (c.cliente ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.desdeEntrada - b.desdeEntrada);
  }, [conversas, busca, filtro, EU]);

  const aberta = conversas.find(c => c.id === abertaId) ?? lista[0] ?? conversas[0] ?? null;
  const j = janela(aberta?.desdeEntrada ?? Number.MAX_SAFE_INTEGER);
  const totalNaoLidas = conversas.reduce((s, c) => s + c.naoLidas, 0);

  async function abrir(id: string) {
    setAbertaId(id);
    setRascunho('');
    setConversas(cs => cs.map(c => (c.id === id ? { ...c, naoLidas: 0 } : c)));
    // Quem decide se pode zerar é o banco, pelo papel. A tela só pede.
    if (!demo) { try { await marcarLida(id); } catch (e) { setErro(String(e)); } }
  }

  async function assumir() {
    if (!aberta) return;
    const meu = aberta.responsavel !== null && (demo ? aberta.responsavel === EU : true);
    if (demo) {
      setConversas(cs => cs.map(c => (c.id === aberta.id
        ? { ...c, responsavel: c.responsavel === EU ? null : EU } : c)));
      return;
    }
    try { await assumirAtendimento(aberta.id, !meu); await recarregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
  }

  async function enviar() {
    const conteudo = rascunho.trim();
    if (!conteudo || !j.aberta || !aberta || enviando) return;

    if (!demo) {
      // `enviando` trava o botão E a tecla Enter: sem isso, dois cliques rápidos viram
      // duas mensagens para o cliente. A chave de idempotência é a segunda rede, no banco.
      setEnviando(true);
      setAviso(null);
      setErro(null);
      try {
        const r = await enviarMensagem(aberta.id, conteudo);
        if (!r.ok) { setErro(r.explicacao ?? 'Não foi possível enviar.'); return; }
        setRascunho('');
        if (r.duplicado) setAviso('Esta mensagem já tinha sido enviada.');
        else if (r.simulado) setAviso('Simulado: o token da Meta ainda não foi configurado. Nada saiu para o cliente.');
        await recarregar();
      } finally {
        setEnviando(false);
      }
      return;
    }

    const texto = rascunho.trim();
    if (!texto || !j.aberta || !aberta) return;
    const nova: MensagemDemo = {
      id: 'local-' + Date.now(), direcao: 'saida', texto, ha: 0, estado: 'enviada', autor: EU,
    };
    setConversas(cs => cs.map(c => (c.id === aberta.id
      ? { ...c, mensagens: [...c.mensagens, nova] } : c)));
    setRascunho('');
  }

  if (!demo && carregando) {
    return <div className="flex justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: MARCA }} />
    </div>;
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" style={{ color: MARCA }} /> WhatsApp — COFICO
          </h3>
          <p className="text-sm text-gray-500">
            {conversas.length} conversas · {totalNaoLidas} não lidas · contatos de fora da empresa
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          <Lock className="w-3.5 h-3.5" />
          {demo ? 'Demonstração — dados fictícios, nada é enviado' : 'Atendimento ao vivo'}
        </span>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>
      )}

      {!demo && conversas.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="font-semibold text-gray-800">Nenhuma conversa ainda.</p>
          <p className="text-sm text-gray-500 mt-1">
            Quando alguém escrever para o número da COFICO, a conversa aparece aqui sozinha.
          </p>
        </div>
      )}
      {!demo && conversas.length === 0 ? null : (
      <>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        {/* ─────────────────────────────────── lista de conversas */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col max-h-[36rem]">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome, telefone ou cliente…"
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-sm" />
            </div>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {([['todas', 'Todas'], ['nao_lidas', 'Não lidas'], ['minhas', 'Minhas']] as const).map(([id, rot]) => (
                <button key={id} onClick={() => setFiltro(id)}
                  className={`px-3 py-1.5 font-medium ${filtro === id ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  style={filtro === id ? { background: MARCA } : {}}>{rot}</button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-gray-100">
            {lista.length === 0 && <p className="p-6 text-center text-sm text-gray-400">Nenhuma conversa aqui.</p>}
            {lista.map(c => {
              const jc = janela(c.desdeEntrada);
              const ultima = c.mensagens[c.mensagens.length - 1];
              const ativa = c.id === aberta.id;
              return (
                <button key={c.id} onClick={() => abrir(c.id)}
                  className={`w-full text-left p-3 transition-colors ${ativa ? 'bg-[#f5f0ef]' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-start gap-2">
                    <div className="w-9 h-9 rounded-full bg-[#f5f0ef] flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={{ color: MARCA }}>{c.nome.slice(0, 1)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.nome}</p>
                        <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">{ha(c.desdeEntrada)}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {ultima?.direcao === 'saida' && <span className="text-gray-400">Você: </span>}
                        {ultima?.texto ?? '—'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {c.naoLidas > 0 && (
                          <span className="rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: MARCA }}>
                            {c.naoLidas}
                          </span>
                        )}
                        <span className={`rounded-full px-1.5 text-[10px] font-medium ${jc.aberta
                          ? jc.restam < 120 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'}`}>{jc.curto}</span>
                        {c.responsavel && (
                          <span className="rounded-full bg-sky-50 px-1.5 text-[10px] text-sky-700">{c.responsavel}</span>
                        )}
                        {c.cliente && <span className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-500">cliente</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─────────────────────────────────── conversa aberta */}
        {!aberta ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
            Escolha uma conversa à esquerda.
          </div>
        ) : (
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col max-h-[36rem]">
          {/* quem é */}
          <div className="p-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{aberta.nome}</p>
              <p className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{telefoneBonito(aberta.telefone)}</span>
                {aberta.cliente
                  ? <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{aberta.cliente}</span>
                  : <span className="text-amber-700">sem cadastro de cliente</span>}
              </p>
            </div>
            <button onClick={assumir}
              className={`ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                aberta.responsavel === EU ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              <UserCheck className="w-3.5 h-3.5" />
              {aberta.responsavel ? `Atendendo: ${aberta.responsavel}` : 'Assumir atendimento'}
            </button>
          </div>

          {/* janela de 24 h — a regra que decide se dá para responder */}
          <div className={`px-3 py-2 text-xs flex items-center gap-2 border-b ${j.aberta
            ? j.restam < 120 ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-green-50 border-green-100 text-green-800'
            : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            {j.aberta
              ? <span><strong>{j.texto}</strong> — dá para responder normalmente.</span>
              : <span><strong>Janela fechada.</strong> Passaram 24 h desde a última mensagem do cliente: só modelo aprovado, que é cobrado.</span>}
          </div>

          {/* histórico */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8f7f5]">
            {aberta.mensagens.map(m => (
              <div key={m.id} className={`flex ${m.direcao === 'saida' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  m.direcao === 'saida' ? 'bg-[#f5f0ef] text-gray-800 rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'}`}>
                  {m.anexo && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
                      {m.tipo === 'imagem' ? <Image className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                      {m.anexo}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                  <div className="flex items-center gap-1.5 justify-end mt-1 text-[10px] text-gray-400">
                    {m.direcao === 'saida' && m.autor && <span>{m.autor}</span>}
                    <span>{ha(m.ha)}</span>
                    <SeloEstado m={m} />
                  </div>
                  {m.estado === 'falhou' && m.erro && (
                    <p className="text-[10px] text-red-600 mt-0.5">{m.erro}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* responder */}
          <div className="p-3 border-t border-gray-100">
            {j.aberta ? (
              <div className="space-y-2">
                <div className="flex items-end gap-2">
                  <textarea value={rascunho} onChange={e => setRascunho(e.target.value)} rows={2}
                    disabled={enviando}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
                    placeholder="Escreva a resposta… (Enter envia, Shift+Enter quebra linha)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none disabled:bg-gray-50" />
                  <button onClick={() => void enviar()} disabled={!rascunho.trim() || enviando}
                    className="inline-flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-40"
                    style={{ background: MARCA }}>
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {enviando ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>
                {aviso && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{aviso}</p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                <p className="font-semibold text-gray-800 mb-1">Não dá para escrever uma resposta livre agora.</p>
                <p className="text-xs">
                  O WhatsApp só permite texto livre nas 24 h seguintes à última mensagem do cliente.
                  Depois disso, a conversa só reabre com um <strong>modelo aprovado</strong> pela Meta — que é cobrado — ou
                  quando o próprio cliente escrever de novo.
                </p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
      </>
      )}

      <p className="text-[11px] text-gray-400">
        {demo
          ? 'Demonstração de interface. As conversas acima são fictícias, nenhuma mensagem é enviada e nenhum número real é usado.'
          : 'Conversas reais, lidas do banco pela sua permissão de acesso. Você só vê as conversas das empresas em que tem acesso.'}
      </p>
    </div>
  );
}
