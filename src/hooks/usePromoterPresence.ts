import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// Presença do promotor — espelha o padrão do usePresence (representantes),
// mas grava em `promoters`. Foreground apenas (é o que o navegador permite).
interface Options {
  promoterId: string;
  currentTab: string;
  coords?: { lat: number; lng: number } | null;
  enabled?: boolean;
}

export function usePromoterPresence({ promoterId, currentTab, coords, enabled = true }: Options) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idRef = useRef(promoterId);
  const tabRef = useRef(currentTab);
  const coordsRef = useRef(coords);

  useEffect(() => { idRef.current = promoterId; }, [promoterId]);
  useEffect(() => { tabRef.current = currentTab; }, [currentTab]);
  useEffect(() => { coordsRef.current = coords; }, [coords]);

  async function sendHeartbeat() {
    const id = idRef.current;
    if (!id) return;
    await supabase.from('promoters').update({
      last_seen_at: new Date().toISOString(),
      is_online: true,
      current_tab: tabRef.current,
      ...(coordsRef.current ? { last_lat: coordsRef.current.lat, last_lng: coordsRef.current.lng } : {}),
    }).eq('id', id);
  }

  async function setOffline() {
    const id = idRef.current;
    if (!id) return;
    await supabase.from('promoters').update({ is_online: false }).eq('id', id);
  }

  useEffect(() => {
    if (!enabled || !promoterId) return;
    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, 45000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') sendHeartbeat(); };
    const handleUnload = () => setOffline();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      setOffline();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoterId, enabled]);

  useEffect(() => {
    if (!enabled || !promoterId) return;
    sendHeartbeat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, coords]);
}
