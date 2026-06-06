// RepCoApp — espelho mobile do portal RepCoWeb.
// Deve ter TODAS as abas do RepCoWeb para o rep ter acesso completo.
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { Home, ClipboardList, Users, ShoppingBag, RefreshCw, X, Minus, GripHorizontal, Radio, Truck, DollarSign, TrendingUp, User, Plus, FileText } from 'lucide-react';
import { useTrainingBroadcast, useTrainingListener, espelhoTabToRepTab, type CalcState } from '../../lib/training';
import RepCoHome from '../repco/RepCoHome';
import RepCoProspection from '../repco/RepCoProspection';
import RepCoClients from '../repco/RepCoClients';
import RepCoDeliveries from '../repco/RepCoDeliveries';
import RepCoFieldMap from '../repco/RepCoFieldMap';
import RepCoCalculatorFab from '../repco/RepCoCalculatorFab';
import { supabase } from '../../lib/supabase';

// Lazy — exports nomeados precisam de .then(m=>({default:m.X}))
const RepCoProfile     = lazy(() => import('../repco/RepCoProfile').then(m => ({ default: m.RepCoProfile })));
const RepCoNewOrder    = lazy(() => import('../repco/RepCoNewOrder'));
const RepCoCommissions = lazy(() => import('../repco/RepCoCommissions').then(m => ({ default: m.RepCoCommissions })));
const RepCoPerformance = lazy(() => import('../repco/RepCoPerformance').then(m => ({ default: m.RepCoPerformance })));

interface Representative {
  id: string;
  full_name: string;
  status: 'pending' | 'active' | 'blocked';
}

interface Props {
  representatives: Representative[];
  initialRepresentativeId?: string | null;
  onClose: () => void;
  offsetIndex?: number;
  /**
   * isTrainingMode=true  → "Ver todos": UMA janela genérica sem rep, mostra "Todos representantes",
   *                         sem dropdown, ações bloqueadas — usada com broadcast de treinamento.
   * isTrainingMode=false → "Ver como rep": dropdown para escolher rep, ações DESBLOQUEADAS
   *                         (admin pode ajudar o rep remotamente).
   */
  isTrainingMode?: boolean;
}

// Todas as abas do RepCoApp — idêntico ao RepCoWeb
type PreviewTab = 'inicio' | 'profile' | 'prospection' | 'mapa' | 'clients' | 'novo_pedido' | 'orders' | 'entregas' | 'commissions' | 'performance';

interface PreviewOrder {
  id: string;
  order_number: string;
  description: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  representative_clients: { razao_social: string | null; nome_fantasia: string | null } | null;
}

// Abas de TRABALHO — visíveis na barra inferior (uso diário)
// RepCoApp deve ter TODAS as abas de trabalho do RepCoWeb
const WORK_TABS: { id: PreviewTab; label: string; icon: ElementType }[] = [
  { id: 'inicio',      label: 'Início',      icon: Home        },
  { id: 'prospection', label: 'Prospecção',  icon: ClipboardList },
  { id: 'mapa',        label: 'Mapa',        icon: FileText    }, // usa FileText como placeholder (Map não disponível aqui)
  { id: 'clients',     label: 'Clientes',    icon: Users       },
  { id: 'novo_pedido', label: 'Novo Pedido', icon: Plus        },
  { id: 'orders',      label: 'Pedidos',     icon: ShoppingBag },
  { id: 'entregas',    label: 'Entregas',    icon: Truck       },
];

// Abas do MENU (⋯) — acesso pessoal/relatórios, fora do fluxo de trabalho
const MENU_TABS: { id: PreviewTab; label: string; icon: ElementType }[] = [
  { id: 'profile',     label: 'Perfil',      icon: User        },
  { id: 'commissions', label: 'Comissões',   icon: DollarSign  },
  { id: 'performance', label: 'Performance', icon: TrendingUp  },
];

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  new: { label: 'Novo', className: 'bg-blue-100 text-blue-700' },
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Concluído', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-600' },
};

function ReadOnlyOrdersPreview({ representativeId }: { representativeId: string }) {
  const [orders, setOrders] = useState<PreviewOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchOrders() {
      setLoading(true);
      const { data } = await supabase
        .from('representative_orders')
        .select('id,order_number,description,total_amount,status,created_at,representative_clients(razao_social,nome_fantasia)')
        .eq('representative_id', representativeId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (mounted) {
        setOrders(
          ((data || []) as any[]).map(order => ({
            ...order,
            representative_clients: Array.isArray(order.representative_clients)
              ? order.representative_clients[0] || null
              : order.representative_clients || null,
          })) as PreviewOrder[]
        );
        setLoading(false);
      }
    }
    fetchOrders();
    return () => {
      mounted = false;
    };
  }, [representativeId]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#a4240e]" /></div>;
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">Pedidos</h3>
        <p className="text-sm text-gray-500">Visualização segura em modo leitura.</p>
      </div>
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
          <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          Nenhum pedido encontrado
        </div>
      ) : (
        orders.map(order => {
          const status = ORDER_STATUS[order.status] || { label: order.status, className: 'bg-gray-100 text-gray-600' };
          const clientName = order.representative_clients?.nome_fantasia || order.representative_clients?.razao_social;
          return (
            <div key={order.id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-900">{order.order_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                  </div>
                  {clientName && <p className="mt-1 truncate text-xs text-gray-500">{clientName}</p>}
                  {order.description && <p className="mt-1 line-clamp-2 text-xs text-gray-600">{order.description}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-gray-900">R$ {Number(order.total_amount || 0).toFixed(2).replace('.', ',')}</p>
                  <p className="text-[11px] text-gray-400">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function RepCoMobilePreview({ representatives, initialRepresentativeId, onClose, offsetIndex = 0, isTrainingMode = false }: Props) {
  const availableReps = useMemo(
    () => representatives.filter(rep => rep.status === 'active'),
    [representatives]
  );
  const [representativeId, setRepresentativeId] = useState(
    initialRepresentativeId && availableReps.some(rep => rep.id === initialRepresentativeId)
      ? initialRepresentativeId
      : availableReps[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<PreviewTab>('inicio');
  const [refreshKey, setRefreshKey] = useState(0);
  // Relógio real de São Paulo na barra de status — formato 24h (atualiza a cada 15s)
  const fmtClock = () => new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
  const [clock, setClock] = useState(fmtClock);
  useEffect(() => {
    const id = setInterval(() => setClock(fmtClock()), 15000);
    return () => clearInterval(id);
  }, []);
  const [minimized, setMinimized] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pos, setPos] = useState(() => ({ x: Math.max(8, window.innerWidth - 392 - offsetIndex * 40), y: 72 + offsetIndex * 40 }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const x = Math.min(Math.max(0, e.clientX - dragRef.current.dx), window.innerWidth - 80);
      const y = Math.min(Math.max(0, e.clientY - dragRef.current.dy), window.innerHeight - 40);
      setPos({ x, y });
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);
  function startDrag(e: React.MouseEvent) { dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; }

  // Ref do elemento main — usado para broadcast de scroll (treinamento) e recepção (espelho)
  const mainRef = useRef<HTMLDivElement>(null);

  // Modo Treinamento ao vivo (broadcast) — desligado por padrão
  const sendTraining = useTrainingBroadcast();
  const [training, setTraining] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false); // calculadora aberta neste frame
  const [calcStateLocal, setCalcStateLocal] = useState<CalcState | undefined>(undefined); // valores da calc (instrutor)
  useEffect(() => {
    if (!training) return;
    sendTraining({ active: true, tab: activeTab, calcOpen, calcState: calcStateLocal, instructor: 'Instrutor', targets: 'all' });
    return () => sendTraining({ active: false, targets: 'all' });
  }, [training, sendTraining]);
  useEffect(() => {
    if (training) sendTraining({ active: true, tab: activeTab, calcOpen, calcState: calcStateLocal, instructor: 'Instrutor', targets: 'all' });
  }, [activeTab, calcOpen, calcStateLocal, training, sendTraining]);

  // Broadcast de scroll: quando o instrutor rola, envia a posição (0–1) para os reps
  function handleScroll() {
    if (!isTrainingMode || !training || !mainRef.current) return;
    const el = mainRef.current;
    const pct = el.scrollHeight > el.clientHeight
      ? el.scrollTop / (el.scrollHeight - el.clientHeight)
      : 0;
    sendTraining({ active: true, tab: activeTab, scrollPct: pct, calcOpen, instructor: 'Instrutor', targets: 'all' });
  }

  // ESPELHO "Ver como rep": escuta broadcast e espelha aba + posição de scroll
  const trainingBroadcast = useTrainingListener(!isTrainingMode ? representativeId : undefined);
  useEffect(() => {
    if (isTrainingMode) return;
    if (trainingBroadcast?.active && trainingBroadcast.tab) {
      setActiveTab(espelhoTabToRepTab(trainingBroadcast.tab) as typeof activeTab);
      setCalcOpen(!!trainingBroadcast.calcOpen); // calculadora segue o instrutor
      // Aplica scroll após render
      if (trainingBroadcast.scrollPct !== undefined && mainRef.current) {
        const el = mainRef.current;
        requestAnimationFrame(() => {
          el.scrollTop = trainingBroadcast.scrollPct! * (el.scrollHeight - el.clientHeight);
        });
      }
    } else if (trainingBroadcast?.active === false) {
      setActiveTab('inicio');
      setCalcOpen(false);
      if (mainRef.current) mainRef.current.scrollTop = 0;
    }
  }, [trainingBroadcast, isTrainingMode]);

  const selectedRep = availableReps.find(rep => rep.id === representativeId) || null;

  // No treinamento usa o primeiro rep ativo como demo (Admin Force tem dados reais)
  const trainingRep = isTrainingMode ? (availableReps[0] || null) : null;
  const activeRep = isTrainingMode ? trainingRep : selectedRep;

  function renderContent() {
    if (!activeRep) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-gray-700">Nenhum representante ativo</p>
            <p className="mt-1 text-xs text-gray-400">
              {isTrainingMode ? 'Cadastre um representante ativo para usar no treinamento.' : 'Selecione um representante no dropdown acima.'}
            </p>
          </div>
        </div>
      );
    }

    // Treinamento: dados reais (Admin Force) com ações BLOQUEADAS (só demonstração)
    // Ver como rep: dados reais com ações DESBLOQUEADAS (admin pode ajudar)
    const propsKey = `${activeRep.id}-${refreshKey}-${isTrainingMode ? 'train' : 'live'}`;
    const pm = isTrainingMode; // previewMode: bloqueado no treinamento, livre no "Ver como rep"
    const Fallback = <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#8B2214]" /></div>;

    if (activeTab === 'inicio')
      return <RepCoHome key={propsKey} representativeId={activeRep.id} previewMode={pm} onNavigateToClient={() => setActiveTab('clients')} />;

    if (activeTab === 'profile')
      return (
        <Suspense fallback={Fallback}>
          <RepCoProfile key={propsKey} rep={{ id: activeRep.id, full_name: activeRep.full_name, email: '', phone: '', status: 'active', user_id: '' } as any} onUpdate={() => {}} />
        </Suspense>
      );

    if (activeTab === 'prospection')
      return <RepCoProspection key={propsKey} representativeId={activeRep.id} previewMode={pm} />;

    if (activeTab === 'clients')
      return <RepCoClients key={propsKey} representativeId={activeRep.id} previewMode={pm} />;

    if (activeTab === 'novo_pedido')
      return (
        <Suspense fallback={Fallback}>
          <RepCoNewOrder key={propsKey} representativeId={activeRep.id} onOrderCreated={() => setActiveTab('orders')} />
        </Suspense>
      );

    if (activeTab === 'orders')
      return <ReadOnlyOrdersPreview key={propsKey} representativeId={activeRep.id} />;

    if (activeTab === 'mapa')
      return <RepCoFieldMap key={propsKey} representativeId={activeRep.id} previewMode={pm}
        onFinalizeDelivery={() => setActiveTab('entregas')} />;

    if (activeTab === 'entregas')
      return <RepCoDeliveries key={propsKey} representativeId={activeRep.id} previewMode={pm} />;

    if (activeTab === 'commissions')
      return (
        <Suspense fallback={Fallback}>
          <RepCoCommissions key={propsKey} repId={activeRep.id} />
        </Suspense>
      );

    if (activeTab === 'performance')
      return (
        <Suspense fallback={Fallback}>
          <RepCoPerformance key={propsKey} repId={activeRep.id} />
        </Suspense>
      );

    return <ReadOnlyOrdersPreview key={propsKey} representativeId={activeRep.id} />;
  }

  return (
    <div className="fixed z-[1200] w-[360px] max-w-[calc(100vw-1rem)]" style={{ left: pos.x, top: pos.y }}>
      {/* Barra de arrastar (flutuante — não bloqueia o resto do site) */}
      <div onMouseDown={startDrag} className="flex items-center justify-between rounded-t-2xl bg-gray-950 px-3 py-2 text-white cursor-move select-none shadow-2xl">
        <div className="flex min-w-0 items-center gap-2">
          <GripHorizontal className="h-4 w-4 shrink-0 text-white/50" />
          <span className="truncate text-xs font-semibold">
            {isTrainingMode ? '📡 Treinamento — Todos' : `Espelho — ${activeRep?.full_name || selectedRep?.full_name || 'representante'}`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button type="button" onClick={() => setTraining(t => !t)} title={training ? 'Encerrar treinamento' : 'Ligar treinamento ao vivo (todos os reps)'}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${training ? 'bg-red-600 text-white animate-pulse' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
            <Radio className="h-3.5 w-3.5" />{training ? 'Ao vivo' : 'Treinar'}
          </button>
          <button type="button" onClick={() => setRefreshKey(key => key + 1)} title="Atualizar" className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"><RefreshCw className="h-4 w-4" /></button>
          <button type="button" onClick={() => setMinimized(m => !m)} title={minimized ? 'Expandir' : 'Minimizar'} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"><Minus className="h-4 w-4" /></button>
          <button type="button" onClick={onClose} title="Fechar" className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      </div>
      {!minimized && (
        <div className="rounded-b-2xl border-x-[6px] border-b-[6px] border-gray-950 bg-gray-950 shadow-2xl">
            <div className="relative h-[64vh] max-h-[680px] overflow-hidden rounded-b-[1.1rem] bg-[#f5f3ee] flex flex-col">
              {/* barra de status — 3 pontinhos abrem menu Perfil/Comissões/Performance */}
              <div className="flex-shrink-0 relative flex items-center justify-between bg-[#8B2214] px-5 pb-0.5 pt-2.5 text-[10px] font-semibold text-white/90">
                <span>{clock}</span>
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${menuOpen ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'}`}
                  title="Perfil / Comissões / Performance"
                >●●●</button>
                {/* Dropdown menu */}
                {menuOpen && (
                  <div className="absolute right-2 top-7 z-50 w-44 rounded-xl border border-gray-100 bg-white shadow-xl py-1" onClick={e => e.stopPropagation()}>
                    {MENU_TABS.map(mt => {
                      const Icon = mt.icon;
                      return (
                        <button key={mt.id} onClick={() => { setActiveTab(mt.id); setMenuOpen(false); }}
                          className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-gray-50 ${activeTab === mt.id ? 'text-[#8B2214]' : 'text-gray-700'}`}>
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          {mt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <header className="flex-shrink-0 bg-[#8B2214] px-3.5 pb-2.5 pt-1.5 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm">
                    <img src="/saporino-logo-tight.png" alt="Saporino" className="h-5 w-auto object-contain" />
                    <span className="text-xs font-bold text-[#8B2214]">RepCo</span>
                  </div>
                  <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold">Preview</span>
                </div>
                <div className="mt-1.5 min-w-0">
                  <p className="truncate text-[13px] font-semibold">
                    {isTrainingMode ? 'Todos Representantes' : 'Admin'}
                  </p>
                  <p className="text-[11px] text-white/75">
                    {isTrainingMode
                      ? 'Modo treinamento — broadcast ao vivo'
                      : `Assistindo: ${selectedRep?.full_name || 'selecione um rep'}`}
                  </p>
                </div>
                {isTrainingMode ? (
                  /* Modo treinamento: label fixo sem dropdown */
                  <div className="mt-2 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 flex items-center gap-2">
                    <Radio className="w-3 h-3 flex-shrink-0" />
                    Todos Representantes
                  </div>
                ) : (
                  /* Modo "Ver como rep": dropdown para escolher + ações desbloqueadas */
                  <select
                    value={representativeId}
                    onChange={event => setRepresentativeId(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/20 bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-white/60"
                  >
                    {availableReps.length === 0 && <option value="">Nenhum representante ativo</option>}
                    {availableReps.map(rep => (
                      <option key={rep.id} value={rep.id}>
                        {rep.full_name}
                      </option>
                    ))}
                  </select>
                )}
              </header>

              {/* nav tabs de TRABALHO — 6 abas distribuídas igualmente */}
              <nav className="flex-shrink-0 grid border-b border-gray-200 bg-white" style={{gridTemplateColumns:`repeat(${WORK_TABS.length}, 1fr)`}}>

                {WORK_TABS.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-shrink-0 flex flex-col items-center gap-0.5 border-b-2 px-2.5 py-1.5 text-[8px] font-semibold leading-tight transition-colors whitespace-nowrap ${
                        activeTab === tab.id ? 'border-[#8B2214] text-[#8B2214]' : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Overlay invisível para fechar o menu ao clicar fora */}
              {menuOpen && <div className="absolute inset-0 z-40" onClick={() => setMenuOpen(false)} />}

              {/* área de conteúdo — zoom 0.82 = proporcional ao telefone real (375px viewport).
                  Sem isso, componentes web (text-2xl, p-6, etc.) aparecem em tamanho desktop
                  mesmo num container de 360px porque as media queries usam o viewport. */}
              <main ref={mainRef} onScroll={handleScroll}
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain"
                style={{ zoom: 0.82 }}>
                {renderContent()}
              </main>
              {/* Calculadora — FAB contido; sincroniza abrir/fechar + valores + scroll no treinamento */}
              <RepCoCalculatorFab contained open={calcOpen} onOpenChange={setCalcOpen}
                syncState={!isTrainingMode && trainingBroadcast?.active ? trainingBroadcast.calcState : undefined}
                readOnly={!isTrainingMode && !!trainingBroadcast?.active}
                onCalcStateChange={isTrainingMode ? setCalcStateLocal : undefined}
                contentScrollPct={!isTrainingMode && trainingBroadcast?.active ? trainingBroadcast.calcScrollPct : undefined}
                onContentScroll={isTrainingMode && training ? (pct) => sendTraining({ active: true, tab: activeTab, calcOpen, calcState: calcStateLocal, calcScrollPct: pct, instructor: 'Instrutor', targets: 'all' }) : undefined} />
            </div>
        </div>
      )}
    </div>
  );
}
