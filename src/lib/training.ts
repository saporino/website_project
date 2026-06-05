// Modo Treinamento ao vivo — broadcast via Supabase Realtime (cross-device)
// + window.CustomEvent (mesmo browser/aba, para testes).
// O admin (painel de treinamento) transmite; o portal /repco e o espelho escutam.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface TrainingState {
  active: boolean;
  tab?: string;           // aba atual do instrutor
  scrollPct?: number;     // posição de scroll 0–1 (sincroniza a lista visível)
  instructor?: string;
  targets?: string[] | 'all';
}

const CHANNEL = 'repco-training';
const LOCAL_EVENT = 'repco:training-state'; // para comunicação na mesma aba

// Admin: envia o estado do treino via Realtime (cross-device) E evento local (mesma aba).
export function useTrainingBroadcast() {
  const chRef = useRef<RealtimeChannel | null>(null);
  useEffect(() => {
    const ch = supabase.channel(CHANNEL, { config: { broadcast: { self: false } } });
    ch.subscribe();
    chRef.current = ch;
    return () => { supabase.removeChannel(ch); chRef.current = null; };
  }, []);
  return useCallback((state: TrainingState) => {
    // 1. Mesmo browser/aba (funciona para testes com espelho + treinamento abertos juntos)
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: state }));
    // 2. Cross-device via Supabase Realtime (para reps em outros dispositivos/abas)
    chRef.current?.send({ type: 'broadcast', event: 'state', payload: state });
  }, []);
}

// Rep / Espelho: escuta tanto o evento local quanto o Realtime.
// Devolve o estado ativo, ou { active: false } quando o treino é desligado.
export function useTrainingListener(repId: string | undefined): TrainingState | null {
  const [state, setState] = useState<TrainingState | null>(null);

  // Evento local — funciona na mesma aba (testes com espelho + treinamento juntos).
  // targets='all' é sempre recebido independente de repId.
  useEffect(() => {
    function handle(e: Event) {
      const s = (e as CustomEvent<TrainingState>).detail;
      const targeted = s.targets === 'all' ||
        (Array.isArray(s.targets) && !!repId && s.targets.includes(repId));
      if (!s.active) {
        setState({ active: false });
      } else if (targeted) {
        setState(s);
      }
    }
    window.addEventListener(LOCAL_EVENT, handle);
    return () => window.removeEventListener(LOCAL_EVENT, handle);
  // repId na dependency: se mudar de rep no espelho, re-registra o listener
  }, [repId]);

  // Supabase Realtime — funciona para reps em outros dispositivos/abas
  useEffect(() => {
    if (!repId) return;
    const ch = supabase.channel(CHANNEL + '-rx-' + repId.slice(0, 8));
    ch.on('broadcast', { event: 'state' }, ({ payload }) => {
      const s = payload as TrainingState;
      const targeted = s.targets === 'all' ||
        (Array.isArray(s.targets) && s.targets.includes(repId));
      if (s.active && targeted) {
        setState(s);
      } else if (!s.active) {
        setState({ active: false });
      }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [repId]);

  return state;
}

// Mapeia a aba do espelho/treinamento para a aba do portal do rep.
// DEVE incluir TODAS as abas do RepCoApp — atualizar sempre que adicionar aba nova.
export function espelhoTabToRepTab(tab?: string): string {
  switch (tab) {
    case 'inicio':      return 'inicio';
    case 'profile':     return 'profile';
    case 'prospection': return 'prospection';
    case 'clients':     return 'clients';
    case 'novo_pedido': return 'novo_pedido';
    case 'orders':      return 'orders';
    case 'entregas':    return 'entregas';
    case 'commissions': return 'commissions';
    case 'performance': return 'performance';
    default:            return 'inicio';
  }
}
