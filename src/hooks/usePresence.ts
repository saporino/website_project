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
    intervalRef.current = setInterval(sendHeartbeat, 60000);
    const handleVisibility = () => document.visibilityState === 'hidden' ? setOffline() : sendHeartbeat();
    const handleUnload = () => setOffline();
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
