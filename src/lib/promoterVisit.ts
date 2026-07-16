// Apoio ao fluxo de visita do promotor (Bloco 3):
// GPS/distância, câmera com compressão, upload no bucket visit-photos,
// audit log e broadcast Realtime "na loja agora".
import { supabase } from './supabase';

export function distMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function getPosition(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  });
}

// Câmera dentro do app (capture=environment). Input criado FORA do ciclo do React
// (bug conhecido deste repo: criar input no render causa re-render quebrado).
export function capturePhoto(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment'); // força a câmera no celular (não galeria)
    input.style.display = 'none';
    const cleanup = () => { try { input.remove(); } catch { /* noop */ } };
    input.addEventListener('change', () => {
      const f = input.files?.[0] || null;
      cleanup(); resolve(f);
    });
    window.addEventListener('focus', () => setTimeout(() => { if (!input.files?.length) { cleanup(); resolve(null); } }, 600), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

// Comprime para ~1600px no maior lado, JPEG ~0.7 (alvo do módulo)
export async function compressImage(file: File, maxSide = 1600, quality = 0.7): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bmp, 0, 0, w, h);
  return await new Promise<Blob>(res => canvas.toBlob(b => res(b || file), 'image/jpeg', quality));
}

export async function uploadVisitPhoto(promoterId: string, visitId: string, kind: string, blob: Blob): Promise<string> {
  const path = `promoter/${promoterId}/${visitId}/${kind}-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage.from('visit-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error || !data) throw new Error(error?.message || 'falha no upload');
  const { data: pub } = supabase.storage.from('visit-photos').getPublicUrl(data.path || path);
  return pub.publicUrl;
}

export async function auditLog(entity: string, entityId: string, action: string, payload?: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('promoter_audit_log').insert({
    actor_user_id: user.id, entity, entity_id: entityId, action, payload: payload ?? null,
  });
}

// ---- Realtime "na loja agora" (canal de broadcast; não depende de RLS) ----
export interface VisitLivePayload {
  type: 'checkin' | 'checkout';
  visitId: string; clientId: string; clientName: string;
  promoterName: string; at: string;
}
let liveChannel: ReturnType<typeof supabase.channel> | null = null;
function ensureLiveChannel() {
  if (!liveChannel) { liveChannel = supabase.channel('promoter-live', { config: { broadcast: { self: false } } }); liveChannel.subscribe(); }
  return liveChannel;
}
export function broadcastVisitState(payload: VisitLivePayload) {
  try { ensureLiveChannel().send({ type: 'broadcast', event: 'visit', payload }); } catch { /* best-effort */ }
}
export function subscribeVisitLive(onEvent: (p: VisitLivePayload) => void) {
  const ch = supabase.channel('promoter-live', { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'visit' }, ({ payload }) => onEvent(payload as VisitLivePayload))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

// ---- Rascunho local + reenvio (o "offline pequeno"; NÃO é offline-first) ----
const PENDING_KEY = 'promotor-pendentes';
export interface PendingOp { table: string; id: string; patch: Record<string, unknown>; ts: number }
export function queuePending(op: PendingOp) {
  const list: PendingOp[] = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  list.push(op);
  localStorage.setItem(PENDING_KEY, JSON.stringify(list));
}
export function getPending(): PendingOp[] { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); }
export async function retryPending(): Promise<number> {
  const list = getPending(); const still: PendingOp[] = [];
  for (const op of list) {
    const { error } = await supabase.from(op.table).update(op.patch).eq('id', op.id);
    if (error) still.push(op);
  }
  localStorage.setItem(PENDING_KEY, JSON.stringify(still));
  return list.length - still.length;
}
// atualização com fallback pra fila local (sinal caiu no corredor do mercado)
export async function updateVisitSafe(visitId: string, patch: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from('promoter_visits').update(patch).eq('id', visitId);
  if (error) { queuePending({ table: 'promoter_visits', id: visitId, patch, ts: Date.now() }); return false; }
  return true;
}
