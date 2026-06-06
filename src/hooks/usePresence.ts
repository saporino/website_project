import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface UsePresenceOptions {
  representativeId: string;
  currentTab: string;
  coords?: { lat: number; lng: number } | null;
  enabled?: boolean;
}

export function usePresence({ representativeId, currentTab, coords, enabled = true }: UsePresenceOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const representativeIdRef = useRef(representativeId);
  const currentTabRef = useRef(currentTab);
  const coordsRef = useRef(coords);

  useEffect(() => { representativeIdRef.current = representativeId; }, [representativeId]);
  useEffect(() => { currentTabRef.current = currentTab; }, [currentTab]);
  useEffect(() => { coordsRef.current = coords; }, [coords]);

  async function sendHeartbeat() {
    const id = representativeIdRef.current;
    if (!id) return;
    await supabase.from('representatives').update({
      last_seen_at: new Date().toISOString(),
      is_online: true,
      current_tab: currentTabRef.current,
      ...(coordsRef.current ? { last_lat: coordsRef.current.lat, last_lng: coordsRef.current.lng } : {}),
    }).eq('id', id);
  }

  async function setOffline() {
    const id = representativeIdRef.current;
    if (!id) return;
    await supabase.from('representatives').update({ is_online: false }).eq('id', id);
  }

  useEffect(() => {
    if (!enabled || !representativeId) return;
    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, 45000); // heartbeat a cada 45s
    // NÃO marca offline ao trocar de app (rep usa Waze/Maps o tempo todo no campo).
    // Ao voltar para o app, reenvia heartbeat. O status "online" decai sozinho pelo
    // last_seen_at quando o heartbeat para (celular bloqueado / app fechado de verdade).
    const handleVisibility = () => { if (document.visibilityState === 'visible') sendHeartbeat(); };
    const handleUnload = () => setOffline(); // só ao fechar/sair de verdade
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      setOffline();
    };
  }, [representativeId, enabled]);

  // Heartbeat imediato ao trocar aba ou coords
  useEffect(() => {
    if (!enabled || !representativeId) return;
    sendHeartbeat();
  }, [currentTab, coords]);
}
