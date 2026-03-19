import { supabase } from './supabase';

export interface TrackingEvent {
  date: string;
  time?: string;
  status: string;
  location?: string;
  description: string;
}

export interface TrackingResult {
  code: string;
  carrier: string;
  events: TrackingEvent[];
  lastStatus: string;
  isDelivered: boolean;
  error?: string;
}

/**
 * Brazilian carrier codes for Linketrack API
 */
const CARRIER_MAP: Record<string, string> = {
  jadlog: 'jadlog',
  bbm: 'bbm',
  'total-express': 'totalexpress',
  correios: 'correios',
};

/**
 * Fetches tracking events from Linketrack free API
 * Docs: https://linketrack.com/track/
 * Free tier: 3 requests/s, no auth required
 */
export async function getTrackingEvents(
  code: string,
  carrier: string = 'correios'
): Promise<TrackingResult> {
  const carrierCode = CARRIER_MAP[carrier.toLowerCase()] || 'correios';
  const cleanCode = code.replace(/\s/g, '').toUpperCase();

  try {
    // Linketrack public API — free, no API key needed
    const response = await fetch(
      `https://api.linketrack.com/track/json?user=teste&token=1abcd00b2731640810be9c4814c84360753ac2be3e9a03eda1f68c35bdf02f6&codigo=${cleanCode}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.quantidade === 0) {
      return {
        code: cleanCode,
        carrier: carrierCode,
        events: [],
        lastStatus: 'Sem eventos de rastreamento ainda',
        isDelivered: false,
      };
    }

    const eventos: any[] = data.eventos || [];

    const events: TrackingEvent[] = eventos.map((e: any) => ({
      date: e.data || '',
      time: e.hora || '',
      status: e.tipo || '',
      location: e.cidade ? `${e.cidade}${e.uf ? `/${e.uf}` : ''}` : e.local || '',
      description: e.descricao || e.detalhe || '',
    }));

    const lastEvent = events[0];
    const isDelivered = lastEvent?.description?.toLowerCase().includes('entregue') ||
      lastEvent?.status?.toLowerCase().includes('entregue') ||
      lastEvent?.status === 'BDE' || // Correios: entregue
      lastEvent?.description?.toLowerCase().includes('delivered');

    return {
      code: cleanCode,
      carrier: carrierCode,
      events,
      lastStatus: lastEvent?.description || 'Em trânsito',
      isDelivered,
    };
  } catch (error: any) {
    console.error('Tracking error:', error);
    return {
      code: cleanCode,
      carrier: carrierCode,
      events: [],
      lastStatus: 'Não foi possível consultar o rastreamento',
      isDelivered: false,
      error: error.message,
    };
  }
}

/**
 * Sync tracking status for a specific shipment and persist events to DB
 */
export async function syncShipmentTracking(shipmentId: string): Promise<boolean> {
  try {
    const { data: shipment, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', shipmentId)
      .single();

    if (error || !shipment || !shipment.tracking_code) return false;

    const result = await getTrackingEvents(shipment.tracking_code, shipment.carrier_name || 'correios');

    const updates: any = {
      tracking_events: result.events,
      last_tracking_check: new Date().toISOString(),
    };

    if (result.isDelivered) {
      updates.status = 'delivered';

      // Also update the order status
      await supabase
        .from('orders')
        .update({
          order_status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', shipment.order_id);
    }

    await supabase.from('shipments').update(updates).eq('id', shipmentId);

    return true;
  } catch (error) {
    console.error('Error syncing tracking:', error);
    return false;
  }
}

/**
 * Fetch tracking for an order using its tracking_code (for customer-facing pages)
 */
export async function getOrderTracking(orderId: string): Promise<TrackingResult | null> {
  try {
    const { data: shipment } = await supabase
      .from('shipments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!shipment?.tracking_code) return null;

    // Return cached events if checked in last 6h
    if (shipment.tracking_events?.length > 0 && shipment.last_tracking_check) {
      const lastCheck = new Date(shipment.last_tracking_check);
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      if (lastCheck > sixHoursAgo) {
        return {
          code: shipment.tracking_code,
          carrier: shipment.carrier_name || 'correios',
          events: shipment.tracking_events,
          lastStatus: shipment.tracking_events[0]?.description || 'Em trânsito',
          isDelivered: shipment.status === 'delivered',
        };
      }
    }

    // Fetch fresh events
    return await getTrackingEvents(shipment.tracking_code, shipment.carrier_name || 'correios');
  } catch {
    return null;
  }
}

/**
 * Generate a tracking URL based on carrier
 */
export function getTrackingUrl(code: string, carrier: string = 'correios'): string {
  const urls: Record<string, string> = {
    jadlog: `https://www.jadlog.com.br/jadlog/tracking.jad?cte=${code}`,
    bbm: `https://www.bbmlogistica.com.br/rastreamento?codigo=${code}`,
    'total-express': `https://tracking.totalexpress.com.br/poupup_track.php?reid=${code}`,
    correios: `https://rastreamento.correios.com.br/app/index.php?objeto=${code}`,
  };
  return urls[carrier.toLowerCase()] || urls.correios;
}
