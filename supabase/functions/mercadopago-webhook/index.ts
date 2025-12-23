import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MercadoPagoWebhookData {
    id: string;
    live_mode: boolean;
    type: string;
    date_created: string;
    user_id: string;
    api_version: string;
    action: string;
    data: {
        id: string;
    };
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 200,
            headers: corsHeaders,
        });
    }

    try {
        // Initialize Supabase client with Service Role Key to bypass RLS
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Parse webhook data
        const webhookData: MercadoPagoWebhookData = await req.json();

        console.log('Webhook received:', JSON.stringify(webhookData, null, 2));

        // We only care about payment notifications
        if (webhookData.type !== 'payment') {
            return new Response(
                JSON.stringify({ message: 'Not a payment notification, ignoring' }),
                {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        const paymentId = webhookData.data.id;

        // Fetch Mercado Pago credentials from admin_settings
        const { data: settings, error: settingsError } = await supabase
            .from('admin_settings')
            .select('mercado_pago_access_token')
            .maybeSingle();

        if (settingsError) {
            console.error('Error fetching settings:', settingsError);
            throw new Error('Failed to fetch store settings');
        }

        const accessToken = settings?.mercado_pago_access_token || Deno.env.get('VITE_MERCADO_PAGO_ACCESS_TOKEN');

        if (!accessToken) {
            throw new Error('Mercado Pago Access Token not configured');
        }

        // Get payment details from Mercado Pago
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!paymentResponse.ok) {
            const error = await paymentResponse.text();
            console.error('Mercado Pago API error:', error);
            throw new Error(`Failed to get payment details: ${paymentResponse.statusText}`);
        }

        const paymentData = await paymentResponse.json();

        console.log('Payment data:', JSON.stringify(paymentData, null, 2));

        // Extract relevant data
        const externalReference = paymentData.external_reference;
        const status = paymentData.status; // approved, rejected, in_process, etc.
        const statusDetail = paymentData.status_detail;
        const paymentMethodId = paymentData.payment_method_id;

        // Map Mercado Pago status to our order status
        let orderStatus = 'pending';
        if (status === 'approved') {
            orderStatus = 'approved';
        } else if (status === 'rejected' || status === 'cancelled') {
            orderStatus = 'rejected';
        } else if (status === 'in_process' || status === 'in_mediation') {
            orderStatus = 'in_process';
        } else if (status === 'refunded' || status === 'charged_back') {
            orderStatus = 'refunded';
        }

        // Update order in database
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .update({
                status: orderStatus,
                mercadopago_payment_id: paymentId,
                mercadopago_collection_id: paymentData.collection_id,
                mercadopago_collection_status: status,
                payment_method: paymentMethodId,
                paid_at: status === 'approved' ? new Date().toISOString() : null,
            })
            .eq('id', externalReference)
            .select()
            .single();

        if (orderError) {
            console.error('Error updating order:', orderError);
            throw orderError;
        }

        console.log('Order updated:', orderData);

        // TODO: Send email notification to customer based on status
        // TODO: Send notification to admin

        return new Response(
            JSON.stringify({
                message: 'Webhook processed successfully',
                orderId: externalReference,
                status: orderStatus,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );

    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
