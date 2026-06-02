// Modo Treinamento ao vivo (Etapa 1) — broadcast via Supabase Realtime, sem escrita no banco.
// O admin (pelo espelho) transmite o estado do treino; o app do rep escuta e trava/segue.
// Desligado por padrão: nada acontece no app do rep até o admin "Ligar Treinamento".
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface TrainingState {
  active: boolean;
  tab?: string;          // tela que o instrutor está demonstrando
  instructor?: string;   // nome de quem conduz
  targets?: string[] | 'all'; // quais reps recebem
}

const CHANNEL = 'repco-training';

// Admin: mantém um canal e envia o estado do treino.
export function useTrainingBroadcast() {
  const chRef = useRef<RealtimeChannel | null>(null);
  useEffect(() => {
    const ch = supabase.channel(CHANNEL, { config: { broadcast: { self: false } } });
    ch.subscribe();
    chRef.current = ch;
    return () => { supabase.removeChannel(ch); chRef.current = null; };
  }, []);
  return useCallback((state: TrainingState) => {
    chRef.current?.send({ type: 'broadcast', event: 'state', payload: state });
  }, []);
}

// Rep: escuta o canal e devolve o estado do treino quando ele é o alvo (ou 'all').
export function useTrainingListener(repId: string | undefined): TrainingState | null {
  const [state, setState] = useState<TrainingState | null>(null);
  useEffect(() => {
    if (!repId) return;
    const ch = supabase.channel(CHANNEL);
    ch.on('broadcast', { event: 'state' }, ({ payload }) => {
      const s = payload as TrainingState;
      const targeted = s.targets === 'all' || (Array.isArray(s.targets) && s.targets.includes(repId));
      setState(s.active && targeted ? s : null);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [repId]);
  return state;
}

// Mapeia a aba do espelho (admin) para a aba do app do rep.
export function espelhoTabToRepTab(tab?: string): string {
  switch (tab) {
    case 'inicio': return 'inicio';
    case 'clients': return 'clients';
    case 'orders': return 'orders';
    case 'rotas': return 'rotas';
    case 'prospection': return 'prospection';
    default: return 'inicio';
  }
}
