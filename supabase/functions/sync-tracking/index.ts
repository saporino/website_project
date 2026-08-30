import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEdge, newRequestId } from "../_shared/log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Gate (Fase 0 / P0 fix): this is a background/cron endpoint that runs with
  // the service role. It previously had NO auth gate — anyone with the public
  // anon key could trigger it. Require the internal secret (same pattern as
  // publish-scheduled / scraper-reminder).
  const internalSecret = req.headers.get("x-internal-secret");
  if (internalSecret !== serviceKey) {
    return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey
    );

    // Linketrack credentials must come from secrets, not be hardcoded.
    // (Fase 0 / P0 fix: a public demo token was committed in the source.)
    const linketrackUser = Deno.env.get("LINKETRACK_USER");
    const linketrackToken = Deno.env.get("LINKETRACK_TOKEN");
    if (!linketrackUser || !linketrackToken) {
      return new Response(
        JSON.stringify({ error: "Linketrack credentials not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all shipments that are in shipped status and haven't been checked in 6h
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const { data: shipments, error } = await supabase
      .from("shipments")
      .select("*")
      .eq("status", "shipped")
      .or(`last_tracking_check.is.null,last_tracking_check.lt.${sixHoursAgo}`);

    if (error) throw error;

    console.log(`Syncing tracking for ${shipments?.length || 0} shipments`);

    let updated = 0;
    let delivered = 0;

    for (const shipment of shipments || []) {
      if (!shipment.tracking_code) continue;

      try {
        // Call Linketrack API (credentials from secrets)
        const response = await fetch(
          `https://api.linketrack.com/track/json?user=${encodeURIComponent(linketrackUser)}&token=${encodeURIComponent(linketrackToken)}&codigo=${encodeURIComponent(shipment.tracking_code)}`,
          { headers: { Accept: "application/json" } }
        );

        if (!response.ok) {
          console.error(`Tracking API error for ${shipment.tracking_code}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const eventos = data?.eventos || [];

        const events = eventos.map((e: any) => ({
          date: e.data || "",
          time: e.hora || "",
          status: e.tipo || "",
          location: e.cidade ? `${e.cidade}${e.uf ? `/${e.uf}` : ""}` : e.local || "",
          description: e.descricao || e.detalhe || "",
        }));

        const lastEvent = events[0];
        const isDelivered =
          lastEvent?.description?.toLowerCase().includes("entregue") ||
          lastEvent?.status?.toLowerCase().includes("entregue") ||
          lastEvent?.status === "BDE" ||
          lastEvent?.description?.toLowerCase().includes("delivered");

        const shipmentUpdates: any = {
          tracking_events: events,
          last_tracking_check: new Date().toISOString(),
        };

        if (isDelivered) {
          shipmentUpdates.status = "delivered";
          delivered++;

          // Update parent order
          await supabase
            .from("orders")
            .update({
              order_status: "delivered",
              status: "delivered",
              delivered_at: new Date().toISOString(),
            })
            .eq("id", shipment.order_id);
        }

        await supabase
          .from("shipments")
          .update(shipmentUpdates)
          .eq("id", shipment.id);

        updated++;

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.error(`Error syncing shipment ${shipment.id}:`, err);
      }
    }

    await logEdge(supabase, { function_name: 'sync-tracking', request_id: newRequestId(req), level: 'info', status: 200, meta: { synced: updated, delivered } });
    return new Response(
      JSON.stringify({ success: true, synced: updated, delivered }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
      await logEdge(sb, { function_name: 'sync-tracking', request_id: newRequestId(req), level: 'error', status: 500, error_text: error?.message });
    } catch (_) { /* ignore */ }
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
