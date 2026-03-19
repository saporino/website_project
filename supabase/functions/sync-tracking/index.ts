import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
        // Call Linketrack API
        const response = await fetch(
          `https://api.linketrack.com/track/json?user=teste&token=1abcd00b2731640810be9c4814c84360753ac2be3e9a03eda1f68c35bdf02f6&codigo=${shipment.tracking_code}`,
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

    return new Response(
      JSON.stringify({ success: true, synced: updated, delivered }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("sync-tracking error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
