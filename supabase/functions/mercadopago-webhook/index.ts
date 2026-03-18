import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-signature, x-request-id",
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

// Verify the Mercado Pago webhook signature
async function verifyMPSignature(
    req: Request,
    body: string,
    secret: string
): Promise<boolean> {
    try {
        const xSignature = req.headers.get('x-signature');
        const xRequestId = req.headers.get('x-request-id');

        if (!xSignature) {
            console.warn('No x-signature header found — skipping verification');
            return true; // Allow through if no signature (for testing)
        }

        // Parse the signature header: ts=TIMESTAMP,v1=HASH
        const parts: Record<string, string> = {};
        xSignature.split(',').forEach(part => {
            const [key, value] = part.split('=');
            if (key && value) parts[key.trim()] = value.trim();
        });

        const ts = parts['ts'];
        const v1 = parts['v1'];

        if (!ts || !v1) return false;

        // Parse the data.id from body
        let dataId = '';
        try {
            const parsed = JSON.parse(body);
            dataId = parsed?.data?.id || '';
        } catch (_) {
            // ignore
        }

        // Construct the manifest string as per MP docs
        // Format: id:<data.id>;request-id:<x-request-id>;ts:<ts>
        const manifest = `id:${dataId};request-id:${xRequestId || ''};ts:${ts}`;

        // Compute HMAC-SHA256
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(manifest));
        const hashHex = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        return hashHex === v1;
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        // Initialize Supabase client with Service Role Key to bypass RLS
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Read body as text for signature verification
        const bodyText = await req.text();

        // Verify signature if secret is configured
        const webhookSecret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET');
        if (webhookSecret) {
            const isValid = await verifyMPSignature(req, bodyText, webhookSecret);
            if (!isValid) {
                console.error('Invalid webhook signature — request rejected');
                return new Response(
                    JSON.stringify({ error: 'Invalid signature' }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }

        // Parse webhook data
        const webhookData: MercadoPagoWebhookData = JSON.parse(bodyText);
        console.log('Webhook received:', JSON.stringify(webhookData, null, 2));

        // We only care about payment notifications
        if (webhookData.type !== 'payment') {
            return new Response(
                JSON.stringify({ message: 'Not a payment notification, ignoring' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const paymentId = webhookData.data.id;

        // Get Mercado Pago Access Token
        const { data: settings, error: settingsError } = await supabase
            .from('admin_settings')
            .select('mercado_pago_access_token')
            .maybeSingle();

        if (settingsError) {
            console.error('Error fetching settings:', settingsError);
            throw new Error('Failed to fetch store settings');
        }

        const accessToken = settings?.mercado_pago_access_token || Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');

        if (!accessToken) {
            throw new Error('Mercado Pago Access Token not configured');
        }

        // Get payment details from Mercado Pago API
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!paymentResponse.ok) {
            const error = await paymentResponse.text();
            console.error('Mercado Pago API error:', error);
            throw new Error(`Failed to get payment details: ${paymentResponse.statusText}`);
        }

        const paymentData = await paymentResponse.json();
        console.log('Payment data:', JSON.stringify(paymentData, null, 2));

        const externalReference = paymentData.external_reference;
        const status = paymentData.status;
        const paymentMethodId = paymentData.payment_method_id;

        // Map MP status to our order status
        let orderStatus = 'pending';
        if (status === 'approved') orderStatus = 'approved';
        else if (status === 'rejected' || status === 'cancelled') orderStatus = 'rejected';
        else if (status === 'in_process' || status === 'in_mediation') orderStatus = 'in_process';
        else if (status === 'refunded' || status === 'charged_back') orderStatus = 'refunded';

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

        console.log('Order updated successfully:', orderData);

        return new Response(
            JSON.stringify({ message: 'Webhook processed successfully', orderId: externalReference, status: orderStatus }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Webhook error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
